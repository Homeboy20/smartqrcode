'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getClientFirebaseConfig } from '@/lib/credentials';

// Initialize Firebase with environment variables
let firebaseApp: FirebaseApp | undefined;

// Check if we're in the browser
const isBrowser = typeof window !== 'undefined';

// Explicit typed null values for services
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

// Initialize Firebase only on the client side
if (isBrowser) {
  try {
    // Get Firebase configuration
    const config = getClientFirebaseConfig();
    
    // Check if essential config values are present
    const missingConfig = Object.entries(config)
      .filter(([key, value]) => key !== 'measurementId' && !value) // measurementId is optional
      .map(([key]) => key);
    
    if (missingConfig.length === 0) {
      // Use existing app instance if available
      if (getApps().length > 0) {
        firebaseApp = getApps()[0];
        console.log('Using existing Firebase app');
      } else {
        // Otherwise initialize a new app
        firebaseApp = initializeApp(config);
        console.log('Firebase initialized successfully');
      }
      
      // If we have a valid app, initialize services
      if (firebaseApp) {
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        storage = getStorage(firebaseApp);
      }
    } else {
      console.error(`Missing Firebase config values: ${missingConfig.join(', ')}`);
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
}

// Export the initialized services and app
export { auth, db, storage, firebaseApp as app };

// Export a function to check if Firebase is available
export const isFirebaseAvailable = (): boolean => {
  return isBrowser && !!firebaseApp && !!auth && !!db;
}; 