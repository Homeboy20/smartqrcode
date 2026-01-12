import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { hasCredential } from '@/lib/credentials';
import { getProviderRuntimeConfig, type PaymentProvider } from '@/lib/paymentSettingsStore';
import { createPaystackCustomer, initializeSubscriptionPayment } from '@/lib/paystack';
import {
  createFlutterwaveSubscriptionPayment,
  getOrCreateFlutterwaveCustomer,
  type FlutterwaveCustomer,
} from '@/lib/flutterwave';
import { getLocalPrice, getRecommendedProvider, type CurrencyCode } from '@/lib/currency';

import {
  providerSupportsPaymentMethod,
  type CheckoutPaymentMethod,
} from '@/lib/checkout/paymentMethodSupport';

export type CheckoutPlanId = 'pro' | 'business';

export type CheckoutSessionResult = {
  provider: PaymentProvider;
  reference: string;
  url: string;
  testMode: boolean;
  // Optional gateway-specific fields (kept for back-compat with existing API)
  flwRef?: string;
};

export type CheckoutSessionInput = {
  planId: CheckoutPlanId;
  currency: CurrencyCode;
  countryCode: string;
  successUrl: string;
  cancelUrl: string;
  email: string;
  paymentMethod?: CheckoutPaymentMethod;
  provider?: PaymentProvider;

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
      const paystackPlanCodes: Record<CheckoutPlanId, string> = {
        pro: paystackRuntime.credentials.planCodePro || process.env.PAYSTACK_PLAN_CODE_PRO || '',
        business: paystackRuntime.credentials.planCodeBusiness || process.env.PAYSTACK_PLAN_CODE_BUSINESS || '',
      };

      const planCode = paystackPlanCodes[input.planId];
      if (!planCode) {
        throw new Error('Invalid plan ID for Paystack. Available plans: pro, business');
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
        plan: planCode,
        reference,
        callbackUrl: appendQueryParam(input.successUrl, 'reference', reference),
        metadata: {
          userId,
          planId: input.planId,
          userEmail: input.email,
          provider: 'paystack',
          paymentMethod: input.paymentMethod || 'card',
          currency: input.currency,
          countryCode: input.countryCode,
        },
      });

      return {
        provider: 'paystack',
        reference,
        url: payment.authorization_url,
        testMode: process.env.NODE_ENV !== 'production',
      };
    },
  },

  flutterwave: {
    provider: 'flutterwave',
    async createSession({ input, amount, reference, userId }) {
      const planName = `${input.planId.charAt(0).toUpperCase() + input.planId.slice(1)} Plan`;

      const customerName = input.user?.user_metadata?.full_name || input.email.split('@')[0];
      const nameParts = String(customerName).split(' ');

      const flwCustomer: FlutterwaveCustomer = {
        email: input.email,
        name: {
          first: nameParts[0] || '',
          last: nameParts.slice(1).join(' ') || nameParts[0] || '',
        },
        meta: {
          userId,
          planId: input.planId,
          source: 'smartqrcode',
        },
      };

      const customer = await getOrCreateFlutterwaveCustomer(flwCustomer);

      const flutterwavePaymentMethod: 'card' | 'mobile_money' | undefined =
        input.paymentMethod === 'mobile_money'
          ? 'mobile_money'
          : input.paymentMethod === 'card'
            ? 'card'
            : undefined;

      const payment = await createFlutterwaveSubscriptionPayment({
        amount,
        currency: input.currency,
        customerEmail: input.email,
        customerName,
        planName,
        reference,
        redirectUrl: appendQueryParam(input.successUrl, 'reference', reference),
        paymentMethod: flutterwavePaymentMethod,
        metadata: {
          userId,
          planId: input.planId,
          userEmail: input.email,
          provider: 'flutterwave',
          paymentMethod: input.paymentMethod || 'card',
          flwCustomerId: customer.id,
          currency: input.currency,
          countryCode: input.countryCode,
        },
        testMode: process.env.NODE_ENV !== 'production',
      });

      return {
        provider: 'flutterwave',
        reference,
        url: payment.paymentLink,
        flwRef: payment.flwRef,
        testMode: process.env.NODE_ENV !== 'production',
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

async function isProviderEnabled(provider: PaymentProvider): Promise<boolean> {
  const runtime = await getProviderRuntimeConfig(provider);

  // If there is a DB row, respect the admin toggle.
  if ((runtime as any).exists) {
    if (!Boolean((runtime as any).isActive)) return false;

    // Also require that the provider has the minimum required credentials.
    // If stored secrets are encrypted but CREDENTIALS_ENCRYPTION_KEY is missing,
    // runtime.credentials may be empty; env vars can still satisfy these.
    if (provider === 'paystack') {
      const secretKey =
        (runtime as any)?.credentials?.secretKey || process.env.PAYSTACK_SECRET_KEY || '';
      const pro =
        (runtime as any)?.credentials?.planCodePro || process.env.PAYSTACK_PLAN_CODE_PRO || '';
      const business =
        (runtime as any)?.credentials?.planCodeBusiness ||
        process.env.PAYSTACK_PLAN_CODE_BUSINESS ||
        '';
      return Boolean(secretKey && pro && business);
    }

    if (provider === 'flutterwave') {
      const clientId = (runtime as any)?.credentials?.clientId || process.env.FLUTTERWAVE_CLIENT_ID || '';
      const clientSecret = (runtime as any)?.credentials?.clientSecret || process.env.FLUTTERWAVE_CLIENT_SECRET || '';
      return Boolean(clientId && clientSecret);
    }

    // For not-yet-integrated providers, keep disabled.
    return false;
  }

  // Env-only fallback for legacy deployments (no row exists):
  if (provider === 'paystack') {
    const hasSecret = await hasCredential('PAYSTACK_SECRET_KEY');
    const hasPro = await hasCredential('PAYSTACK_PLAN_CODE_PRO');
    const hasBusiness = await hasCredential('PAYSTACK_PLAN_CODE_BUSINESS');
    return hasSecret && hasPro && hasBusiness;
  }

  if (provider === 'flutterwave') {
    const hasClientId = await hasCredential('FLUTTERWAVE_CLIENT_ID');
    const hasSecret = await hasCredential('FLUTTERWAVE_CLIENT_SECRET');
    return hasClientId && hasSecret;
  }

  return false;
}

export async function getAvailableCheckoutProviders(): Promise<PaymentProvider[]> {
  const available: PaymentProvider[] = [];

  for (const provider of INTEGRATED_PROVIDERS) {
    // Must have an adapter AND be enabled/configured.
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

  const amount = getLocalPrice(input.planId, input.currency);
  if (!amount || amount <= 0) {
    throw new Error('Invalid plan ID or free plan selected');
  }

  const paymentMethod: CheckoutPaymentMethod = input.paymentMethod || 'card';

  const availableProviders = await getAvailableCheckoutProviders();

  const selectedProvider = (() => {
    if (input.provider) return input.provider;
    return chooseDefaultProvider({ currency: input.currency, availableProviders });
  })();

  if (!providerSupportsPaymentMethod(selectedProvider, paymentMethod)) {
    throw new Error(`Selected provider does not support payment method: ${paymentMethod}`);
  }

  if (!availableProviders.includes(selectedProvider)) {
    const supported = availableProviders.length > 0 ? availableProviders.join(', ') : '(none configured)';
    throw new Error(`Unsupported provider. Allowed: ${supported}`);
  }

  const adapter = ADAPTERS[selectedProvider];
  if (!adapter) {
    throw new Error(`Provider not integrated: ${selectedProvider}`);
  }

  const userId = input.user?.id || `guest_${Date.now()}`;
  const reference = `${input.planId}_${userId}_${Date.now()}`;

  return adapter.createSession({ input, amount, reference, userId });
}
