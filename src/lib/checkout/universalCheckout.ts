import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

import { getProviderRuntimeConfig, type PaymentProvider } from '@/lib/paymentSettingsStore';
import { createPaystackCustomer, getPaystackPublicKey, initializeSubscriptionPayment } from '@/lib/paystack';
import {
  createFlutterwaveSubscriptionPayment,
  getFlutterwavePaymentOptionsForCheckoutMethod,
  getFlutterwavePaymentOptionsForCountry,
} from '@/lib/flutterwave';
import { CURRENCY_CONFIGS, SUBSCRIPTION_PRICING, getLocalPrice, getRecommendedProvider, type CurrencyCode } from '@/lib/currency';

import {
  providerSupportsPaymentMethod,
  getSupportedPaymentMethodsForContext,
  type CheckoutPaymentMethod,
} from '@/lib/checkout/paymentMethodSupport';

const PROVIDER_CURRENCY_SUPPORT: Record<PaymentProvider, CurrencyCode[]> = {
  // Paystack is used for NG/GH/ZA pricing in this app.
  paystack: ['NGN', 'GHS', 'ZAR', 'KES'],
  // Flutterwave is our default for USD/EUR and also supports several African currencies.
  flutterwave: [
    'USD',
    'EUR',
    'GBP',
    'NGN',
    'GHS',
    'KES',
    'ZAR',
    'TZS',
    'UGX',
    'RWF',
    'ZMW',
    'XOF',
    'XAF',
    'EGP',
    'MAD',
    'ETB',
    'DZD',
    'TND',
    'MUR',
    'BWP',
    'NAD',
    'MWK',
    'MZN',
    'AOA',
    'CVE',
    'SCR',
    'GMD',
    'SLL',
    'LRD',
    'CDF',
    'SDG',
    'ZWL',
    'DJF',
    'SOS',
    'KMF',
    'LSL',
    'SZL',
    'MGA',
  ],
  // Not integrated (kept disabled)
  stripe: [],
  paypal: [],
};

export function providerSupportsCurrency(provider: PaymentProvider, currency: CurrencyCode): boolean {
  const allowed = PROVIDER_CURRENCY_SUPPORT[provider] || [];
  return allowed.includes(currency);
}

const PAYSTACK_SUPPORTED_COUNTRIES = new Set<string>([
  'NG',
  'GH',
  'ZA',
  // Paystack supports Kenya (KES) products for many accounts.
  'KE',
]);

const PROVIDER_COUNTRY_SUPPORT: Record<PaymentProvider, Set<string> | 'ALL'> = {
  // Keep Paystack supported countries explicit so it's not accidentally
  // constrained by our local pricing/recommended-provider config.
  paystack: PAYSTACK_SUPPORTED_COUNTRIES,
  // Flutterwave is our global provider in this app.
  flutterwave: 'ALL',
  // Not integrated (kept disabled)
  stripe: new Set<string>(),
  paypal: new Set<string>(),
};

export function getProviderSupportedCountriesSnapshot(provider: PaymentProvider): 'ALL' | string[] {
  const allowed = PROVIDER_COUNTRY_SUPPORT[provider];
  if (allowed === 'ALL') return 'ALL';
  return Array.from(allowed || []).sort();
}

export function providerSupportsCountry(provider: PaymentProvider, countryCode: string): boolean {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return false;
  const allowed = PROVIDER_COUNTRY_SUPPORT[provider];
  if (allowed === 'ALL') return true;
  return Boolean(allowed?.has(normalized));
}

export type CheckoutPlanId = 'pro' | 'business';

export type BillingInterval = 'monthly' | 'yearly' | 'trial';

function getPaidTrialConfig(): { days: number; multiplier: number } {
  const daysRaw = Number(process.env.PAID_TRIAL_DAYS ?? 7);
  const multiplierRaw = Number(process.env.PAID_TRIAL_MULTIPLIER ?? 0.3);

  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(31, Math.floor(daysRaw))) : 7;
  const multiplier = Number.isFinite(multiplierRaw)
    ? Math.max(0.05, Math.min(1, multiplierRaw))
    : 0.3;

  return { days, multiplier };
}

