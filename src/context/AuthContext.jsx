import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

/** User-facing messages for common Firebase Auth errors */
export function formatAuthError(err) {
  const code = err?.code || '';
  const messages = {
    'auth/unauthorized-domain':
      'This site is not authorized in Firebase. Add localhost to Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed':
      'Google sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/popup-blocked':
      'Pop-up was blocked. Allow pop-ups for this site or try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using a different sign-in method.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };
  return messages[code] || err?.message || 'Authentication failed';
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  /**
   * Google sign-in: popup first (works reliably on localhost).
   * Falls back to redirect only if the browser blocks the popup.
   */
  async function loginWithGoogle() {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result;
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw err;
    }
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    let unsubscribe;

    async function initAuth() {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setCurrentUser(result.user);
        }
      } catch (err) {
        console.error('Redirect sign-in error:', err);
        setAuthError(formatAuthError(err));
      }

      unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoading(false);
        if (user) setAuthError(null);
      });
    }

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    loading,
    authError,
    setAuthError,
    signup,
    login,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
