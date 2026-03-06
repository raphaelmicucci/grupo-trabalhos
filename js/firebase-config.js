// ============================================================
// CONFIGURAÇÃO DO FIREBASE
//
// Os valores abaixo são substituídos automaticamente durante o
// deploy via GitHub Actions (secrets do repositório).
// Consulte o README para instruções de configuração.
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            "__FIREBASE_API_KEY__",
  authDomain:        "__FIREBASE_AUTH_DOMAIN__",
  projectId:         "__FIREBASE_PROJECT_ID__",
  storageBucket:     "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__FIREBASE_APP_ID__"
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
