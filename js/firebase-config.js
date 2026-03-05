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
  apiKey: "AIzaSyACoveS5N5GUuBtRR9eYXi0G9Vz8VbCF_o",
  authDomain: "grupo-trabalhos.firebaseapp.com",
  projectId: "grupo-trabalhos",
  storageBucket: "grupo-trabalhos.firebasestorage.app",
  messagingSenderId: "815792240166",
  appId: "1:815792240166:web:afe07880c15ae0544c58e7"
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
