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
 * On the server this reads from `process.env`.
 * On the client, Next injects `NEXT_PUBLIC_*` values.
 */
export function getClientFirebaseConfig(): Record<string, string | undefined> {
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
