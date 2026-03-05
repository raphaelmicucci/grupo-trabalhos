import { auth } from './firebase-config.js';
import { requireGuest } from './auth-guard.js';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

requireGuest();

const form        = document.getElementById('login-form');
const emailInput  = document.getElementById('email');
const passInput   = document.getElementById('password');
const alertEl     = document.getElementById('alert');
const submitBtn   = document.getElementById('submit-btn');
const forgotLink  = document.getElementById('forgot-link');
const resetNotice = document.getElementById('reset-notice');

function showAlert(msg) {
  alertEl.textContent = msg;
  alertEl.classList.remove('hidden');
}
function hideAlert() { alertEl.classList.add('hidden'); }

function setLoading(on) {
  submitBtn.disabled  = on;
  submitBtn.textContent = on ? 'Entrando...' : 'Entrar';
}

const AUTH_ERRORS = {
  'auth/invalid-email':     'Email inválido.',
  'auth/user-disabled':     'Conta desativada.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
  // Note: 'auth/user-not-found' and 'auth/wrong-password' are intentionally
  // mapped to the same generic message to prevent account enumeration.
  'auth/invalid-credential':'Email ou senha incorretos.'
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  setLoading(true);

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passInput.value
    );
    // onAuthStateChanged in auth-guard will handle redirect
  } catch (err) {
    setLoading(false);
    showAlert(AUTH_ERRORS[err.code] || 'Erro ao entrar. Tente novamente.');
  }
});

forgotLink.addEventListener('click', async (e) => {
  e.preventDefault();
  hideAlert();
  resetNotice.classList.add('hidden');

  const email = emailInput.value.trim();
  if (!email) {
    showAlert('Digite seu email no campo acima antes de solicitar o reset.');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    resetNotice.classList.remove('hidden');
  } catch (err) {
    const msgs = {
      'auth/invalid-email': 'Email inválido.'
      // Note: 'auth/user-not-found' is intentionally omitted to prevent
      // account enumeration. Firebase silently succeeds for unknown emails.
    };
    showAlert(msgs[err.code] || 'Erro ao enviar email de reset. Tente novamente.');
  }
});
