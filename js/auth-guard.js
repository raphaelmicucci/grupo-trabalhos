/**
 * auth-guard.js — Route protection helpers.
 *
 * Exported functions:
 *   requireAuth(callback)  — Ensures the user is authenticated and profile
 *                            exists in Firestore.  Redirects to login when
 *                            unauthenticated, and to change-password when
 *                            mustChangePassword === true.
 *   requireAdmin(callback) — Like requireAuth but also checks role === 'ADMIN'.
 *   requireGuest(callback) — Redirects away when the user IS already
 *                            authenticated (used on the login page).
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc }                 from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

function to(page) {
  window.location.href = page;
}

function hideLoader() {
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.add('hidden');
}

// ── requireAuth ──────────────────────────────────────────────
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { to('login.html'); return; }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        // Profile missing — sign out and redirect to login
        await signOut(auth);
        to('login.html');
        return;
      }

      const profile = { uid: user.uid, ...snap.data() };

      if (profile.mustChangePassword) {
        // Do not redirect if already on change-password page
        if (!window.location.pathname.endsWith('change-password.html')) {
          to('change-password.html');
          return;
        }
      }

      hideLoader();
      callback(profile);
    } catch (err) {
      console.error('requireAuth error:', err);
      to('login.html');
    }
  });
}

// ── requireAdmin ─────────────────────────────────────────────
export function requireAdmin(callback) {
  requireAuth((profile) => {
    if (profile.role !== 'ADMIN') {
      to('dashboard.html');
      return;
    }
    callback(profile);
  });
}

// ── requireGuest ─────────────────────────────────────────────
// Call on the login page — redirects away if already logged in.
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
      } else {
        to('dashboard.html');
      }
    } catch {
      to('dashboard.html');
    }
  });
}
