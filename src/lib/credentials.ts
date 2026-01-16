import 'server-only';

import { getProviderRuntimeConfig, type PaymentProvider } from '@/lib/paymentSettingsStore';

/**
 * Map of environment-style credential keys to payment providers and fields
 */
const CREDENTIAL_MAP: Record<string, { provider: PaymentProvider; field: string } | null> = {
  // Stripe
  STRIPE_SECRET_KEY: { provider: 'stripe', field: 'secretKey' },
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: { provider: 'stripe', field: 'publicKey' },
  STRIPE_WEBHOOK_SECRET: { provider: 'stripe', field: 'webhookSecret' },
  STRIPE_PRICE_ID_PRO: { provider: 'stripe', field: 'pricePro' },
  STRIPE_PRICE_ID_BUSINESS: { provider: 'stripe', field: 'priceBusiness' },
  
  // PayPal
  PAYPAL_CLIENT_ID: { provider: 'paypal', field: 'clientId' },
  PAYPAL_CLIENT_SECRET: { provider: 'paypal', field: 'clientSecret' },
  PAYPAL_PLAN_ID_PRO: { provider: 'paypal', field: 'planIdPro' },
  PAYPAL_PLAN_ID_BUSINESS: { provider: 'paypal', field: 'planIdBusiness' },
  
  // Flutterwave
  FLUTTERWAVE_CLIENT_ID: { provider: 'flutterwave', field: 'clientId' },
  FLUTTERWAVE_CLIENT_SECRET: { provider: 'flutterwave', field: 'clientSecret' },
  FLUTTERWAVE_ENCRYPTION_KEY: { provider: 'flutterwave', field: 'encryptionKey' },
  // Webhook signature secret hash (Flutterwave dashboard)
  FLW_SECRET_HASH: { provider: 'flutterwave', field: 'webhookSecretHash' },
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: { provider: 'flutterwave', field: 'webhookSecretHash' },
  FLUTTERWAVE_SECRET_HASH: { provider: 'flutterwave', field: 'webhookSecretHash' },
  
  // Paystack
  PAYSTACK_PUBLIC_KEY: { provider: 'paystack', field: 'publicKey' },
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: { provider: 'paystack', field: 'publicKey' },
  PAYSTACK_SECRET_KEY: { provider: 'paystack', field: 'secretKey' },
  PAYSTACK_PLAN_CODE_PRO: { provider: 'paystack', field: 'planCodePro' },
  PAYSTACK_PLAN_CODE_BUSINESS: { provider: 'paystack', field: 'planCodeBusiness' },
};

/**
 * Get a credential.
 *
 * Payment credentials (Stripe/PayPal/Flutterwave/Paystack) are sourced ONLY from
 * the `payment_settings` table managed via `/admin/payment-settings`.
 *
 * Non-payment credentials may still come from environment variables.
 * @param key The credential key to retrieve (e.g., 'STRIPE_SECRET_KEY')
 * @returns The credential value or null if not found
 */
export async function getCredential(key: string): Promise<string | null> {
  try {
    // Payment provider credentials: DB-only (no env fallback)
    const mapping = CREDENTIAL_MAP[key];
    if (mapping) {
      const config = await getProviderRuntimeConfig(mapping.provider);
      const value = config.credentials[mapping.field];
      return typeof value === 'string' ? value : null;
    }

    // Non-payment credentials: env-only
    if (process.env[key]) {
      return process.env[key] as string;
    }
    
    return null;
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
  const value = await getCredential(key);
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
  // Webhook secret hash (set in Flutterwave dashboard)
  FLUTTERWAVE_WEBHOOK_SECRET_HASH?: string;
  // Alternative env key used in Flutterwave docs/examples
  FLW_SECRET_HASH?: string;
}