function normalizeBillingInterval(value: unknown): BillingInterval {
  const s = String(value || '').toLowerCase().trim();
  if (s === 'yearly') return 'yearly';
  if (s === 'trial') return 'trial';
  return 'monthly';
}

export type CheckoutSessionResult = {
  provider: PaymentProvider;
  reference: string;
  url: string;
  testMode: boolean;
  inline?: {
    paystack?: {
      publicKey: string;
      accessCode: string;
    };
    flutterwave?: {
      publicKey: string;
      amount: number;
      currency: CurrencyCode;
      paymentOptions: string;
      redirectUrl: string;
      customerName: string;
      meta: Record<string, any>;
    };
  };
  // Optional gateway-specific fields (kept for back-compat with existing API)
  flwRef?: string;
};

export type CheckoutSessionInput = {
  planId: CheckoutPlanId;
  billingInterval?: BillingInterval;
  currency: CurrencyCode;
  countryCode: string;
  successUrl: string;
  cancelUrl: string;
  email: string;
  paymentMethod?: CheckoutPaymentMethod;
  provider?: PaymentProvider;
  idempotencyKey?: string;

  // Auth/context
  user?: any;
  supabaseAdmin: SupabaseClient;
};

type CheckoutAdapter = {
  provider: PaymentProvider;
  createSession: (options: {
    input: CheckoutSessionInput;
    amount: number;
    reference: string;
    userId: string;
  }) => Promise<CheckoutSessionResult>;
};

function appendQueryParam(url: string, key: string, value: string): string {
  // Support both absolute and relative URLs.
  // If relative, return relative (path + query + hash) without the dummy origin.
  const dummyOrigin = 'http://localhost';
  const isAbsolute = /^https?:\/\//i.test(url);

  const u = new URL(url, isAbsolute ? undefined : dummyOrigin);
  u.searchParams.set(key, value);
  if (isAbsolute) return u.toString();
  return `${u.pathname}${u.search}${u.hash}`;
}

