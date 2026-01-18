"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { subscriptionFeatures, type SubscriptionTier } from '@/lib/subscriptions';
import { AFRICAN_COUNTRIES } from '@/lib/countries/africa';

import {
  getSupportedPaymentMethodsForContext,
  type CheckoutPaymentMethod,
  type UniversalPaymentProvider,
} from '@/lib/checkout/paymentMethodSupport';

type CurrencyInfo = {
  country: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  availableProviders?: UniversalPaymentProvider[];
  recommendedProvider?: UniversalPaymentProvider;
  pricing: {
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

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getAccessToken } = useSupabaseAuth();
  const { settings: appSettings } = useAppSettings();

  const selectedPlan = useMemo(
    () => normalizePlan(searchParams.get('plan')),
    [searchParams]
  );

  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [loadingCurrency, setLoadingCurrency] = useState(true);

  // Allow user to override billing/checkout country (optional)
  const [billingCountry, setBillingCountry] = useState<string>('AUTO');

  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<UniversalPaymentProvider>('flutterwave');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('card');

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
      effectiveCountryCode,
      effectiveCurrencyCode,
      provider,
      paymentMethod,
    ].join(':');
  }, [
    idempotencySeed,
    selectedPlan,
    effectiveCountryCode,
    effectiveCurrencyCode,
    provider,
    paymentMethod,
  ]);

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

      const nextProvider =
        (recommended && providers.includes(recommended) ? recommended : undefined) ||
        providers[0] ||
        'flutterwave';
      setProvider(nextProvider);
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
      });
      setProvider('flutterwave');
    } finally {
      setLoadingCurrency(false);
    }
  }, []);

  useEffect(() => {
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
  }, [fetchPricing]);

  useEffect(() => {
    // When the user selects a billing country, refetch pricing/currency/providers for that country.
    const override = billingCountry && billingCountry !== 'AUTO' ? billingCountry : null;
    fetchPricing(override);
  }, [billingCountry, fetchPricing]);

  const availableProviders =
    currencyInfo?.availableProviders && currencyInfo.availableProviders.length > 0
      ? currencyInfo.availableProviders
      : (['flutterwave', 'paystack'] as UniversalPaymentProvider[]);

  useEffect(() => {
    if (availableProviders.length === 0) return;
    if (!availableProviders.includes(provider)) {
      setProvider(availableProviders[0]);
    }
  }, [availableProviders, provider]);

  const supportedMethods = useMemo(() => {
    return getSupportedPaymentMethodsForContext({
      provider,
      countryCode: effectiveCountryCode,
      currency: effectiveCurrencyCode,
    });
  }, [provider, effectiveCountryCode, effectiveCurrencyCode]);

  useEffect(() => {
    if (supportedMethods.length === 0) return;
    if (!supportedMethods.includes(paymentMethod)) {
      setPaymentMethod(supportedMethods.includes('card') ? 'card' : supportedMethods[0]);
    }
  }, [supportedMethods, paymentMethod]);

  const planPrice =
    selectedPlan === 'pro'
      ? currencyInfo?.pricing.pro.formatted || '$9.99'
      : currencyInfo?.pricing.business.formatted || '$29.99';

  const planName = selectedPlan === 'pro' ? 'Pro' : 'Business';
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
        provider,
        paymentMethod,
        email: trimmedEmail,
        idempotencyKey,
        countryCode: effectiveCountryCode,
        successUrl: `${window.location.origin}/dashboard?welcome=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`,
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

      if (!data?.url) {
        throw new Error('No checkout URL received');
      }

      window.location.href = data.url;
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
                      onClick={() => router.push(`/verify-account?redirect=${encodeURIComponent(`/checkout?plan=${selectedPlan}`)}`)}
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
                    Complete your {planName} subscription
                  </h1>
                  <p className="mt-2 text-gray-600">
                    Fast, secure payment. Instant access after successful checkout.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-gray-900">{planPrice}</div>
                  <div className="text-sm text-gray-500">per month</div>
                </div>
              </div>

              <div className="mt-6 space-y-5">
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
                    {availableProviders.map((p) => {
                      const isSelected = provider === p;
                      const isRecommended = currencyInfo?.recommendedProvider === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setProvider(p)}
                          className={`text-left border-2 rounded-xl p-4 transition-all ${
                            isSelected
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
                        </button>
                      );
                    })}
                  </div>
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
                    <span className="mr-1">🛡️</span> 14‑day money‑back guarantee
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
                    No long forms. Just email → pay securely → start using SmartQRCode.
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

  