const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

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
