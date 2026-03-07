/**
 * auth-guard.js - Route protection helpers.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

function to(page) {
  window.location.href = page;
}

function hideLoader() {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.add('hidden');
}

export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      to('login.html');
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        to('login.html');
        return;
      }

      const profile = { uid: user.uid, ...snap.data() };

      if (profile.mustChangePassword && !window.location.pathname.endsWith('change-password.html')) {
        to('change-password.html');
        return;
      }

      hideLoader();
      callback(profile);
    } catch (err) {
      console.error('requireAuth error:', err);
      to('login.html');
    }
  });
}

export function requireAdmin(callback) {
  requireAuth((profile) => {
    if (profile.role !== 'ADMIN') {
      to('index.html');
      return;
    }
    callback(profile);
  });
}

export function requireGuest(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      hideLoader();
      if (callback) callback();
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const profile = snap.exists() ? snap.data() : null;

      if (profile?.mustChangePassword) {
        to('change-password.html');
      } else if (profile?.role === 'ADMIN') {
        to('admin.html');
      } else {
        to('index.html');
      }
    } catch {
      to('index.html');
    }
  });
}
