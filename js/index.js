// Entry-point: checks auth state and redirects to the right page.
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc }        from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists() || snap.data().mustChangePassword) {
      window.location.href = 'change-password.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch {
    window.location.href = 'login.html';
  }
});
