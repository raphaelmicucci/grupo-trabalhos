import { auth, db } from './firebase-config.js';
import { requireGuest } from './auth-guard.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc }               from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

requireGuest();

const form          = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passInput     = document.getElementById('password');
const alertEl       = document.getElementById('alert');
const submitBtn     = document.getElementById('submit-btn');

function showAlert(msg) {
  alertEl.textContent = msg;
  alertEl.classList.remove('hidden');
}
function hideAlert() { alertEl.classList.add('hidden'); }

function setLoading(on) {
  submitBtn.disabled    = on;
  submitBtn.textContent = on ? 'Entrando...' : 'Entrar';
}

const AUTH_ERRORS = {
  'auth/user-disabled':     'Conta desativada.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
  'auth/invalid-credential':'Usuário ou senha incorretos.'
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  setLoading(true);

  const username = usernameInput.value.trim().toLowerCase();
  if (!username) {
    setLoading(false);
    showAlert('Digite seu usuário.');
    return;
  }

  try {
    const lookupSnap = await getDoc(doc(db, 'usernameLookup', username));
    if (!lookupSnap.exists()) {
      setLoading(false);
      showAlert('Usuário ou senha incorretos.');
      return;
    }

    const { email } = lookupSnap.data();
    await signInWithEmailAndPassword(auth, email, passInput.value);
    // onAuthStateChanged in auth-guard will handle redirect
  } catch (err) {
    setLoading(false);
    showAlert(AUTH_ERRORS[err.code] || 'Erro ao entrar. Tente novamente.');
  }
});
