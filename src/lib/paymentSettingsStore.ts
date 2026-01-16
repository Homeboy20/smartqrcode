import 'server-only';

import { createServerClient } from '@/lib/supabase/server';
import {
  decryptString,
  encryptString,
  getMaskedValue,
  isEncryptedPayload,
  isMaskedValue,
  type EncryptedPayload,
} from '@/lib/secure/credentialCrypto';

export type PaymentProvider = 'stripe' | 'paypal' | 'flutterwave' | 'paystack';

type StoredCredentials = Record<string, unknown> | null;

const SECRET_FIELDS: Record<PaymentProvider, string[]> = {
  stripe: ['secretKey', 'webhookSecret'],
  paypal: ['clientSecret'],
  flutterwave: ['clientSecret', 'encryptionKey', 'webhookSecretHash'],
  paystack: ['secretKey'],
};

function getSupabaseAdmin() {
  const client = createServerClient();
  if (!client) throw new Error('Supabase admin client not configured');
  return client;
}

export function isSecretField(provider: PaymentProvider, fieldName: string) {
  return SECRET_FIELDS[provider].includes(fieldName);
}

function maskCredentials(provider: PaymentProvider, credentials: StoredCredentials): Record<string, unknown> | null {
  if (!credentials) return null;

  const masked: Record<string, unknown> = { ...credentials };
  for (const secretField of SECRET_FIELDS[provider]) {
    const value = masked[secretField];
    if (typeof value === 'string' && value.length > 0) {
      masked[secretField] = getMaskedValue();
    } else if (isEncryptedPayload(value)) {
      masked[secretField] = getMaskedValue();
    }
  }

  return masked;
}

function decryptCredentials(provider: PaymentProvider, credentials: StoredCredentials): Record<string, string> {
  const out: Record<string, string> = {};
  if (!credentials) return out;

  for (const [key, value] of Object.entries(credentials)) {
    if (isSecretField(provider, key)) {
      if (isEncryptedPayload(value)) {
        out[key] = decryptString(value);
      } else if (typeof value === 'string') {
        // Back-compat if secrets were stored plaintext previously.
        out[key] = value;
      }
    } else {
      if (typeof value === 'string') out[key] = value;
    }
  }

  return out;
}

function mergeForStorage(
  provider: PaymentProvider,
  incoming: Record<string, unknown> | null | undefined,
  existing: StoredCredentials
): Record<string, unknown> | null {
  const normalizedExisting: Record<string, unknown> = { ...(existing ?? {}) };

  // If secrets were ever stored in plaintext historically, re-encrypt them.
  for (const secretField of SECRET_FIELDS[provider]) {
    const existingValue = normalizedExisting[secretField];
    if (typeof existingValue === 'string' && existingValue.length > 0 && !isMaskedValue(existingValue)) {
      normalizedExisting[secretField] = encryptString(existingValue);
    }
  }

  if (!incoming) return Object.keys(normalizedExisting).length > 0 ? normalizedExisting : null;

  const merged: Record<string, unknown> = { ...normalizedExisting };

  for (const [key, value] of Object.entries(incoming)) {
    if (isSecretField(provider, key)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (isMaskedValue(value) || value === '') {
        // Keep existing secret if user didn't provide a new one.
        continue;
      }
      if (typeof value === 'string') {
        merged[key] = encryptString(value);
        continue;
      }
      if (isEncryptedPayload(value)) {
        merged[key] = value;
        continue;
      }
      // Ignore invalid secret formats.
      continue;
    }

    // Non-secret fields: allow clearing by writing empty string.
    if (typeof value === 'string') {
      merged[key] = value;
    }
  }

  return merged;
}

export async function getAllPaymentSettingsForAdmin() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin.from('payment_settings').select('*');
  if (error) {
    return {
      stripe: { isActive: false, credentials: null },
      paypal: { isActive: false, credentials: null },
      flutterwave: { isActive: false, credentials: null },
      paystack: { isActive: false, credentials: null },
    };
  }

  const base = {
    stripe: { isActive: false, credentials: null as Record<string, unknown> | null },
    paypal: { isActive: false, credentials: null as Record<string, unknown> | null },
    flutterwave: { isActive: false, credentials: null as Record<string, unknown> | null },
    paystack: { isActive: false, credentials: null as Record<string, unknown> | null },
  };

  for (const row of data ?? []) {
    const provider = row.provider as PaymentProvider;
    if (!(provider in base)) continue;
    base[provider] = {
      isActive: Boolean(row.is_active),
      credentials: maskCredentials(provider, (row.credentials ?? null) as StoredCredentials),
    };
  }

  return base;
}

export async function getProviderRuntimeConfig(provider: PaymentProvider) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('payment_settings')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();

  if (error || !data) {
    return { exists: false, isActive: false, credentials: {} as Record<string, string> };
  }

  try {
    return {
      exists: true,
      isActive: Boolean(data.is_active),
      credentials: decryptCredentials(provider, (data.credentials ?? null) as StoredCredentials),
    };
  } catch (e: any) {
    const message = e?.message || 'Failed to decrypt stored payment credentials';
    // If encryption key is missing, do not hard-crash checkout flows.
    // Treat stored secrets as unavailable; callers may still fall back to env credentials.
    return {
      exists: true,
      isActive: Boolean(data.is_active),
      credentials: {} as Record<string, string>,
      decryptError: message,
    } as any;
  }
}

