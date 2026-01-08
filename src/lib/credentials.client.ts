/**
 * Client-safe credential helpers.
 *
 * IMPORTANT: This file must not import any server-only modules.
 */

/**
 * Get a credential from environment variables (client side).
 * Only `NEXT_PUBLIC_*` vars are accessible to the browser.
 */
export function getClientCredential(key: string): string | null {
  if (typeof window !== 'undefined' && key.startsWith('NEXT_PUBLIC_') && process.env[key]) {
    return process.env[key] as string;
  }
  return null;
}

/**
 * Get Firebase configuration for client initialization.
 *
 * Priority order:
 * 1. Database configuration (from admin panel via /api/app-settings)
 * 2. Environment variables (NEXT_PUBLIC_*)
 */
export function getClientFirebaseConfig(): Record<string, string | undefined> {
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
  
  // Try to get from cached app settings first
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('app_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.settings?.firebase?.enabled) {
          const fb = parsed.settings.firebase;
          // Only use if at least the essential fields are present
          if (fb.apiKey && fb.projectId) {
            if (isDev) console.log('🔥 Firebase config loaded from database (cached)');
            return {
              apiKey: fb.apiKey,
              authDomain: fb.authDomain,
              projectId: fb.projectId,
              storageBucket: fb.storageBucket,
              messagingSenderId: fb.messagingSenderId,
              appId: fb.appId,
              measurementId: fb.measurementId,
            };
          }
        } else if (isDev && parsed.settings?.firebase) {
          console.log('⚠️ Firebase disabled in app_settings');
        }
      }
    } catch (e) {
      console.error('Error reading Firebase config from app_settings:', e);
    }
  }

  // Fall back to environment variables
  if (typeof window === 'undefined') {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };
  }

  if (isDev) console.log('🔥 Firebase config using environment variables');
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  };
}
