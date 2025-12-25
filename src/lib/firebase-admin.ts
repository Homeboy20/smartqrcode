import admin from 'firebase-admin';

// Initialize Firebase Admin SDK only if it hasn't been initialized yet
if (!admin.apps.length) {
  try {
    console.log('Attempting to initialize Firebase Admin SDK...');
    
    // Check if we have environment variables for service account
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_CLIENT_EMAIL && 
        process.env.FIREBASE_PRIVATE_KEY) {
      
      console.log('Initializing Firebase Admin with environment variables...');
      
      // Process the private key to handle different formats
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Handle escaped newlines from environment variables
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Remove any surrounding quotes that might be added by Coolify/Docker
      privateKey = privateKey.replace(/^["']|["']$/g, '');
      
      console.log('Private key starts with:', privateKey.substring(0, 30));
      console.log('Private key ends with:', privateKey.substring(privateKey.length - 30));
      
      // Initialize with environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
      });
      
      console.log('Firebase Admin SDK initialized with environment variables.');
    } 
    // Fallback to application default credentials if available
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('Initializing Firebase Admin with application default credentials...');
      
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      
      console.log('Firebase Admin SDK initialized with application default credentials.');
    }
    else {
      throw new Error(
        'Firebase Admin SDK initialization failed: Missing credentials. ' +
        'Please provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY ' +
        'environment variables or set GOOGLE_APPLICATION_CREDENTIALS.'
      );
    }
  } catch (error: any) {
    console.error('Firebase Admin SDK Initialization Error:', error);
    
    // Log additional details for debugging
    if (error.message) console.error('Error Message:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.stack) console.error('Error Stack:', error.stack);
    
    // Check if there's an issue with the private key format
    if (process.env.FIREBASE_PRIVATE_KEY && 
        error.message && 
        error.message.includes('private_key')) {
      console.error(
        'There might be an issue with your private key format. ' +
        'Make sure it includes the BEGIN and END markers and proper newlines (\\n).'
      );
    }
    
    // Check for time sync issues
    if (error.message && error.message.includes('invalid_grant')) {
      console.error(
        'There might be an issue with your server time synchronization or the service account key has been revoked. ' +
        'Please check your system time or generate a new service account key from the Firebase console.'
      );
    }
  }
} else {
  // If already initialized (e.g., due to hot-reloading in dev), get the default app
  console.log('Firebase Admin SDK already initialized');
  admin.app(); 
}

// Export admin services
const adminDb = admin.firestore();
const adminAuth = admin.auth();

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