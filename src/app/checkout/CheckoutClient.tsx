"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { subscriptionFeatures, type SubscriptionTier } from '@/lib/subscriptions';
import { AFRICAN_COUNTRIES } from '@/lib/countries/africa';
import { isAfricanCountryCode } from '@/lib/currency';

import {
  getSupportedPaymentMethods,
  getSupportedPaymentMethodsForContext,
  LOCAL_AFRICAN_CURRENCIES,
  type CheckoutPaymentMethod,
  type UniversalPaymentProvider,
} from '@/lib/checkout/paymentMethodSupport';
import { CHECKOUT_COUNTRY_OVERRIDE_KEY } from '@/hooks/useGeoCurrencyInfo';

declare global {
  interface Window {
    PaystackPop?: any;
    FlutterwaveCheckout?: any;
  }
}

function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return resolve();

    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing?.dataset?.loaded === 'true') return resolve();
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    document.body.appendChild(script);
  });
}

type CurrencyInfo = {
  country: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  availableProviders?: UniversalPaymentProvider[];
  recommendedProvider?: UniversalPaymentProvider;
  providerEligibility?: Partial<
    Record<
      UniversalPaymentProvider,
      { enabled: boolean; supportsCountry: boolean; supportsCurrency: boolean; allowed: boolean; reason?: string }
    >
  >;
  pricing: {
    pro: { amount: number; formatted: string; usd: number };
    business: { amount: number; formatted: string; usd: number };
  };
  pricingYearly?: {
    pro: { amount: number; formatted: string; usd: number };
    business: { amount: number; formatted: string; usd: number };
  };
  paidTrial?: { days: number; multiplier: number };
  pricingTrial?: {
    pro: { amount: number; formatted: string; usd: number };
    business: { amount: number; formatted: string; usd: number };
  };
};

function providerLabel(provider: UniversalPaymentProvider) {
  switch (provider) {
    case 'paystack':
      return 'Paystack';
    case 'flutterwave':
      return 'Flutterwave';
    case 'stripe':
      return 'Stripe';
    case 'paypal':
      return 'PayPal';
    default:
      return provider;
  }
}

function methodLabel(method: CheckoutPaymentMethod) {
  switch (method) {
    case 'card':
      return 'Card';
    case 'mobile_money':
      return 'Mobile Money';
    case 'apple_pay':
      return 'Apple Pay';
    case 'google_pay':
      return 'Google Pay';
    default:
      return method;
  }
}

function normalizePlan(plan: string | null): Exclude<SubscriptionTier, 'free'> {
  const p = (plan || '').toLowerCase();
  if (p === 'business') return 'business';
  return 'pro';
}