const ADAPTERS: Record<PaymentProvider, CheckoutAdapter> = {
  paystack: {
    provider: 'paystack',
    async createSession({ input, amount, reference, userId }) {
      const paystackRuntime = await getProviderRuntimeConfig('paystack');

      const interval: BillingInterval =
        input.billingInterval === 'yearly' ? 'yearly' : input.billingInterval === 'trial' ? 'trial' : 'monthly';

      const planCodeForCurrency = (planId: CheckoutPlanId, currency: CurrencyCode, interval: BillingInterval): string => {
        const creds: any = (paystackRuntime as any)?.credentials || {};

        if (interval === 'yearly') {
          // Optional KES-specific yearly plan codes.
          if (currency === 'KES') {
            const kes = planId === 'pro' ? creds.planCodeProYearlyKes : creds.planCodeBusinessYearlyKes;
            if (typeof kes === 'string' && kes.trim()) return kes.trim();
          }

          const fallback = planId === 'pro' ? creds.planCodeProYearly : creds.planCodeBusinessYearly;
          return typeof fallback === 'string' ? fallback.trim() : '';
        }

        // Optional KES-specific plan codes.
        if (currency === 'KES') {
          const kes = planId === 'pro' ? creds.planCodeProKes : creds.planCodeBusinessKes;
          if (typeof kes === 'string' && kes.trim()) return kes.trim();
        }

        const fallback = planId === 'pro' ? creds.planCodePro : creds.planCodeBusiness;
        return typeof fallback === 'string' ? fallback.trim() : '';
      };

      const planCode = interval === 'trial' ? '' : planCodeForCurrency(input.planId, input.currency, interval);

      if (interval !== 'trial' && !planCode) {
        throw new Error(
          interval === 'yearly'
            ? input.currency === 'KES'
              ? 'Missing Paystack yearly plan code for KES. Configure Pro/Business Plan Code (KES, Yearly) in admin payment settings.'
              : 'Missing Paystack yearly plan code. Configure Pro/Business Plan Code (Yearly) in admin payment settings.'
            : input.currency === 'KES'
              ? 'Missing Paystack plan code for KES. Configure Pro/Business Plan Code (KES) in admin payment settings.'
              : 'Invalid plan ID for Paystack. Available plans: pro, business'
        );
      }

      // Only look up customer code if user is authenticated
      if (input.user?.id) {
        const { data: userData } = await input.supabaseAdmin
          .from('users')
          .select('paystack_customer_code')
          .eq('id', input.user.id)
          .single();

        let paystackCustomerCode = userData?.paystack_customer_code as string | undefined;

        if (!paystackCustomerCode) {
          const paystackCustomer = await createPaystackCustomer({
            email: input.email,
            firstName: input.user.user_metadata?.full_name?.split(' ')[0] || undefined,
            lastName: input.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined,
            metadata: {
              userId: input.user.id,
            },
          });

          paystackCustomerCode = paystackCustomer.customer_code;

          await input.supabaseAdmin
            .from('users')
            .update({ paystack_customer_code: paystackCustomerCode })
            .eq('id', input.user.id);
        }
      }

      const payment = await initializeSubscriptionPayment({
        email: input.email,
        amount,
        currency: input.currency,
        plan: planCode || undefined,
        reference,
        callbackUrl: appendQueryParam(input.successUrl, 'reference', reference),
        metadata: {
          userId,
          planId: input.planId,
          billingInterval: interval,
          userEmail: input.email,
          provider: 'paystack',
          paymentMethod: input.paymentMethod || 'card',
          currency: input.currency,
          countryCode: input.countryCode,
        },
      });

      const publicKey = (await getPaystackPublicKey()) || '';
      const accessCode = String((payment as any)?.access_code || '').trim();

      return {
        provider: 'paystack',
        reference,
        url: payment.authorization_url,
        testMode: process.env.NODE_ENV !== 'production',
        inline:
          publicKey && accessCode
            ? {
                paystack: {
                  publicKey,
                  accessCode,
                },
              }
            : undefined,
      };
    },
  },

  flutterwave: {
    provider: 'flutterwave',
    async createSession({ input, amount, reference, userId }) {
      const planName = `${input.planId.charAt(0).toUpperCase() + input.planId.slice(1)} Plan`;

      const customerName = input.user?.user_metadata?.full_name || input.email.split('@')[0];

      const flutterwavePaymentMethod: 'card' | 'mobile_money' | undefined =
        input.paymentMethod === 'mobile_money'
          ? 'mobile_money'
          : input.paymentMethod === 'card'
            ? 'card'
            : undefined;

      const meta = {
        userId,
        planId: input.planId,
        billingInterval:
          input.billingInterval === 'yearly' ? 'yearly' : input.billingInterval === 'trial' ? 'trial' : 'monthly',
        userEmail: input.email,
        provider: 'flutterwave',
        paymentMethod: input.paymentMethod || 'card',
        currency: input.currency,
        countryCode: input.countryCode,
      };

      const flutterwaveRuntime = await getProviderRuntimeConfig('flutterwave');
      const flutterwavePublicKey = String((flutterwaveRuntime as any)?.credentials?.clientId || '').trim();
      const paymentOptions = getFlutterwavePaymentOptionsForCountry({
        countryCode: input.countryCode,
        method: flutterwavePaymentMethod,
      });
      const redirectUrl = appendQueryParam(input.successUrl, 'reference', reference);

      const payment = await createFlutterwaveSubscriptionPayment({
        amount,
        currency: input.currency,
        customerEmail: input.email,
        customerName,
        planName,
        reference,
        redirectUrl,
        paymentMethod: flutterwavePaymentMethod,
        metadata: meta,
        testMode: process.env.NODE_ENV !== 'production',
      });

      return {
        provider: 'flutterwave',
        reference,
        url: payment.paymentLink,
        flwRef: payment.flwRef,
        testMode: process.env.NODE_ENV !== 'production',
        inline: flutterwavePublicKey
          ? {
              flutterwave: {
                publicKey: flutterwavePublicKey,
                amount,
                currency: input.currency,
                paymentOptions,
                redirectUrl,
                customerName,
                meta,
              },
            }
          : undefined,
      };
    },
  },

  // Not yet integrated (kept out of availability list until implemented)
  stripe: {
    provider: 'stripe',
    async createSession() {
      throw new Error('Stripe checkout is not integrated yet');
    },
  },
  paypal: {
    provider: 'paypal',
    async createSession() {
      throw new Error('PayPal checkout is not integrated yet');
    },
  },
};

