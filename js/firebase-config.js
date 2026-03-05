// ============================================================
// CONFIGURAÇÃO DO FIREBASE
//
// Substitua os valores abaixo com as configurações do seu
// projeto Firebase:
//   Firebase Console → Configurações do projeto →
//   Seus aplicativos → Aplicativo web → Configuração do SDK
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            'SUA_API_KEY',
  authDomain:        'SEU_PROJETO_ID.firebaseapp.com',
  projectId:         'SEU_PROJETO_ID',
  storageBucket:     'SEU_PROJETO_ID.appspot.com',
  messagingSenderId: 'SEU_MESSAGING_SENDER_ID',
  appId:             'SEU_APP_ID'
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
