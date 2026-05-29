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