const INTEGRATED_PROVIDERS: PaymentProvider[] = ['paystack', 'flutterwave'];

function parseAllowedCountriesCsv(value: unknown): Set<string> | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parts = raw
    .split(/[^A-Za-z]+/g)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const codes = parts.filter((p) => /^[A-Z]{2}$/.test(p));
  return codes.length ? new Set(codes) : null;
}

async function providerSupportsCountryWithAdmin(provider: PaymentProvider, countryCode: string): Promise<boolean> {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return false;

  try {
    const runtime = await getProviderRuntimeConfig(provider);
    const allowed = parseAllowedCountriesCsv((runtime as any)?.credentials?.allowedCountries);

    // If admin configured an allow-list, enforce it.
    if (allowed) return providerSupportsCountry(provider, normalized) && allowed.has(normalized);
  } catch {
    // ignore and fall back to built-in rules
  }

  return providerSupportsCountry(provider, normalized);
}

export type ProviderEnablement = {
  enabled: boolean;
  reason?: string;
};

export async function getProviderEnablement(provider: PaymentProvider): Promise<ProviderEnablement> {
  try {
    const runtime = await getProviderRuntimeConfig(provider);

    if (!Boolean((runtime as any).exists)) {
      return { enabled: false, reason: 'Not configured.' };
    }

    if (!Boolean((runtime as any).isActive)) {
      return { enabled: false, reason: 'Disabled by admin toggle.' };
    }

    if ((runtime as any).decryptError) {
      return {
        enabled: false,
        reason:
          'Credentials cannot be decrypted on the server. ' +
          'Check CREDENTIALS_ENCRYPTION_KEY/CREDENTIALS_ENCRYPTION_KEYS. ' +
          `(${String((runtime as any).decryptError)})`,
      };
    }

    if (provider === 'paystack') {
      const secretKey = (runtime as any)?.credentials?.secretKey || '';
      const pro = (runtime as any)?.credentials?.planCodePro || '';
      const business = (runtime as any)?.credentials?.planCodeBusiness || '';
      if (!secretKey) return { enabled: false, reason: 'Missing Paystack Secret Key.' };
      if (!pro || !business) return { enabled: false, reason: 'Missing Paystack plan codes (Pro and Business).' };
      return { enabled: true };
    }

    if (provider === 'flutterwave') {
      const clientId = (runtime as any)?.credentials?.clientId || '';
      const clientSecret = (runtime as any)?.credentials?.clientSecret || '';
      if (!clientId || !clientSecret) return { enabled: false, reason: 'Missing Flutterwave Client ID/Secret.' };
      return { enabled: true };
    }

    return { enabled: false, reason: 'Not integrated.' };
  } catch (e: any) {
    return { enabled: false, reason: String(e?.message || 'Unable to read payment settings') };
  }
}

export async function isProviderEnabled(provider: PaymentProvider): Promise<boolean> {
  const { enabled } = await getProviderEnablement(provider);
  return enabled;
}

