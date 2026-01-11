'use client';

import { initializeApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getClientFirebaseConfig } from '@/lib/credentials.client';

// Initialize Firebase with environment variables
let firebaseApp: FirebaseApp | undefined;

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

// Check if we're in the browser
const isBrowser = typeof window !== 'undefined';

// Explicit typed null values for services
let auth = undefined as unknown as Auth;
let db = undefined as unknown as Firestore;
let storage = undefined as unknown as FirebaseStorage;

let firebaseAvailable = false;

// Function to initialize Firebase
const initializeFirebase = () => {
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
        if (isDev) console.log('✅ Using existing Firebase app');
      } else {
        // Otherwise initialize a new app
        firebaseApp = initializeApp(config);
        if (isDev) console.log('✅ Firebase initialized successfully');
      }
      
      // If we have a valid app, initialize services
      if (firebaseApp) {
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        storage = getStorage(firebaseApp);
        firebaseAvailable = true;
        return true;
      }
    } else {
      // Firebase not configured - this is optional, no error needed
      if (isDev) {
        console.log('⚠️ Firebase not configured (missing:', missingConfig.join(', ') + ')');
        console.log('Firebase is optional. Configure in Admin Panel → App Settings if needed.');
      }
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
  }
  return false;
};

// Debounce timer for re-initialization
let reinitTimer: NodeJS.Timeout | null = null;
let isReinitializing = false;

// Re-initialize Firebase when settings change
export const reinitializeFirebase = async () => {
  if (!isBrowser) return false;
  
  // Debounce: clear any pending re-initialization
  if (reinitTimer) {
    clearTimeout(reinitTimer);
    reinitTimer = null;
  }
  
  // Prevent concurrent re-initialization
  if (isReinitializing) {
    if (isDev) console.log('⏳ Firebase re-initialization already in progress, skipping...');
    return false;
  }
  
  return new Promise((resolve) => {
    reinitTimer = setTimeout(async () => {
      reinitTimer = null;
      isReinitializing = true;
      
      try {
        // Clear service references first to prevent usage after deletion
        firebaseAvailable = false;
        auth = undefined as unknown as Auth;
        db = undefined as unknown as Firestore;
        storage = undefined as unknown as FirebaseStorage;
        
        // Delete existing app if it exists
        if (firebaseApp) {
          try {
            // Wait a brief moment for pending operations to complete
            await new Promise(r => setTimeout(r, 100));
            await deleteApp(firebaseApp);
            firebaseApp = undefined;
            if (isDev) console.log('🗑️ Firebase app deleted');
          } catch (deleteError) {
            // Silently handle "app already deleted" errors
            if (isDev && !String(deleteError).includes('already deleted')) {
              console.warn('Firebase deletion warning:', deleteError);
            }
            firebaseApp = undefined;
          }
        }
        
        // Re-initialize after a brief delay
        await new Promise(r => setTimeout(r, 200));
        const success = initializeFirebase();
        resolve(success);
      } catch (error) {
        console.error('Error reinitializing Firebase:', error);
        resolve(false);
      } finally {
        isReinitializing = false;
      }
    }, 300); // 300ms debounce
  });
};

// Initialize Firebase only on the client side
if (isBrowser) {
  // Delay initialization to allow app settings to load first
  setTimeout(() => {
    const success = initializeFirebase();
    if (!success) {
      if (isDev) console.log('⏳ Firebase initialization deferred - waiting for app settings to load...');
    }
  }, 100);
  
  // Track last event time to prevent duplicate triggers
  let lastSettingsUpdate = 0;
  let lastFirebaseUpdate = 0;
  
  // Listen for settings updates (debounced)
  window.addEventListener('app-settings-updated', () => {
    const now = Date.now();
    if (now - lastSettingsUpdate < 500) return; // Ignore rapid-fire events
    lastSettingsUpdate = now;
    
    if (isDev) console.log('📱 App settings updated, reinitializing Firebase...');
    reinitializeFirebase();
  });
  
  // Listen for Firebase config updates specifically (debounced)
  window.addEventListener('firebase-config-updated', () => {
    const now = Date.now();
    if (now - lastFirebaseUpdate < 500) return; // Ignore rapid-fire events
    lastFirebaseUpdate = now;
    
    if (isDev) console.log('🔥 Firebase config updated from database, reinitializing...');
    reinitializeFirebase();
  });
}

// Export the initialized services and app
export { auth, db, storage, firebaseApp as app };

// Export a function to check if Firebase is available
export const isFirebaseAvailable = (): boolean => {
  return isBrowser && firebaseAvailable;
}; 