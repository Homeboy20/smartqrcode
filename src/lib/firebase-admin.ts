import admin from 'firebase-admin';

function normalizePrivateKey(raw: string) {
  let privateKey = raw;
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  // Remove any surrounding quotes that might be added by Docker/CI.
  privateKey = privateKey.replace(/^["']|["']$/g, '');
  return privateKey;
}

/**
 * IMPORTANT:
 * Next.js may import route handler modules during build to analyze exports.
 * This file must be safe to import even when Firebase Admin credentials are missing.
 *
 * We only initialize the Admin SDK when credentials exist, and we avoid calling
 * admin.auth()/admin.firestore() unless an app is initialized.
 */
function tryInitializeAdmin() {
  if (admin.apps.length) return;

  const hasServiceAccountEnv =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY;

  try {
    if (hasServiceAccountEnv) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY as string),
        }),
        databaseURL:
          process.env.FIREBASE_DATABASE_URL ||
          `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
      });
      return;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      return;
    }

    // No credentials: do not throw. Features that depend on Firebase Admin
    // should fail gracefully at request-time instead.
  } catch (error: any) {
    console.error('Firebase Admin SDK Initialization Error:', error?.message || error);
  }
}

function createMissingProxy(name: string) {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `Firebase Admin SDK is not configured (missing credentials). Attempted to access ${name}.`
        );
      },
    }
  );
}

tryInitializeAdmin();

// Export admin services (safe at build-time)
const adminDb = admin.apps.length ? admin.firestore() : (createMissingProxy('firestore') as any);
const adminAuth = admin.apps.length ? admin.auth() : (createMissingProxy('auth') as any);

// Aliases for backward compatibility
const db = adminDb;
const auth = adminAuth;

// Export validation function to check if connection is working
export async function validateFirebaseAdminConnection() {
  try {
    // Try to access Firestore
    await adminDb.collection('_test_').doc('_test_').get();
    console.log('✅ Firestore connection verified');
    
    // Try to access Auth
    await adminAuth.listUsers(1);
    console.log('✅ Firebase Auth connection verified');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Firebase Admin connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Export both the main variables and aliases for backward compatibility
export { adminDb, adminAuth, db, auth }; 