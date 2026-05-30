// Credenziali service account Firebase lette da env vars Cloudflare

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { type, name, companyName, title: customTitle, body: customBody } = body;

    let title, notifBody;
    if (type === 'manual') {
      title     = customTitle  || 'Astra Agency';
      notifBody = customBody   || 'Nuova notifica';
    } else if (type === 'partner') {
      title     = 'Nuova richiesta partner!';
      notifBody = `${companyName || "Un'azienda"} vuole collaborare`;
    } else {
      title     = 'Nuovo messaggio!';
      notifBody = `${name || 'Qualcuno'} ha inviato un messaggio`;
    }

    // Usa env vars Cloudflare se presenti, altrimenti valori hardcoded
    const projectId   = env.FCM_PROJECT_ID;
    const clientEmail = env.FCM_CLIENT_EMAIL;
    const privateKey  = env.FCM_PRIVATE_KEY;

    const accessToken = await getAccessToken(clientEmail, privateKey);
    const tokens      = await getAdminTokens(projectId, accessToken);

    if (tokens.length > 0) {
      await sendAll(tokens, title, notifBody, projectId, accessToken);
    }

    return json({ ok: true, count: tokens.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ── Firestore: leggi i token FCM degli admin ───────────────────────────────
async function getAdminTokens(projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admin_tokens`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.documents || [])
    .map(d => d.fields?.token?.stringValue)
    .filter(Boolean);
}

// ── FCM v1: invia a tutti i token ──────────────────────────────────────────
async function sendAll(tokens, title, body, projectId, accessToken) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  await Promise.allSettled(
    tokens.map(token =>
      fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            webpush: {
              notification: {
                icon: 'https://astragency.studio/admin/icon.png',
                badge: 'https://astragency.studio/admin/icon.png',
              },
              fcmOptions: { link: 'https://astragency.studio/admin/dashboard.html' },
            },
          },
        }),
      })
    )
  );
}

// ── Auth: genera access token da service account ──────────────────────────
async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));

  const unsigned  = `${header}.${payload}`;
  const cryptoKey = await importPrivateKey(privateKey);
  const sigBuf    = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc(unsigned));
  const jwt       = `${unsigned}.${b64url(sigBuf)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Token OAuth fallito: ' + JSON.stringify(data));
  return data.access_token;
}

async function importPrivateKey(pem) {
  const clean  = pem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8', binary.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function b64url(input) {
  const str = input instanceof ArrayBuffer
    ? String.fromCharCode(...new Uint8Array(input))
    : typeof input === 'string' ? input : JSON.stringify(input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function enc(str) { return new TextEncoder().encode(str); }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