export type ProviderEligibility = {
  enabled: boolean;
  supportsCountry: boolean;
  supportsCurrency: boolean;
  allowed: boolean;
  reason?: string;
};

export async function getProviderEligibility(options: {
  provider: PaymentProvider;
  countryCode: string;
  currency: CurrencyCode;
}): Promise<ProviderEligibility> {
  const supportsCountry = await providerSupportsCountryWithAdmin(options.provider, options.countryCode);
  const supportsCurrency = providerSupportsCurrency(options.provider, options.currency);

  const enablement = await getProviderEnablement(options.provider);
  const enabled = enablement.enabled;

  let allowed = Boolean(enabled && supportsCountry && supportsCurrency);

  // Currency-specific configuration requirements.
  // Paystack subscriptions are plan-code based and typically currency-specific.
  if (allowed && options.provider === 'paystack' && options.currency === 'KES') {
    try {
      const runtime = await getProviderRuntimeConfig('paystack');
      const creds: any = (runtime as any)?.credentials || {};
      const proKes = String(creds.planCodeProKes || '').trim();
      const bizKes = String(creds.planCodeBusinessKes || '').trim();
      if (!proKes || !bizKes) {
        allowed = false;
      }
    } catch {
      // If we can't read settings, keep default allowed; adapter will throw with details.
    }
  }

  const reason = (() => {
    if (!enabled) return enablement.reason || 'Not configured.';
    if (!supportsCountry) return `Not available for billing country ${String(options.countryCode).toUpperCase()}.`;
    if (!supportsCurrency) return `Not available for currency ${String(options.currency).toUpperCase()}.`;

     if (options.provider === 'paystack' && options.currency === 'KES' && !allowed) {
       return 'Paystack for Kenya (KES) requires KES-specific plan codes. Configure Pro/Business Plan Code (KES) in admin payment settings.';
     }

    return undefined;
  })();

  return { enabled, supportsCountry, supportsCurrency, allowed, reason };
}

export async function getAvailableCheckoutProviders(): Promise<PaymentProvider[]> {
  try {
    const available: PaymentProvider[] = [];

    for (const provider of INTEGRATED_PROVIDERS) {
      // Must have an adapter AND be enabled/configured.
      if (!(provider in ADAPTERS)) continue;
      if (await isProviderEnabled(provider)) {
        available.push(provider);
      }
    }

    return available;
  } catch {
    // If Supabase/payment settings are not configured (common in local smoke tests),
    // fall back to integrated providers so pricing can still suggest a provider.
    return INTEGRATED_PROVIDERS.filter((p) => p in ADAPTERS);
  }
}

export async function getAvailableCheckoutProvidersStrict(): Promise<PaymentProvider[]> {
  const available: PaymentProvider[] = [];

  for (const provider of INTEGRATED_PROVIDERS) {
    if (!(provider in ADAPTERS)) continue;
    if (await isProviderEnabled(provider)) {
      available.push(provider);
    }
  }

  return available;
}

export function chooseDefaultProvider(options: {
  currency: CurrencyCode;
  availableProviders: PaymentProvider[];
}): PaymentProvider {
  const preferred = getRecommendedProvider(options.currency);
  if (options.availableProviders.includes(preferred)) return preferred;
  return options.availableProviders[0] || preferred;
}