export default function CheckoutClient(props: { initialCurrencyInfo?: CurrencyInfo | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getAccessToken } = useSupabaseAuth();
  const { settings: appSettings } = useAppSettings();

  const selectedPlan = useMemo(
    () => normalizePlan(searchParams.get('plan')),
    [searchParams]
  );

  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(() => props.initialCurrencyInfo ?? null);
  const [loadingCurrency, setLoadingCurrency] = useState(() => !props.initialCurrencyInfo);

  // Allow user to override billing/checkout country (optional)
  const [billingCountry, setBillingCountry] = useState<string>('AUTO');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKOUT_COUNTRY_OVERRIDE_KEY);
      const normalized = String(raw || '').trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(normalized)) {
        setBillingCountry(normalized);
      }
    } catch {
      // ignore
    }
  }, []);

  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<UniversalPaymentProvider>(() => {
    const providers = (props.initialCurrencyInfo?.availableProviders || []) as UniversalPaymentProvider[];
    const recommended = props.initialCurrencyInfo?.recommendedProvider as UniversalPaymentProvider | undefined;
    if (recommended && providers.includes(recommended)) return recommended;
    if (providers.length > 0) return providers[0];
    return 'flutterwave';
  });
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('card');

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly' | 'trial'>('monthly');

  const intervalInitializedRef = React.useRef(false);
  useEffect(() => {
    if (intervalInitializedRef.current) return;

    const raw = (searchParams.get('billingInterval') || searchParams.get('interval') || '').toLowerCase();
    if (raw === 'yearly' || raw === 'monthly' || raw === 'trial') {
      setBillingInterval(raw);
    }

    intervalInitializedRef.current = true;
  }, [searchParams]);

  const [checkoutUi, setCheckoutUi] = useState<'inline' | 'redirect'>('inline');

  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const providerNoticeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showProviderNotice = React.useCallback((message: string) => {
    setProviderNotice(message);
    if (providerNoticeTimerRef.current) {
      clearTimeout(providerNoticeTimerRef.current);
    }
    providerNoticeTimerRef.current = setTimeout(() => setProviderNotice(null), 8_000);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idempotencySeed] = useState(() => {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
      }
    } catch {
      // ignore
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  });

  const effectiveCountryCode = useMemo(() => {
    if (billingCountry && billingCountry !== 'AUTO') return billingCountry;
    return currencyInfo?.country || 'US';
  }, [billingCountry, currencyInfo?.country]);

  const effectiveCurrencyCode = useMemo(() => {
    return (currencyInfo?.currency?.code || 'USD') as any;
  }, [currencyInfo?.currency?.code]);

  const idempotencyKey = useMemo(() => {
    // Include the user's chosen checkout context so changing country/provider/method
    // doesn't accidentally reuse an old session URL.
    return [
      idempotencySeed,
      selectedPlan,
      billingInterval,
      effectiveCountryCode,
      effectiveCurrencyCode,
      provider,
      paymentMethod,
    ].join(':');
  }, [
    idempotencySeed,
    selectedPlan,
    billingInterval,
    effectiveCountryCode,
    effectiveCurrencyCode,
    provider,
    paymentMethod,
  ]);

  const selectedPricing = useMemo(() => {
    if (!currencyInfo) return null;
    if (billingInterval === 'trial' && currencyInfo.pricingTrial) return currencyInfo.pricingTrial;
    if (billingInterval === 'yearly' && currencyInfo.pricingYearly) return currencyInfo.pricingYearly;
    return currencyInfo.pricing;
  }, [currencyInfo, billingInterval]);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const fetchPricing = React.useCallback(async (countryOverride: string | null) => {
    setLoadingCurrency(true);
    try {
      const url = countryOverride ? `/api/pricing?country=${encodeURIComponent(countryOverride)}` : '/api/pricing';
      const res = await fetch(url);
      const data = await res.json();
      setCurrencyInfo(data);

      const providers = (data?.availableProviders || []) as UniversalPaymentProvider[];
      const recommended = data?.recommendedProvider as UniversalPaymentProvider | undefined;

      setProvider((prev) => {
        if (providers.length === 0) return prev;
        if (providers.includes(prev)) return prev;

        const nextProvider =
          (recommended && providers.includes(recommended) ? recommended : undefined) ||
          providers[0] ||
          'flutterwave';

        const detectedCountry = String((data as any)?.country || '').toUpperCase() || 'UNKNOWN';
        const detectedCurrency = String((data as any)?.currency?.code || '').toUpperCase() || 'UNKNOWN';
        showProviderNotice(
          `Payment provider changed to ${providerLabel(nextProvider)} because the previous provider isn't available for ${detectedCountry} (${detectedCurrency}).`
        );
        return nextProvider;
      });
    } catch (err) {
      console.error('Failed to fetch currency info:', err);
      setCurrencyInfo({
        country: 'US',
        currency: { code: 'USD', symbol: '$', name: 'US Dollar' },
        availableProviders: ['flutterwave', 'paystack'],
        recommendedProvider: 'flutterwave',
        pricing: {
          pro: { amount: 9.99, formatted: '$9.99', usd: 9.99 },
          business: { amount: 29.99, formatted: '$29.99', usd: 29.99 },
        },
        paidTrial: { days: 7, multiplier: 0.3 },
        pricingTrial: {
          pro: { amount: 2.99, formatted: '$2.99', usd: 9.99 },
          business: { amount: 8.99, formatted: '$8.99', usd: 29.99 },
        },
      });
      setProvider('flutterwave');
    } finally {
      setLoadingCurrency(false);
    }
  }, [showProviderNotice]);

  useEffect(() => {
    if (props.initialCurrencyInfo) {
      setLoadingCurrency(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await fetchPricing(null);
      } finally {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPricing, props.initialCurrencyInfo]);

  useEffect(() => {
    // When the user selects a billing country, refetch pricing/currency/providers for that country.
    const override = billingCountry && billingCountry !== 'AUTO' ? billingCountry : null;
    fetchPricing(override);
  }, [billingCountry, fetchPricing]);

  const availableProviders =
    currencyInfo?.availableProviders && currencyInfo.availableProviders.length > 0
      ? currencyInfo.availableProviders
      : (['flutterwave', 'paystack'] as UniversalPaymentProvider[]);

  const providerCards = useMemo(() => {
    const eligibility = currencyInfo?.providerEligibility || {};
    const base: UniversalPaymentProvider[] = ['flutterwave', 'paystack'];
    const uniq = Array.from(new Set([...base, ...availableProviders]));
    return uniq.map((p) => {
      const info = eligibility[p];
      const baseAllowed = info ? Boolean(info.allowed) : availableProviders.includes(p);

      if (billingInterval === 'trial' && p !== 'paystack' && p !== 'flutterwave') {
        return {
          provider: p,
          allowed: false,
          reason: 'Paid trial is currently available only via Paystack or Flutterwave.',
        };
      }

      const allowed = baseAllowed;
      const reason = info?.reason;
      return { provider: p, allowed, reason };
    });
  }, [currencyInfo?.providerEligibility, availableProviders, billingInterval]);

  useEffect(() => {
    if (billingInterval !== 'trial') return;
    if (provider === 'paystack' || provider === 'flutterwave') return;

    const next = availableProviders.includes('flutterwave')
      ? 'flutterwave'
      : availableProviders.includes('paystack')
        ? 'paystack'
        : 'flutterwave';

    showProviderNotice('Paid trial is currently supported only with Paystack or Flutterwave.');
    setProvider(next);
  }, [billingInterval, provider, availableProviders, showProviderNotice]);

  useEffect(() => {
    if (availableProviders.length === 0) return;
    if (!availableProviders.includes(provider)) {
      const next = availableProviders[0];
      showProviderNotice(
        `Payment provider changed to ${providerLabel(next)} because the previous selection isn't available for the selected billing country.`
      );
      setProvider(next);
    }
  }, [availableProviders, provider, showProviderNotice]);

  const supportedMethods = useMemo(() => {
    return getSupportedPaymentMethodsForContext({
      provider,
      countryCode: effectiveCountryCode,
      currency: effectiveCurrencyCode,
    });
  }, [provider, effectiveCountryCode, effectiveCurrencyCode]);

  const methodAvailabilityNote = useMemo(() => {
    const base = getSupportedPaymentMethods(provider);
    const hidden = base.filter((m) => !supportedMethods.includes(m));
    if (hidden.length === 0) return null;

    if (hidden.includes('mobile_money')) {
      const isAfrican = isAfricanCountryCode(effectiveCountryCode);
      if (!isAfrican) {
        return 'Mobile money is available only for African billing countries. Use Card or change billing country.';
      }
      if (!LOCAL_AFRICAN_CURRENCIES.includes(effectiveCurrencyCode as any)) {
        return `Mobile money requires a local currency (${LOCAL_AFRICAN_CURRENCIES.join(', ')}). Use Card or change billing country.`;
      }
    }

    return 'Some payment methods are unavailable for your billing country/currency.';
  }, [provider, supportedMethods, effectiveCountryCode, effectiveCurrencyCode]);

  useEffect(() => {
    if (supportedMethods.length === 0) return;
    if (!supportedMethods.includes(paymentMethod)) {
      setPaymentMethod(supportedMethods.includes('card') ? 'card' : supportedMethods[0]);
    }
  }, [supportedMethods, paymentMethod]);

  const planPrice =
    selectedPlan === 'pro'
      ? selectedPricing?.pro.formatted || currencyInfo?.pricing.pro.formatted || '$9.99'
      : selectedPricing?.business.formatted || currencyInfo?.pricing.business.formatted || '$29.99';

  const planName = selectedPlan === 'pro' ? 'Pro' : 'Business';
  const paidTrialDays = currencyInfo?.paidTrial?.days ?? 7;
  const planFeatures = subscriptionFeatures[selectedPlan];

  const commonBillingCountries = useMemo(
    () =>
      [
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
        { code: 'CA', name: 'Canada' },
        { code: 'DE', name: 'Germany' },
        { code: 'FR', name: 'France' },
        { code: 'ES', name: 'Spain' },
        { code: 'IT', name: 'Italy' },
        { code: 'NL', name: 'Netherlands' },
        { code: 'BR', name: 'Brazil' },
      ] as const,
    []
  );

  const requiresPhoneVerification = Boolean(appSettings?.firebase?.phoneAuthEnabled);
  const isPhoneVerified = Boolean(
    (user as any)?.user_metadata?.phone_verified_at || (user as any)?.user_metadata?.phone_number
  );

  async function submitCheckout() {
    setError(null);

    if (requiresPhoneVerification && user && !isPhoneVerified) {
      setError('Please verify your phone number before checkout.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const checkoutData = {
        planId: selectedPlan,
        billingInterval,
        provider,
        paymentMethod,
        email: trimmedEmail,
        idempotencyKey,
        countryCode: effectiveCountryCode,
        successUrl: `${window.location.origin}/dashboard?welcome=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        checkoutUi,
      };

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const accessToken = await getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers,
        body: JSON.stringify(checkoutData),
      });

      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();

      if (!contentType.includes('application/json')) {
        const snippet = (raw || '').slice(0, 200);
        throw new Error(
          `Checkout API returned non-JSON (status ${response.status}). ` +
            (snippet ? `Response: ${snippet}` : 'Empty response')
        );
      }

      const data = raw ? JSON.parse(raw) : null;

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create checkout session');
      }

      const redirectUrl = String(data?.url || '').trim();

      const canInline = checkoutUi === 'inline' && Boolean(user?.id) && (provider === 'paystack' || provider === 'flutterwave');

      if (!canInline) {
        if (!redirectUrl) throw new Error('No checkout URL received');
        window.location.href = redirectUrl;
        return;
      }

      // Inline checkout requires configured provider public keys.
      if (provider === 'paystack') {
        const inline = data?.inline?.paystack;
        const publicKey = String(inline?.publicKey || '').trim();
        const accessCode = String(inline?.accessCode || '').trim();
        const reference = String(data?.reference || '').trim();

        if (!publicKey || !accessCode || !reference) {
          if (!redirectUrl) throw new Error('Inline setup unavailable (missing Paystack publicKey/accessCode)');
          showProviderNotice('Inline checkout is unavailable for Paystack right now; redirecting instead.');
          window.location.href = redirectUrl;
          return;
        }

        await loadExternalScript('https://js.paystack.co/v1/inline.js');
        if (!window.PaystackPop?.setup) {
          if (!redirectUrl) throw new Error('Failed to load Paystack inline checkout');
          showProviderNotice('Paystack inline failed to load; redirecting instead.');
          window.location.href = redirectUrl;
          return;
        }

        const handler = window.PaystackPop.setup({
          key: publicKey,
          email: trimmedEmail,
          access_code: accessCode,
          callback: async (response: any) => {
            try {
              const ref = String(response?.reference || reference).trim();
              const accessToken = await getAccessToken();
              const confirmRes = await fetch('/api/checkout/confirm', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ provider: 'paystack', reference: ref }),
              });
              const confirmJson = await confirmRes.json().catch(() => null);
              if (!confirmRes.ok) {
                throw new Error(String((confirmJson as any)?.error || 'Payment confirmed, but activation is pending'));
              }
              window.location.href = `${window.location.origin}/dashboard?welcome=true`;
            } catch (err: any) {
              setError(String(err?.message || 'Payment completed, but activation is pending. Please refresh in a moment.'));
              setIsSubmitting(false);
            }
          },
          onClose: () => {
            setIsSubmitting(false);
          },
        });

        handler.openIframe();
        return;
      }

      if (provider === 'flutterwave') {
        const inline = data?.inline?.flutterwave;
        const publicKey = String(inline?.publicKey || '').trim();
        const reference = String(data?.reference || '').trim();
        const amount = Number(inline?.amount || 0);
        const currency = String(inline?.currency || '').trim();
        const paymentOptions = String(inline?.paymentOptions || '').trim();
        const customerName = String(inline?.customerName || trimmedEmail.split('@')[0] || '').trim();
        const meta = inline?.meta || {};

        if (!publicKey || !reference || !amount || !currency) {
          if (!redirectUrl) throw new Error('Inline setup unavailable (missing Flutterwave config)');
          showProviderNotice('Inline checkout is unavailable for Flutterwave right now; redirecting instead.');
          window.location.href = redirectUrl;
          return;
        }

        await loadExternalScript('https://checkout.flutterwave.com/v3.js');
        if (typeof window.FlutterwaveCheckout !== 'function') {
          if (!redirectUrl) throw new Error('Failed to load Flutterwave inline checkout');
          showProviderNotice('Flutterwave inline failed to load; redirecting instead.');
          window.location.href = redirectUrl;
          return;
        }

        window.FlutterwaveCheckout({
          public_key: publicKey,
          tx_ref: reference,
          amount,
          currency,
          payment_options: paymentOptions || undefined,
          customer: {
            email: trimmedEmail,
            name: customerName,
          },
          meta,
          callback: async (resp: any) => {
            try {
              const status = String(resp?.status || '').toLowerCase();
              const transactionId = String(resp?.transaction_id || resp?.id || '').trim();

              if (!transactionId) {
                throw new Error('Missing Flutterwave transaction id');
              }

              if (status && status !== 'successful') {
                throw new Error('Payment was not successful');
              }

              const accessToken = await getAccessToken();
              const confirmRes = await fetch('/api/checkout/confirm', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ provider: 'flutterwave', reference, transactionId }),
              });
              const confirmJson = await confirmRes.json().catch(() => null);
              if (!confirmRes.ok) {
                throw new Error(String((confirmJson as any)?.error || 'Payment confirmed, but activation is pending'));
              }

              window.location.href = `${window.location.origin}/dashboard?welcome=true`;
            } catch (err: any) {
              setError(String(err?.message || 'Payment completed, but activation is pending. Please refresh in a moment.'));
              setIsSubmitting(false);
            }
          },
          onclose: () => {
            setIsSubmitting(false);
          },
        });
        return;
      }

      if (!redirectUrl) {
        throw new Error('No checkout URL received');
      }
      window.location.href = redirectUrl;
    } catch (e) {
      console.error('Checkout error:', e);
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/pricing')}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to pricing
          </button>
          <div className="text-sm text-gray-500">Secure checkout</div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              {requiresPhoneVerification && user && !isPhoneVerified && (
                <div className="mb-5 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-yellow-900">Phone verification required</p>
                      <p className="mt-1 text-sm text-yellow-800">
                        To protect accounts and reduce fraud, please verify your phone number before starting checkout.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/verify-account?redirect=${encodeURIComponent(
                            `/checkout?plan=${selectedPlan}&billingInterval=${billingInterval}`
                          )}`
                        )
                      }
                      className="shrink-0 inline-flex items-center px-3 py-2 rounded-md bg-yellow-700 text-white text-sm font-medium hover:bg-yellow-800"
                    >
                      Verify now
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                    Complete your {planName} {billingInterval === 'trial' ? 'trial' : 'subscription'}
                  </h1>
                  <p className="mt-2 text-gray-600">
                    Fast, secure payment. Instant access after successful checkout.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-gray-900">{planPrice}</div>
                  <div className="text-sm text-gray-500">
                    {billingInterval === 'trial' ? `for ${paidTrialDays} days` : billingInterval === 'yearly' ? 'per year' : 'per month'}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Billing interval</label>
                <div className="inline-flex rounded-xl border-2 border-gray-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setBillingInterval('trial')}
                    disabled={!currencyInfo?.pricingTrial}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      billingInterval === 'trial'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-700 hover:bg-gray-50'
                    } ${!currencyInfo?.pricingTrial ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Trial
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('monthly')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      billingInterval === 'monthly'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('yearly')}
                    disabled={!currencyInfo?.pricingYearly}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      billingInterval === 'yearly'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-700 hover:bg-gray-50'
                    } ${!currencyInfo?.pricingYearly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Yearly
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {billingInterval === 'trial'
                    ? `Paid trial grants access for ${paidTrialDays} days (one-time payment).`
                    : 'Yearly is billed annually (2 months free vs monthly).'}
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {/* Checkout experience */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Checkout experience</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCheckoutUi('inline')}
                      className={`text-left border-2 rounded-xl p-4 transition-all ${
                        checkoutUi === 'inline'
                          ? 'border-indigo-600 bg-indigo-50 shadow-md'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">Stay on this site</div>
                      <div className="mt-1 text-sm text-gray-600">Opens a secure provider modal (recommended).</div>
                      {!user?.id && (
                        <div className="mt-1 text-xs text-amber-700">Sign in required for inline checkout.</div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutUi('redirect')}
                      className={`text-left border-2 rounded-xl p-4 transition-all ${
                        checkoutUi === 'redirect'
                          ? 'border-indigo-600 bg-indigo-50 shadow-md'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">Redirect</div>
                      <div className="mt-1 text-sm text-gray-600">Takes you to the provider checkout page.</div>
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    You’ll still be paying securely with Paystack/Flutterwave. Card details are handled by the provider.
                  </p>
                </div>

                {/* Billing / checkout country */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2" htmlFor="checkout-country">
                    Billing / checkout country (optional)
                  </label>
                  <select
                    id="checkout-country"
                    value={billingCountry}
                    onChange={(e) => setBillingCountry(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white"
                  >
                    <option value="AUTO">Auto-detect</option>

                    <optgroup label="Africa">
                      {AFRICAN_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Other">
                      {commonBillingCountries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    Choose the country you want to pay from. This can change currency and available payment methods.
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2" htmlFor="checkout-email">
                    Email address
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {user ? "We’ll send receipts and account updates here." : "We’ll create your account after payment success."}
                  </p>
                </div>

                {/* Provider */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-900">Payment provider</label>
                    {currencyInfo?.recommendedProvider && (
                      <div className="text-xs text-gray-500">
                        Recommended: {providerLabel(currencyInfo.recommendedProvider)}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {providerCards.map(({ provider: p, allowed, reason }) => {
                      const isSelected = provider === p;
                      const isRecommended = currencyInfo?.recommendedProvider === p;
                      const disabled = !allowed;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            if (disabled) {
                              showProviderNotice(reason || 'This provider is not available for your billing country/currency.');
                              return;
                            }
                            setProviderNotice(null);
                            setProvider(p);
                          }}
                          disabled={disabled}
                          className={`text-left border-2 rounded-xl p-4 transition-all ${
                            disabled
                              ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                              : isSelected
                                ? 'border-indigo-600 bg-indigo-50 shadow-md'
                                : 'border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-gray-900">{providerLabel(p)}</div>
                            {isRecommended && (
                              <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            {p === 'flutterwave'
                              ? 'Best for international cards & local methods'
                              : p === 'paystack'
                                ? 'Best for NGN and cards'
                                : 'Secure checkout'}
                          </div>
                          {disabled && reason && (
                            <div className="mt-2 text-xs text-amber-700">{reason}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {providerNotice && (
                    <p className="mt-2 text-xs text-amber-700">
                      {providerNotice}
                    </p>
                  )}
                </div>

                {/* Method */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Payment method</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {supportedMethods.map((m) => {
                      const selected = paymentMethod === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`px-3 py-2 rounded-full text-sm font-semibold border transition ${
                            selected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {methodLabel(m)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    You’ll choose exact details on the provider’s secure page.
                  </p>
                  {methodAvailabilityNote && (
                    <p className="mt-2 text-xs text-amber-700">
                      {methodAvailabilityNote}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitCheckout}
                  disabled={loadingCurrency || isSubmitting}
                  className="w-full py-4 px-6 rounded-xl shadow-lg font-bold text-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Redirecting to secure payment…' : `Continue to secure payment`}
                </button>

                <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
                  <div className="flex items-center">
                    <span className="mr-1">🔒</span> Secure payment
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">✅</span> Instant access
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">🛡️</span>
                    <span>
                      14-day money-back guarantee{' '}
                      <Link href="/refunds/" className="text-indigo-600 hover:text-indigo-700 hover:underline">
                        (see policy)
                      </Link>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">You’re getting</div>
                    <div className="text-xl font-extrabold text-gray-900">{planName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{planPrice}</div>
                    <div className="text-xs text-gray-500">/month</div>
                  </div>
                </div>

                <ul className="mt-5 space-y-3 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="mt-0.5 mr-2 text-green-600">✓</span>
                    <span>
                      Up to <strong>{planFeatures.maxQRCodes}</strong> QR codes
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mt-0.5 mr-2 text-green-600">✓</span>
                    <span>
                      Up to <strong>{planFeatures.maxBarcodes}</strong> barcodes
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mt-0.5 mr-2 text-green-600">✓</span>
                    <span>
                      {planFeatures.aiCustomizationAllowed ? 'AI customization included' : 'AI customization'}
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mt-0.5 mr-2 text-green-600">✓</span>
                    <span>
                      {planFeatures.bulkGenerationAllowed
                        ? `Bulk generation (${planFeatures.maxBulkItems} items)`
                        : 'Bulk generation'}
                    </span>
                  </li>
                </ul>

                <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-900">Why this is easy</div>
                  <div className="mt-2 text-sm text-gray-600">
                    No long forms. Just email → pay securely → start using ScanMagic.
                  </div>
                </div>

                {loadingCurrency ? (
                  <div className="mt-4 text-xs text-gray-500">Detecting your currency…</div>
                ) : currencyInfo ? (
                  <div className="mt-4 text-xs text-gray-500">
                    Pricing in {currencyInfo.currency.name} ({currencyInfo.currency.code}) • Country: {effectiveCountryCode}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

  