export async function saveProviderSettings(options: {
  provider: PaymentProvider;
  isActive?: boolean;
  credentials?: Record<string, unknown> | null;
}) {
  const { provider, isActive, credentials } = options;

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingRow } = await supabaseAdmin
    .from('payment_settings')
    .select('credentials, is_active')
    .eq('provider', provider)
    .maybeSingle();

  const mergedCredentials = mergeForStorage(
    provider,
    credentials ?? null,
    (existingRow?.credentials ?? null) as StoredCredentials
  );

  const nextIsActive = typeof isActive === 'boolean' ? isActive : Boolean(existingRow?.is_active);

  const { error } = await supabaseAdmin
    .from('payment_settings')
    .upsert(
      {
        provider,
        is_active: nextIsActive,
        credentials: mergedCredentials,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    );

  if (error) {
    throw new Error('Failed to save payment settings');
  }

  return { success: true };
}

export function mapEnvStylePaymentKeysToProviders(credentials: Record<string, string>) {
  const updates: Array<{ provider: PaymentProvider; credentials: Record<string, unknown> }> = [];

  const stripe: Record<string, unknown> = {};
  if (credentials.STRIPE_SECRET_KEY) stripe.secretKey = credentials.STRIPE_SECRET_KEY;
  if (credentials.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) stripe.publicKey = credentials.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
  if (credentials.STRIPE_WEBHOOK_SECRET) stripe.webhookSecret = credentials.STRIPE_WEBHOOK_SECRET;
  if (credentials.STRIPE_PRICE_ID_PRO) stripe.pricePro = credentials.STRIPE_PRICE_ID_PRO;
  if (credentials.STRIPE_PRICE_ID_BUSINESS) stripe.priceBusiness = credentials.STRIPE_PRICE_ID_BUSINESS;
  if (Object.keys(stripe).length > 0) updates.push({ provider: 'stripe', credentials: stripe });

  const paypal: Record<string, unknown> = {};
  if (credentials.PAYPAL_CLIENT_ID) paypal.clientId = credentials.PAYPAL_CLIENT_ID;
  if (credentials.PAYPAL_CLIENT_SECRET) paypal.clientSecret = credentials.PAYPAL_CLIENT_SECRET;
  if (credentials.PAYPAL_PLAN_ID_PRO) paypal.planIdPro = credentials.PAYPAL_PLAN_ID_PRO;
  if (credentials.PAYPAL_PLAN_ID_BUSINESS) paypal.planIdBusiness = credentials.PAYPAL_PLAN_ID_BUSINESS;
  if (Object.keys(paypal).length > 0) updates.push({ provider: 'paypal', credentials: paypal });

  const flutterwave: Record<string, unknown> = {};
  if (credentials.FLUTTERWAVE_CLIENT_ID) flutterwave.clientId = credentials.FLUTTERWAVE_CLIENT_ID;
  if (credentials.FLUTTERWAVE_CLIENT_SECRET) flutterwave.clientSecret = credentials.FLUTTERWAVE_CLIENT_SECRET;
  if (credentials.FLUTTERWAVE_ENCRYPTION_KEY) flutterwave.encryptionKey = credentials.FLUTTERWAVE_ENCRYPTION_KEY;
  if (Object.keys(flutterwave).length > 0) updates.push({ provider: 'flutterwave', credentials: flutterwave });

  const paystack: Record<string, unknown> = {};
  if (credentials.PAYSTACK_PUBLIC_KEY) paystack.publicKey = credentials.PAYSTACK_PUBLIC_KEY;
  if (credentials.PAYSTACK_SECRET_KEY) paystack.secretKey = credentials.PAYSTACK_SECRET_KEY;
  if (credentials.PAYSTACK_PLAN_CODE_PRO) paystack.planCodePro = credentials.PAYSTACK_PLAN_CODE_PRO;
  if (credentials.PAYSTACK_PLAN_CODE_BUSINESS) paystack.planCodeBusiness = credentials.PAYSTACK_PLAN_CODE_BUSINESS;
  // Also support NEXT_PUBLIC naming.
  if (credentials.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY && !paystack.publicKey) paystack.publicKey = credentials.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (Object.keys(paystack).length > 0) updates.push({ provider: 'paystack', credentials: paystack });

  return updates;
}

export async function reencryptAllPaymentSettingsSecrets() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin.from('payment_settings').select('*');
  if (error) {
    throw new Error('Failed to fetch payment settings');
  }

  let scanned = 0;
  let updated = 0;
  const updatedProviders: PaymentProvider[] = [];

  for (const row of data ?? []) {
    const provider = row.provider as PaymentProvider;
    if (!provider || !(provider in SECRET_FIELDS)) continue;

    scanned += 1;

    const existingCredentials = (row.credentials ?? null) as StoredCredentials;
    if (!existingCredentials || typeof existingCredentials !== 'object') continue;

    // Normalize by encrypting any plaintext secrets.
    const normalized = mergeForStorage(provider, null, existingCredentials);

    // Determine if anything changed by checking for plaintext secret strings.
    let hadPlaintext = false;
    for (const secretField of SECRET_FIELDS[provider]) {
      const v = (existingCredentials as any)[secretField];
      if (typeof v === 'string' && v.length > 0 && !isMaskedValue(v)) {
        hadPlaintext = true;
        break;
      }
    }

    if (!hadPlaintext) continue;

    const { error: upsertError } = await supabaseAdmin
      .from('payment_settings')
      .upsert(
        {
          provider,
          is_active: Boolean(row.is_active),
          credentials: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider' }
      );

    if (upsertError) {
      throw new Error('Failed to update payment settings');
    }

    updated += 1;
    updatedProviders.push(provider);
  }

  return { scanned, updated, updatedProviders };
}
