const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest }         = require('firebase-functions/v2/https');
const { defineSecret }      = require('firebase-functions/params');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');
const { getAuth }           = require('firebase-admin/auth');

initializeApp();

// Impostala con: firebase functions:secrets:set RESEND_API_KEY
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Manda un'email HTML brandizzata tramite Resend (https://resend.com — piano
// gratuito 3000 email/mese). "from" usa il dominio sandbox finché non
// verifichi astragency.it su Resend: a quel punto sostituiscilo con
// "Astra Agency <noreply@astragency.it>" per un mittente più professionale.
async function sendBrandedEmail({ to, subject, html, apiKey }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Astra Agency <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!resp.ok) throw new Error(`Invio email fallito: ${await resp.text()}`);
}

function passwordResetEmailHtml({ code, resetUrl }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#07060F;color:#F4F2FF;border-radius:16px;">
    <h1 style="font-size:20px;margin:0 0 8px;">Astra Agency</h1>
    <p style="color:rgba(244,242,255,.7);font-size:14px;line-height:1.5;">Hai richiesto di reimpostare la password del tuo account. Usa il codice qui sotto nell'app o nel sito, oppure clicca direttamente sul link.</p>
    <div style="background:#15121F;border:1px solid rgba(140,130,255,.3);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
      <div style="font-size:12px;color:rgba(244,242,255,.5);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Il tuo codice</div>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#F4F2FF;">${code}</div>
    </div>
    <div style="text-align:center;margin:20px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#6C63FF;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;">Reimposta password ora</a>
    </div>
    <p style="color:rgba(244,242,255,.45);font-size:12px;line-height:1.5;">Il codice e il link scadono tra 15 minuti. Se non hai richiesto tu questa email, ignorala pure: la tua password resterà invariata.</p>
  </div>`;
}

async function sendToAdmins(title, body) {
  const tokensSnap = await getFirestore().collection('admin_tokens').get();
  const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
  if (!tokens.length) return;

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  for (const chunk of chunks) {
    await getMessaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      webpush: {
        notification: {
          icon:  'https://astragency.it/admin/icon.png',
          badge: 'https://astragency.it/admin/icon.png',
          requireInteraction: false,
        },
        fcmOptions: { link: 'https://astragency.it/admin/dashboard.html' }
      }
    });
  }
}

exports.notifyNewContact = onDocumentCreated('contacts/{id}', async (event) => {
  const d = event.data.data();
  if (d.status !== 'new') return;
  await sendToAdmins('Nuovo messaggio!', `${d.name || 'Qualcuno'} ha inviato un messaggio`);
});

exports.notifyNewPartner = onDocumentCreated('partners/{id}', async (event) => {
  const d = event.data.data();
  if (d.status !== 'pending') return;
  await sendToAdmins('Nuova richiesta partner!', `${d.companyName || "Un'azienda"} vuole collaborare`);
});

// ── Primo accesso — attiva un codice invito generato dall'admin ────────────
// Crea l'account Firebase Auth con l'email/password scelte dal cliente (mai
// visibili all'admin) e collega quel nuovo uid al cliente/brand giusto —
// come proprietario (nuovo cliente) o come socio (collaboratorUids), a
// seconda del ruolo memorizzato sull'invito. Gira con privilegi Admin SDK,
// quindi non serve toccare le regole Firestore per questa scrittura.
exports.activateInvite = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Metodo non consentito.' }); return; }

  const { code, email, password, name } = req.body || {};
  if (!code || !email || !password) { res.status(400).json({ ok: false, error: 'Codice, email e password sono obbligatori.' }); return; }
  if (String(password).length < 6) { res.status(400).json({ ok: false, error: 'La password deve avere almeno 6 caratteri.' }); return; }

  const db = getFirestore();
  const inviteRef = db.collection('invites').doc(String(code).trim().toUpperCase());

  try {
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) { res.status(404).json({ ok: false, error: 'Codice non valido.' }); return; }
    const invite = inviteSnap.data();
    if (invite.used) { res.status(409).json({ ok: false, error: 'Questo codice è già stato utilizzato.' }); return; }

    let userRecord;
    try {
      userRecord = await getAuth().createUser({ email, password, displayName: name || undefined });
    } catch (err) {
      const messages = {
        'auth/email-already-exists': 'Questa email è già registrata. Usa un\'altra email o accedi normalmente.',
        'auth/invalid-email': 'Formato email non valido.',
      };
      res.status(400).json({ ok: false, error: messages[err.code] || err.message });
      return;
    }

    const clientRef = db.collection('clients').doc(invite.clientUid);
    if (invite.role === 'collaborator') {
      await clientRef.update({
        collaboratorUids: FieldValue.arrayUnion(userRecord.uid),
        collaborators: FieldValue.arrayUnion({ uid: userRecord.uid, name: name || email.split('@')[0], email }),
      });
    } else {
      await clientRef.set({ ownerUid: userRecord.uid, email }, { merge: true });
    }

    await inviteRef.update({ used: true, usedAt: new Date(), usedByUid: userRecord.uid, usedEmail: email });

    res.json({ ok: true, uid: userRecord.uid });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function randomSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Password dimenticata (1/2) — genera codice + link e manda l'email ─────
exports.requestPasswordReset = onRequest({ cors: true, secrets: [RESEND_API_KEY] }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Metodo non consentito.' }); return; }
  const { email } = req.body || {};
  if (!email) { res.status(400).json({ ok: false, error: 'Email obbligatoria.' }); return; }

  const db = getFirestore();
  try {
    let user;
    try {
      user = await getAuth().getUserByEmail(email);
    } catch (_) {
      // Non riveliamo se l'email esiste o no — rispondiamo comunque ok.
      res.json({ ok: true });
      return;
    }

    const code = randomSixDigitCode();
    await db.collection('password_resets').doc(code).set({
      code, uid: user.uid, email,
      used: false, usedAt: null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      createdAt: new Date(),
    });

    const resetUrl = `https://astragency.it/client/login.html?resetCode=${code}`;
    await sendBrandedEmail({
      to: email,
      subject: 'Il tuo codice per reimpostare la password — Astra Agency',
      html: passwordResetEmailHtml({ code, resetUrl }),
      apiKey: RESEND_API_KEY.value(),
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Password dimenticata (2/2) — verifica codice e imposta la nuova password
exports.confirmPasswordReset = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Metodo non consentito.' }); return; }
  const { code, newPassword } = req.body || {};
  if (!code || !newPassword) { res.status(400).json({ ok: false, error: 'Codice e nuova password sono obbligatori.' }); return; }
  if (String(newPassword).length < 6) { res.status(400).json({ ok: false, error: 'La password deve avere almeno 6 caratteri.' }); return; }

  const db = getFirestore();
  const ref = db.collection('password_resets').doc(String(code).trim());
  try {
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).json({ ok: false, error: 'Codice non valido.' }); return; }
    const data = snap.data();
    if (data.used) { res.status(409).json({ ok: false, error: 'Codice già utilizzato.' }); return; }
    if (data.expiresAt.toDate() < new Date()) { res.status(410).json({ ok: false, error: 'Codice scaduto. Richiedine uno nuovo.' }); return; }

    await getAuth().updateUser(data.uid, { password: newPassword });
    await ref.update({ used: true, usedAt: new Date() });

    res.json({ ok: true, email: data.email });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