export async function createUniversalCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  // Runtime guard: API body isn't type-safe.
  if (input.planId !== 'pro' && input.planId !== 'business') {
    throw new Error('Invalid plan ID or free plan selected');
  }

  const billingInterval: BillingInterval = normalizeBillingInterval(input.billingInterval);
  const YEARLY_MULTIPLIER = 10;
  const { multiplier: TRIAL_MULTIPLIER } = getPaidTrialConfig();

  const monthlyAmount = await (async () => {
    // Keep charged amount consistent with /api/pricing:
    // - support app_settings.general.pricing overrides
    // - support optional pricing.fxRates conversion from USD
    try {
      const { data } = await input.supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'general')
        .maybeSingle();

      const overrides = (data as any)?.value?.pricing ?? null;
      if (!overrides) return getLocalPrice(input.planId, input.currency);

      const base = SUBSCRIPTION_PRICING as any;
      const merged = {
        pro: {
          ...base.pro,
          ...(overrides?.pro ?? {}),
          localPrices: {
            ...(base.pro.localPrices ?? {}),
            ...((overrides?.pro?.localPrices ?? overrides?.pro?.local_prices ?? {}) as any),
          },
        },
        business: {
          ...base.business,
          ...(overrides?.business ?? {}),
          localPrices: {
            ...(base.business.localPrices ?? {}),
            ...((overrides?.business?.localPrices ?? overrides?.business?.local_prices ?? {}) as any),
          },
        },
      } as any;

      const fxRatesRaw = overrides?.fxRates ?? overrides?.fx_rates;
      const fxRates: Record<string, number> = {};
      if (fxRatesRaw && typeof fxRatesRaw === 'object') {
        for (const [k, v] of Object.entries(fxRatesRaw as any)) {
          const code = String(k || '').toUpperCase().trim();
          const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
          if (!code || !Number.isFinite(n) || n <= 0) continue;
          fxRates[code] = n;
        }
      }

      const tier = input.planId;
      const currency = input.currency;

      const explicit = (merged?.[tier]?.localPrices ?? {})[currency];
      if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) return explicit;

      const usdPrice = Number(merged?.[tier]?.usdPrice || 0);
      if (currency !== 'USD') {
        const rate = fxRates[currency];
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && usdPrice > 0) {
          const cfg: any = (CURRENCY_CONFIGS as any)[currency];
          const minorUnit = Number(cfg?.minorUnit || 100);
          const raw = usdPrice * rate;
          if (minorUnit === 1) return Math.round(raw);
          if (minorUnit === 1000) return Math.round(raw * 1000) / 1000;
          return Math.round(raw * 100) / 100;
        }
      }

      return usdPrice || getLocalPrice(tier, currency);
    } catch {
      return getLocalPrice(input.planId, input.currency);
    }
  })();

  const amount = (() => {
    const cfg: any = (CURRENCY_CONFIGS as any)[input.currency];
    const minorUnit = Number(cfg?.minorUnit || 100);

    const round = (raw: number) => {
      if (minorUnit === 1) return Math.round(raw);
      if (minorUnit === 1000) return Math.round(raw * 1000) / 1000;
      return Math.round(raw * 100) / 100;
    };

    if (billingInterval === 'yearly') return round(monthlyAmount * YEARLY_MULTIPLIER);
    if (billingInterval === 'trial') return round(monthlyAmount * TRIAL_MULTIPLIER);
    return monthlyAmount;
  })();

  if (!amount || amount <= 0) {
    throw new Error('Invalid plan ID or free plan selected');
  }

  const paymentMethod: CheckoutPaymentMethod | undefined = input.paymentMethod;

  const availableProviders = await getAvailableCheckoutProvidersStrict();

  const selectedProvider = (() => {
    if (input.provider) return input.provider;
    return chooseDefaultProvider({ currency: input.currency, availableProviders });
  })();

  if (billingInterval === 'trial' && selectedProvider !== 'paystack' && selectedProvider !== 'flutterwave') {
    throw new Error('Paid trial is currently supported only with Paystack or Flutterwave.');
  }

  if (!(await providerSupportsCountryWithAdmin(selectedProvider, input.countryCode))) {
    throw new Error(
      `Selected provider does not support your billing country: ${input.countryCode}. ` +
        `Try a different provider or change billing country.`
    );
  }

  if (!providerSupportsCurrency(selectedProvider, input.currency)) {
    throw new Error(
      `Selected provider does not support currency: ${input.currency}. ` +
        `Try a different provider or change currency.`
    );
  }

  if (paymentMethod) {
    // Guard against manual API calls that bypass the UI.
    // UI limits methods by provider + country + currency.
    const supportedForContext = getSupportedPaymentMethodsForContext({
      provider: selectedProvider,
      countryCode: input.countryCode,
      currency: input.currency,
    });

    if (!supportedForContext.includes(paymentMethod)) {
      throw new Error(
        `Selected provider does not support payment method for your country/currency: ${paymentMethod}`
      );
    }

    // Keep the coarse provider-level guard too (helps catch unsupported methods for non-contextual providers).
    if (!providerSupportsPaymentMethod(selectedProvider, paymentMethod)) {
      throw new Error(`Selected provider does not support payment method: ${paymentMethod}`);
    }
  }

  if (!availableProviders.includes(selectedProvider)) {
    const supported = availableProviders.length > 0 ? availableProviders.join(', ') : '(none configured)';
    throw new Error(`Unsupported provider. Allowed: ${supported}`);
  }

  const adapter = ADAPTERS[selectedProvider];
  if (!adapter) {
    throw new Error(`Provider not integrated: ${selectedProvider}`);
  }

  const userId: string = input.user?.id || `guest_${Date.now()}`;

  const idempotencyKey = String(input.idempotencyKey || '').trim();
  const reference = (() => {
    if (!idempotencyKey) return `${input.planId}_${userId}_${Date.now()}`;
    const hash = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 12);
    // Keep tx_ref short and URL-safe.
    return `${input.planId}_${userId}_${hash}`;
  })();

  // Best-effort idempotency: for authenticated users, persist a pending transaction row keyed by tx_ref.
  // This lets us safely return the same checkout URL on retries and avoid double-charging from rapid re-submits.
  const canPersist = Boolean(input.user?.id);
  if (canPersist && idempotencyKey) {
    // If a session already exists for this reference, return it.
    const { data: existing } = await input.supabaseAdmin
      .from('transactions')
      .select('transaction_id, payment_gateway, status, metadata, created_at')
      .eq('transaction_id', reference)
      .maybeSingle();

    const existingUrl = (existing as any)?.metadata?.checkoutUrl as string | undefined;
    if (existing && existingUrl) {
      return {
        provider: selectedProvider,
        reference,
        url: existingUrl,
        testMode: process.env.NODE_ENV !== 'production',
        flwRef: (existing as any)?.metadata?.flwRef,
      };
    }

    // Try to reserve this reference for the current attempt.
    // If another request has already reserved it, decide whether to allow retry.
    if (!existing) {
      await input.supabaseAdmin.from('transactions').insert({
        user_id: input.user.id,
        user_email: input.email,
        amount,
        currency: input.currency,
        status: 'pending',
        payment_gateway: selectedProvider,
        payment_method: input.paymentMethod || 'card',
        plan: input.planId,
        transaction_id: reference,
        metadata: {
          stage: 'creating_checkout_session',
          idempotencyKey,
        },
      });
    } else {
      const createdAt = (existing as any)?.created_at ? new Date((existing as any).created_at) : null;
      const ageMs = createdAt ? Date.now() - createdAt.getTime() : 0;

      // If the existing record is very recent and doesn't yet have a URL, treat as in-progress.
      if (ageMs > 0 && ageMs < 30_000) {
        throw new Error('Checkout session is already being created. Please wait a few seconds and try again.');
      }
    }
  }

  const session = await adapter.createSession({ input, amount, reference, userId });

  if (canPersist && idempotencyKey) {
    await input.supabaseAdmin
      .from('transactions')
      .update({
        metadata: {
          stage: 'checkout_session_created',
          idempotencyKey,
          checkoutUrl: session.url,
          flwRef: (session as any).flwRef,
        },
      })
      .eq('transaction_id', reference);
  }

  return session;
}
