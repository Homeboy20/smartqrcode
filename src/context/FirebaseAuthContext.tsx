"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';

// Define the shape of the context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isFirebaseAvailable: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updateUserProfile: (data: { displayName?: string, photoURL?: string }) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  getIdToken: () => Promise<string | null>;
  sendVerificationEmail: () => Promise<boolean>;
  setupRecaptcha: (containerId: string) => Promise<RecaptchaVerifier>;
  sendPhoneVerificationCode: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyPhoneCode: (confirmationResult: ConfirmationResult, verificationCode: string, displayName?: string) => Promise<boolean>;
  clearError: () => void;
}

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isFirebaseAvailable: false,
  signIn: async () => false,
  signUp: async () => false,
  logout: async () => false,
  resetPassword: async () => false,
  updateUserProfile: async () => false,
  signInWithGoogle: async () => false,
  getIdToken: async () => null,
  sendVerificationEmail: async () => false,
  setupRecaptcha: async () => {
    throw new Error('setupRecaptcha not implemented');
  },
  sendPhoneVerificationCode: async () => {
    throw new Error('sendPhoneVerificationCode not implemented');
  },
  verifyPhoneCode: async () => false,
  clearError: () => {}
});

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Clear any error
  const clearError = () => setError(null);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    if (!auth) return false;
    
    try {
      clearError();
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!auth) return false;
    
    try {
      clearError();
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile if displayName is provided
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
      }
      
      // Create user document in Firestore
      if (result.user && db) {
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            email,
            displayName: displayName || '',
            createdAt: serverTimestamp(),
            role: 'user'
          });
        } catch (dbErr: any) {
          console.error('Error creating user document:', dbErr);
          // Continue even if Firestore fails
        }
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Sign out
  const logout = async () => {
    if (!auth) return true;
    
    try {
      clearError();
      await signOut(auth);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    if (!auth) return false;
    
    try {
      clearError();
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Update user profile
  const updateUserProfile = async (data: { displayName?: string, photoURL?: string }) => {
    if (!auth?.currentUser) return false;
    
    try {
      clearError();
      await updateProfile(auth.currentUser, data);
      
      // Update Firestore document if db is available
      if (db) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            ...data,
            updatedAt: serverTimestamp()
          });
        } catch (dbErr: any) {
          console.error('Error updating user document:', dbErr);
          // Continue even if Firestore update fails
        }
      }
      
      // Force refresh of user state
      setUser({ ...auth.currentUser });
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    if (!auth) return false;
    
    try {
      clearError();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Create/update user document in Firestore
      if (result.user && db) {
        try {
          const userRef = doc(db, 'users', result.user.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            // New user
            await setDoc(userRef, {
              email: result.user.email,
              displayName: result.user.displayName || '',
              photoURL: result.user.photoURL || '',
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              role: 'user'
            });
          } else {
            // Existing user - update last login
            await updateDoc(userRef, {
              lastLogin: serverTimestamp()
            });
          }
        } catch (dbErr: any) {
          console.error('Error with Firestore during Google sign-in:', dbErr);
          // Continue even if Firestore fails
        }
      }
      
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Get ID token for authenticated requests
  const getIdToken = async (): Promise<string | null> => {
    if (!auth?.currentUser) return null;
    
    try {
      const token = await auth.currentUser.getIdToken();
      return token;
    } catch (err: any) {
      console.error('Error getting ID token:', err);
      return null;
    }
  };

  const sendVerificationEmail = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    if (!auth.currentUser.email) {
      setError('Email address is missing for this account. Please verify using phone instead.');
      return false;
    }
    try {
      clearError();
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to send verification email');
      return false;
    }
  };

  const setupRecaptcha = async (containerId: string): Promise<RecaptchaVerifier> => {
    if (!auth) {
      console.info('Firebase Auth not initialized - phone auth unavailable');
      throw new Error('Firebase Auth not initialized');
    }
    const win = window as any;

    // If we already created + rendered a verifier for this same container, reuse it.
    if (win.recaptchaVerifier && win.recaptchaContainerId === containerId && win.recaptchaRendered) {
      return win.recaptchaVerifier as RecaptchaVerifier;
    }

    const container = document.getElementById(containerId);
    if (!container) throw new Error(`reCAPTCHA container not found: ${containerId}`);

    // Clear any previous widget DOM to prevent "already rendered" errors.
    try {
      container.innerHTML = '';
    } catch {
      // ignore
    }

    // Clean up existing verifier if present.
    if (win.recaptchaVerifier) {
      try {
        win.recaptchaVerifier.clear();
      } catch {
        // ignore
      }
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    });

    win.recaptchaVerifier = verifier;
    win.recaptchaContainerId = containerId;

    try {
      await verifier.render();
      win.recaptchaRendered = true;
    } catch (err: any) {
      const message = String(err?.message || err);
      if (message.toLowerCase().includes('already been rendered')) {
        // Treat as success; the widget is already attached to this element.
        win.recaptchaRendered = true;
      } else {
        throw err;
      }
    }

    return verifier;
  };

  const sendPhoneVerificationCode = async (
    phoneNumber: string,
    recaptchaVerifier: RecaptchaVerifier
  ): Promise<ConfirmationResult> => {
    if (!auth) {
      console.info('Firebase Auth not initialized - phone auth unavailable');
      throw new Error('Firebase Auth not initialized');
    }
    clearError();
    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  };

  const verifyPhoneCode = async (
    confirmationResult: ConfirmationResult,
    verificationCode: string,
    displayName?: string
  ): Promise<boolean> => {
    if (!auth) return false;
    try {
      clearError();
      const credential = await confirmationResult.confirm(verificationCode);
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to verify phone code');
      return false;
    }
  };

  // Return provider with auth values
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isFirebaseAvailable: !!auth,
        signIn,
        signUp,
        logout,
        resetPassword,
        updateUserProfile,
        signInWithGoogle,
        getIdToken,
        sendVerificationEmail,
        setupRecaptcha,
        sendPhoneVerificationCode,
        verifyPhoneCode,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext); 