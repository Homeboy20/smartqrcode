import 'server-only';

import { getAllDecryptedCredentials, getDecryptedCredential } from '@/lib/credentialsVault.server';

/**
 * Get a credential from either environment variables or encrypted storage
 * @param key The credential key to retrieve
 * @returns The credential value or null if not found
 */
export async function getCredential(key: string): Promise<string | null> {
  try {
    // First check environment variables
    if (process.env[key]) {
      return process.env[key] as string;
    }
    
    // If not in environment, get from encrypted storage via API
    return await getDecryptedCredential(key);
  } catch (error) {
    console.error(`Error retrieving credential ${key}:`, error);
    return null;
  }
}

/**
 * Get multiple credentials at once
 * @param keys Array of credential keys to retrieve
 * @returns Array of credential values in same order as keys
 */
export async function getCredentials(keys: string[]): Promise<string[]> {
  const results: string[] = [];
  
  for (const key of keys) {
    const value = await getCredential(key);
    results.push(value || '');
  }
  
  return results;
}

/**
 * Check if a credential exists
 * @param key The credential key to check
 * @returns True if the credential exists, false otherwise
 */
export async function hasCredential(key: string): Promise<boolean> {
  const value = await getDecryptedCredential(key);
  return value !== null && value !== '';
}

// Interface for Firebase credentials
export interface FirebaseCredentials {
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
}

// Interface for payment credentials
export interface PaymentCredentials {
  // Stripe
  STRIPE_SECRET_KEY: string;
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_PRICE_ID_BUSINESS?: string;
  
  // PayPal
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_PLAN_ID_PRO?: string;
  PAYPAL_PLAN_ID_BUSINESS?: string;
  
  // Flutterwave
  FLUTTERWAVE_CLIENT_ID: string;
  FLUTTERWAVE_CLIENT_SECRET: string;
  FLUTTERWAVE_ENCRYPTION_KEY?: string;
}

// Get all Firebase credentials
export async function getFirebaseCredentials(): Promise<FirebaseCredentials | null> {
  try {
    const allCreds = await getAllDecryptedCredentials();
    
    // Check if all required Firebase credentials are available
    const requiredKeys = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ];
    
    // If any required credential is missing, return null
    const missingKeys = requiredKeys.filter(key => !allCreds[key]);
    if (missingKeys.length > 0) {
      console.warn('Missing Firebase credentials:', missingKeys);
      return null;
    }
    
    // Extract Firebase credentials
    const firebaseCreds: FirebaseCredentials = {
      NEXT_PUBLIC_FIREBASE_API_KEY: allCreds.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: allCreds.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: allCreds.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: allCreds.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: allCreds.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: allCreds.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    
    // Add optional measurement ID if available
    if (allCreds.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
      firebaseCreds.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = allCreds.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
    }
    
    return firebaseCreds;
  } catch (error) {
    console.error('Error getting Firebase credentials:', error);
    return null;
  }
}

// Get credentials for a specific payment gateway
export async function getPaymentGatewayCredentials(gateway: 'stripe' | 'paypal' | 'flutterwave'): Promise<Record<string, string> | null> {
  try {
    const allCreds = await getAllDecryptedCredentials();
    
    const gatewayCredentials: Record<string, string> = {};
    
    switch (gateway) {
      case 'stripe':
        if (!allCreds.STRIPE_SECRET_KEY || !allCreds.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) {
          return null;
        }
        gatewayCredentials.STRIPE_SECRET_KEY = allCreds.STRIPE_SECRET_KEY;
        gatewayCredentials.NEXT_PUBLIC_STRIPE_PUBLIC_KEY = allCreds.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
        if (allCreds.STRIPE_WEBHOOK_SECRET) {
          gatewayCredentials.STRIPE_WEBHOOK_SECRET = allCreds.STRIPE_WEBHOOK_SECRET;
        }
        if (allCreds.STRIPE_PRICE_ID_PRO) {
          gatewayCredentials.STRIPE_PRICE_ID_PRO = allCreds.STRIPE_PRICE_ID_PRO;
        }
        if (allCreds.STRIPE_PRICE_ID_BUSINESS) {
          gatewayCredentials.STRIPE_PRICE_ID_BUSINESS = allCreds.STRIPE_PRICE_ID_BUSINESS;
        }
        break;
        
      case 'paypal':
        if (!allCreds.PAYPAL_CLIENT_ID || !allCreds.PAYPAL_CLIENT_SECRET) {
          return null;
        }
        gatewayCredentials.PAYPAL_CLIENT_ID = allCreds.PAYPAL_CLIENT_ID;
        gatewayCredentials.PAYPAL_CLIENT_SECRET = allCreds.PAYPAL_CLIENT_SECRET;
        if (allCreds.PAYPAL_PLAN_ID_PRO) {
          gatewayCredentials.PAYPAL_PLAN_ID_PRO = allCreds.PAYPAL_PLAN_ID_PRO;
        }
        if (allCreds.PAYPAL_PLAN_ID_BUSINESS) {
          gatewayCredentials.PAYPAL_PLAN_ID_BUSINESS = allCreds.PAYPAL_PLAN_ID_BUSINESS;
        }
        break;
        
      case 'flutterwave':
        if (!allCreds.FLUTTERWAVE_CLIENT_ID || !allCreds.FLUTTERWAVE_CLIENT_SECRET) {
          return null;
        }
        gatewayCredentials.FLUTTERWAVE_CLIENT_ID = allCreds.FLUTTERWAVE_CLIENT_ID;
        gatewayCredentials.FLUTTERWAVE_CLIENT_SECRET = allCreds.FLUTTERWAVE_CLIENT_SECRET;
        if (allCreds.FLUTTERWAVE_ENCRYPTION_KEY) {
          gatewayCredentials.FLUTTERWAVE_ENCRYPTION_KEY = allCreds.FLUTTERWAVE_ENCRYPTION_KEY;
        }
        break;
        
      default:
        return null;
    }
    
    return gatewayCredentials;
  } catch (error) {
    console.error(`Error getting ${gateway} credentials:`, error);
    return null;
  }
}

// Check if all required Firebase credentials are available
export async function hasFirebaseCredentials(): Promise<boolean> {
  const creds = await getFirebaseCredentials();
  return creds !== null;
}

// Function to get credentials with environment variable fallback
// This allows the app to use credentials from .env files if they're not in the database
export async function getCredentialWithFallback(key: string): Promise<string | undefined> {
  // First try to get from the database
  const value = await getDecryptedCredential(key);
  
  // If found in database, return it
  if (value) {
    return value;
  }
  
  // Otherwise fall back to environment variable
  return process.env[key];
}
