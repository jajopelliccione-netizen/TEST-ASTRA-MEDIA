import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCOQaxFQ5qzOu7cjfaRmGkk4XlqySh4BcA",
  authDomain:        "astragency-88b1a.firebaseapp.com",
  projectId:         "astragency-88b1a",
  storageBucket:     "astragency-88b1a.firebasestorage.app",
  messagingSenderId: "1038793326642",
  appId:             "1:1038793326642:web:b6e1fb1719bed36a7abc2b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Cloud Function "activateInvite" (firebase-functions/index.js) — attiva un
// codice invito e crea l'account con l'email/password scelte dal cliente.
// URL prevedibile per una function v2 senza region esplicita (us-central1);
// se al deploy Firebase stampa un URL diverso, aggiornalo qui.
export const ACTIVATE_INVITE_URL = 'https://us-central1-astragency-88b1a.cloudfunctions.net/activateInvite';

// Cloud Functions "requestPasswordReset" / "confirmPasswordReset" — invio del
// codice via email (Resend) e conferma della nuova password. Stessa nota sul
// prevedibile URL us-central1: verifica dopo il deploy.
export const REQUEST_PASSWORD_RESET_URL = 'https://us-central1-astragency-88b1a.cloudfunctions.net/requestPasswordReset';
export const CONFIRM_PASSWORD_RESET_URL = 'https://us-central1-astragency-88b1a.cloudfunctions.net/confirmPasswordReset';
