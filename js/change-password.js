import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updatePassword, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const overlay = document.getElementById('loading-overlay');
const form = document.getElementById('change-form');
const newPassInput = document.getElementById('new-password');
const confPassInput = document.getElementById('confirm-password');
const alertEl = document.getElementById('alert');
const submitBtn = document.getElementById('submit-btn');
const logoutLink = document.getElementById('logout-link');

let currentUser = null;
let currentProfile = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      window.location.href = 'login.html';
      return;
    }

    currentProfile = snap.data();

    if (!currentProfile.mustChangePassword) {
      window.location.href = currentProfile.role === 'ADMIN' ? 'admin.html' : 'index.html';
      return;
    }

    currentUser = user;
    overlay.classList.add('hidden');
  } catch {
    window.location.href = 'login.html';
  }
});

function showAlert(msg, type = 'error') {
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.classList.remove('hidden');
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.textContent = on ? 'Salvando...' : 'Salvar nova senha';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPass = newPassInput.value;
  const confPass = confPassInput.value;

  if (newPass.length < 8) {
    showAlert('A senha deve ter pelo menos 8 caracteres.');
    return;
  }
  if (newPass !== confPass) {
    showAlert('As senhas não coincidem.');
    return;
  }

  setLoading(true);

  try {
    await updatePassword(currentUser, newPass);
    await updateDoc(doc(db, 'users', currentUser.uid), { mustChangePassword: false });
    window.location.href = currentProfile?.role === 'ADMIN' ? 'admin.html' : 'index.html';
  } catch (err) {
    setLoading(false);
    if (err.code === 'auth/requires-recent-login') {
      showAlert('Sessão expirada. Faça login novamente e tente outra vez.');
      setTimeout(async () => {
        try {
          await signOut(auth);
        } catch (_) {
          // ignore
        }
        window.location.href = 'login.html';
      }, 3000);
    } else {
      showAlert('Erro ao salvar nova senha. Tente novamente.');
    }
  }
});

logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = 'login.html';
});
