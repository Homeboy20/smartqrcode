"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { subscriptionFeatures, SubscriptionTier } from '@/lib/subscriptions';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import type { UniversalPaymentProvider } from '@/lib/checkout/paymentMethodSupport';
import { CHECKOUT_COUNTRY_OVERRIDE_KEY } from '@/hooks/useGeoCurrencyInfo';

interface CurrencyInfo {
  country: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  availableProviders?: UniversalPaymentProvider[];
  recommendedProvider?: UniversalPaymentProvider;
  pricing: {
    pro: {
      amount: number;
      formatted: string;
      usd: number;
    };
    business: {
      amount: number;
      formatted: string;
      usd: number;
    };
  };
  pricingYearly?: {
    pro: {
      amount: number;
      formatted: string;
      usd: number;
    };
    business: {
      amount: number;
      formatted: string;
      usd: number;
    };
  };
  paidTrial?: {
    days: number;
    multiplier: number;
  };
  pricingTrial?: {
    pro: {
      amount: number;
      formatted: string;
      usd: number;
    };
    business: {
      amount: number;
      formatted: string;
      usd: number;
    };
  };
}

export default function PricingClient(props: { initialCurrencyInfo?: CurrencyInfo | null }) {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { subscriptionTier, loading } = useSubscription();

  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(() => props.initialCurrencyInfo ?? null);
  const [loadingCurrency, setLoadingCurrency] = useState(() => !props.initialCurrencyInfo);

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly' | 'trial'>(() => {
    try {
      if (typeof window === 'undefined') return 'monthly';
      const saved = window.localStorage.getItem('billingInterval');
      if (saved === 'monthly' || saved === 'yearly' || saved === 'trial') return saved;
      // Default to yearly for first-time visitors.
      return 'yearly';
    } catch {
      return 'monthly';
    }
  });

  useEffect(() => {
    if (props.initialCurrencyInfo) {
      setLoadingCurrency(false);
      return;
    }

    // Fetch currency information on mount (fallback if server prefetch failed)
    fetch('/api/pricing')
      .then((res) => res.json())
      .then((data) => {
        setCurrencyInfo(data);

        // Provider selection is handled on the /checkout page.
      })
      .catch((err) => {
        console.error('Failed to fetch currency info:', err);
        // Use defaults on error
        const YEARLY_MULTIPLIER = 10;
        const fallbackCurrency = 'USD';
        const fmt = (amount: number) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: fallbackCurrency }).format(amount);

        setCurrencyInfo({
          country: 'US',
          currency: { code: 'USD', symbol: '$', name: 'US Dollar' },
          availableProviders: ['flutterwave', 'paystack'],
          recommendedProvider: 'flutterwave',
          pricing: {
            pro: { amount: 9.99, formatted: '$9.99', usd: 9.99 },
            business: { amount: 29.99, formatted: '$29.99', usd: 29.99 },
          },
          pricingYearly: {
            pro: {
              amount: 9.99 * YEARLY_MULTIPLIER,
              formatted: fmt(9.99 * YEARLY_MULTIPLIER),
              usd: 9.99 * YEARLY_MULTIPLIER,
            },
            business: {
              amount: 29.99 * YEARLY_MULTIPLIER,
              formatted: fmt(29.99 * YEARLY_MULTIPLIER),
              usd: 29.99 * YEARLY_MULTIPLIER,
            },
          },
          paidTrial: { days: 7, multiplier: 0.3 },
          pricingTrial: {
            pro: { amount: 2.99, formatted: fmt(2.99), usd: 9.99 },
            business: { amount: 8.99, formatted: fmt(8.99), usd: 29.99 },
          },
        });
      })
      .finally(() => setLoadingCurrency(false));
  }, [props.initialCurrencyInfo]);

  // Respect an explicit country override (stored by the header selector).
  // This keeps pricing consistent even when server-prefetch used real geo.
  useEffect(() => {
    if (!props.initialCurrencyInfo) return;

    const readOverride = () => {
      try {
        const raw = window.localStorage.getItem(CHECKOUT_COUNTRY_OVERRIDE_KEY);
        const normalized = String(raw || '').trim().toUpperCase();
        return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
      } catch {
        return null;
      }
    };

    const override = readOverride();
    if (!override) return;
    if (override === String(currencyInfo?.country || '').toUpperCase()) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingCurrency(true);
        const res = await fetch(`/api/pricing?country=${encodeURIComponent(override)}`, {
          headers: { 'x-checkout-country': override },
        });
        if (!res.ok) return;
        const data = (await res.json()) as CurrencyInfo;
        if (cancelled) return;
        setCurrencyInfo(data);
      } finally {
        if (!cancelled) setLoadingCurrency(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialCurrencyInfo]);

  // If a selected interval isn't available for the detected currency, force monthly.
  useEffect(() => {
    if (billingInterval === 'yearly' && !currencyInfo?.pricingYearly) {
      setBillingInterval('monthly');
    }
    if (billingInterval === 'trial' && !currencyInfo?.pricingTrial) {
      setBillingInterval('monthly');
    }
  }, [billingInterval, currencyInfo?.pricingYearly, currencyInfo?.pricingTrial]);

  // Persist the visitor's preference.
  useEffect(() => {
    try {
      window.localStorage.setItem('billingInterval', billingInterval);
    } catch {
      // ignore
    }
  }, [billingInterval]);

  const handleUpgrade = async (tier: Exclude<SubscriptionTier, 'free'>) => {
    router.push(`/checkout?plan=${tier}&billingInterval=${billingInterval}`);
  };

  const renderFeatures = (tier: SubscriptionTier) => {
    const features = subscriptionFeatures[tier];

    return (
      <ul className="mt-6 space-y-4">
        <li className="flex">
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span className="ml-3">{features.maxQRCodes} QR codes</span>
        </li>
        <li className="flex">
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span className="ml-3">{features.maxBarcodes} barcodes</span>
        </li>
        <li className="flex">
          {features.bulkGenerationAllowed ? (
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="ml-3">Bulk generation {features.bulkGenerationAllowed ? `(${features.maxBulkItems} items)` : ''}</span>
        </li>
        <li className="flex">
          {features.aiCustomizationAllowed ? (
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="ml-3">AI customization {features.aiCustomizationAllowed ? `(${features.maxAICustomizations} designs)` : ''}</span>
        </li>
        <li className="flex">
          {features.analyticsEnabled ? (
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="ml-3">Analytics</span>
        </li>
        <li className="flex">
          {features.customBrandingAllowed ? (
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="ml-3">Custom branding</span>
        </li>
        <li className="flex">
          {features.teamMembersAllowed ? (
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="ml-3">Team members {features.teamMembersAllowed ? `(${features.maxTeamMembers} members)` : ''}</span>
        </li>
      </ul>
    );
  };

  if (loading || loadingCurrency) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4">Loading pricing...</p>
      </div>
    );
  }

  const currencyCode = currencyInfo?.currency.code || 'USD';

  const pricing =
    billingInterval === 'trial' && currencyInfo?.pricingTrial
      ? currencyInfo.pricingTrial
      : billingInterval === 'yearly' && currencyInfo?.pricingYearly
        ? currencyInfo.pricingYearly
        : currencyInfo?.pricing;

  const proPrice = pricing?.pro.formatted || currencyInfo?.pricing.pro.formatted || '$9.99';
  const businessPrice = pricing?.business.formatted || currencyInfo?.pricing.business.formatted || '$29.99';

  const paidTrialDays = currencyInfo?.paidTrial?.days ?? 7;
  const proTrialPrice = currencyInfo?.pricingTrial?.pro.formatted;
  const businessTrialPrice = currencyInfo?.pricingTrial?.business.formatted;

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);

  const YEARLY_MULTIPLIER = 10;
  const savingsPercent = Math.round((1 - YEARLY_MULTIPLIER / 12) * 100);

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the perfect plan for your business. All plans include 14-day money-back guarantee.
          </p>
          {currencyCode !== 'USD' && (
            <p className="mt-2 text-sm text-gray-500">
              Prices shown in {currencyInfo?.currency.name} ({currencyCode}) • Detected from {currencyInfo?.country}
            </p>
          )}

          {/* Billing interval toggle (psychology: savings + framing) */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="inline-flex rounded-xl border-2 border-gray-200 bg-white p-1 shadow-sm">
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
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                  {paidTrialDays} days
                </span>
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
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Save {savingsPercent}%
                </span>
              </button>
            </div>
            {billingInterval === 'yearly' ? (
              <p className="text-sm text-gray-600">
                Pay yearly and get <span className="font-semibold text-gray-900">2 months free</span>.
              </p>
            ) : billingInterval === 'trial' ? (
              <p className="text-sm text-gray-600">
                One-time paid trial for <span className="font-semibold text-gray-900">{paidTrialDays} days</span>.
                <span className="ml-1">No auto-renew.</span>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Switch to yearly to get <span className="font-semibold text-gray-900">2 months free</span>.
              </p>
            )}
          </div>

          {/* Social Proof */}
          <div className="mt-8 flex justify-center items-center space-x-8 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>4.9/5 from 2,000+ reviews</span>
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid grid-cols-1 gap-y-10 gap-x-8 lg:grid-cols-2">
          {/* Pro Tier - MOST POPULAR */}
          <div
            className={`relative rounded-2xl shadow-2xl overflow-hidden transform transition hover:scale-105 ${
              subscriptionTier === 'pro' ? 'ring-4 ring-indigo-600' : 'ring-2 ring-indigo-500'
            }`}
          >
            {/* Popular Badge */}
            <div className="absolute top-0 right-0 mt-4 mr-4">
              <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                ⭐ MOST POPULAR
              </span>
            </div>
            {billingInterval === 'yearly' && currencyInfo?.pricingYearly && (
              <div className="absolute top-0 left-0 mt-4 ml-4">
                <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-emerald-600 text-white shadow-lg">
                  BEST VALUE (YEARLY)
                </span>
              </div>
            )}
            <div className="px-6 py-8 bg-gradient-to-br from-indigo-50 to-white sm:p-10 sm:pb-6">
              <div>
                <h3 className="text-center text-2xl font-bold text-gray-900">Pro</h3>
                <p className="mt-2 text-center text-sm text-indigo-600 font-medium">Best for growing businesses</p>
                <div className="mt-6 flex justify-center items-baseline">
                  <span className="text-6xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {proPrice}
                  </span>
                  <span className="ml-2 text-xl font-medium text-gray-500">
                    /{billingInterval === 'trial' ? 'trial' : billingInterval === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {billingInterval === 'yearly' && currencyInfo?.pricingYearly && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-gray-600">
                      Only <span className="font-semibold text-gray-900">{formatAmount(currencyInfo.pricingYearly.pro.amount / 12)}</span>/mo billed yearly
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      <span className="line-through">{formatAmount(currencyInfo.pricing.pro.amount * 12)}</span>{' '}
                      <span className="ml-1">→</span>{' '}
                      <span className="ml-1 font-semibold text-emerald-700">
                        Save {formatAmount(currencyInfo.pricing.pro.amount * 12 - currencyInfo.pricingYearly.pro.amount)}
                      </span>
                    </p>
                  </div>
                )}
                {currencyCode !== 'USD' && (
                  <p className="mt-2 text-center text-sm text-gray-500">
                    ≈ ${billingInterval === 'yearly' ? (currencyInfo?.pricingYearly?.pro.usd ?? currencyInfo?.pricing.pro.usd) : currencyInfo?.pricing.pro.usd}
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 pt-6 pb-8 bg-white sm:p-10">
              {renderFeatures('pro')}
              <div className="mt-8">
                <button
                  onClick={() => handleUpgrade('pro')}
                  disabled={subscriptionTier === 'pro'}
                  className={`w-full py-4 px-6 rounded-xl shadow-lg font-semibold transition-all ${
                    subscriptionTier === 'pro'
                      ? 'bg-indigo-100 text-indigo-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-2xl transform hover:-translate-y-0.5'
                  }`}
                >
                  {subscriptionTier === 'pro'
                    ? '✓ Current Plan'
                    : subscriptionTier === 'business'
                      ? 'Downgrade to Pro'
                      : 'Continue to checkout'}
                </button>

                {subscriptionTier !== 'pro' && proTrialPrice && billingInterval !== 'trial' && (
                  <button
                    type="button"
                    onClick={() => router.push(`/checkout?plan=pro&billingInterval=trial`)}
                    className="mt-3 w-full py-3 px-6 rounded-xl border-2 border-indigo-200 bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition"
                  >
                    Try Pro for {proTrialPrice} ({paidTrialDays} days)
                  </button>
                )}
                {subscriptionTier !== 'pro' && (
                  <p className="mt-3 text-center text-xs text-gray-500">
                    14-day money-back guarantee{' '}
                    <Link href="/refunds/" className="text-indigo-600 hover:text-indigo-700 hover:underline">
                      (see policy)
                    </Link>
                    {' '}• Checkout in ~30 seconds
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Business Tier */}
          <div
            className={`relative rounded-2xl shadow-xl overflow-hidden transform transition hover:scale-105 ${
              subscriptionTier === 'business' ? 'ring-4 ring-indigo-600' : ''
            }`}
          >
            {billingInterval === 'yearly' && (
              <div className="absolute top-0 right-0 mt-4 mr-4">
                <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-emerald-600 text-white shadow-lg">
                  BEST VALUE
                </span>
              </div>
            )}
            <div className="px-6 py-8 bg-white sm:p-10 sm:pb-6">
              <div>
                <h3 className="text-center text-2xl font-bold text-gray-900">Business</h3>
                <p className="mt-2 text-center text-sm text-gray-500">For large teams & enterprises</p>
                <div className="mt-6 flex justify-center items-baseline">
                  <span className="text-6xl font-extrabold text-gray-900">{businessPrice}</span>
                  <span className="ml-2 text-xl font-medium text-gray-500">
                    /{billingInterval === 'trial' ? 'trial' : billingInterval === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {billingInterval === 'yearly' && currencyInfo?.pricingYearly && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-gray-600">
                      Only <span className="font-semibold text-gray-900">{formatAmount(currencyInfo.pricingYearly.business.amount / 12)}</span>/mo billed yearly
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      <span className="line-through">{formatAmount(currencyInfo.pricing.business.amount * 12)}</span>{' '}
                      <span className="ml-1">→</span>{' '}
                      <span className="ml-1 font-semibold text-emerald-700">
                        Save {formatAmount(currencyInfo.pricing.business.amount * 12 - currencyInfo.pricingYearly.business.amount)}
                      </span>
                    </p>
                  </div>
                )}
                {currencyCode !== 'USD' && (
                  <p className="mt-2 text-center text-sm text-gray-500">
                    ≈ ${billingInterval === 'yearly' ? (currencyInfo?.pricingYearly?.business.usd ?? currencyInfo?.pricing.business.usd) : currencyInfo?.pricing.business.usd}
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 pt-6 pb-8 bg-gray-50 sm:p-10">
              {renderFeatures('business')}
              <div className="mt-8">
                <button
                  onClick={() => handleUpgrade('business')}
                  disabled={subscriptionTier === 'business'}
                  className={`w-full py-4 px-6 rounded-xl shadow-lg font-semibold transition-all ${
                    subscriptionTier === 'business'
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-black hover:shadow-xl'
                  }`}
                >
                  {subscriptionTier === 'business' ? '✓ Current Plan' : 'Upgrade to Business'}
                </button>

                {subscriptionTier !== 'business' && businessTrialPrice && billingInterval !== 'trial' && (
                  <button
                    type="button"
                    onClick={() => router.push(`/checkout?plan=business&billingInterval=trial`)}
                    className="mt-3 w-full py-3 px-6 rounded-xl border-2 border-gray-300 bg-white text-gray-900 font-semibold hover:bg-gray-100 transition"
                  >
                    Try Business for {businessTrialPrice} ({paidTrialDays} days)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-20 border-t border-gray-200 pt-12">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-8">Why Choose Us?</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Secure & Reliable</h4>
                <p className="text-sm text-gray-600">Bank-level encryption & 99.9% uptime</p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Lightning Fast</h4>
                <p className="text-sm text-gray-600">Generate QR codes in milliseconds</p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">24/7 Support</h4>
                <p className="text-sm text-gray-600">Expert help whenever you need it</p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Money-Back Guarantee</h4>
                <p className="text-sm text-gray-600">
                  14-day money-back guarantee{' '}
                  <Link href="/refunds/" className="text-indigo-600 hover:text-indigo-700 hover:underline">
                    (see policy)
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 border-t border-gray-200 pt-12">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h3>
            <div className="space-y-6">
              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  Can I change plans later?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll
                  prorate any charges.
                </p>
              </details>

              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  What payment methods do you accept?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">
                  We accept all major credit cards, PayStack, and Flutterwave. All payments are processed securely.
                </p>
              </details>

              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  Is there a trial?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">
                  We offer a one-time paid trial option (no auto-renew) plus a 14-day money-back guarantee.{' '}
                  <Link href="/refunds/" className="text-indigo-600 hover:text-indigo-700 hover:underline">
                    Read the Refund Policy
                  </Link>
                  .
                </p>
              </details>

              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  Can I cancel anytime?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">
                  Absolutely! You can cancel your subscription at any time from your account dashboard. No cancellation
                  fees.
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
