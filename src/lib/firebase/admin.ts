'use server';

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Initialize Firebase Admin SDK lazily
function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }
  
  // Check if required env vars are present
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin SDK: Missing required environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    return null;
  }
  
  try {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    
    console.log('Firebase Admin SDK initialized successfully');
    return adminApp;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    return null;
  }
}

// Lazy getters for auth and db
function getAdminAuth(): Auth | null {
  if (auth) return auth;
  const app = getAdminApp();
  if (!app) return null;
  auth = getAuth(app);
  return auth;
}

function getAdminDb(): Firestore | null {
  if (db) return db;
  const app = getAdminApp();
  if (!app) return null;
  db = getFirestore(app);
  return db;
}

// Export getters that lazily initialize
export { getAdminAuth as auth, getAdminDb as db };

// Verify user authentication and admin status
export async function verifyAuth(token: string) {
  const authInstance = getAdminAuth();
  const dbInstance = getAdminDb();
  
  if (!authInstance || !dbInstance) {
    console.error('Firebase Admin SDK not initialized');
    return { 
      isAuthenticated: false, 
      isAdmin: false,
      user: null,
      error: 'Firebase Admin SDK not configured'
    };
  }
  
  try {
    // Verify the ID token
    const decodedToken = await authInstance.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Get the user record
    const userRecord = await authInstance.getUser(uid);
    
    // Check if user is an admin by querying Firestore
    const userDoc = await dbInstance.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};
    const isAdmin = userData.role === 'admin';
    
    return { 
      isAuthenticated: true, 
      isAdmin,
      user: userRecord
    };
  } catch (error) {
    console.error('Error verifying authentication:', error);
    return { 
      isAuthenticated: false, 
      isAdmin: false,
      user: null
    };
  }
} 