"use client";

import React, { useEffect, useState } from 'react';
import { subscriptionFeatures, SubscriptionTier } from '@/lib/subscriptions';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import PaymentProviderSelector, { PaymentProvider } from '@/components/PaymentProviderSelector';
import { providerSupportsPaymentMethod, type CheckoutPaymentMethod } from '@/lib/checkout/paymentMethodSupport';

interface CurrencyInfo {
  country: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  availableProviders?: PaymentProvider[];
  recommendedProvider: 'paystack' | 'flutterwave';
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
}

export default function PricingPage() {
  const { user, getAccessToken } = useSupabaseAuth();
  const { subscriptionTier, loading } = useSubscription();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('paystack');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('mobile_money');
  const [email, setEmail] = useState('');
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [loadingCurrency, setLoadingCurrency] = useState(true);

  const availableProviders = currencyInfo?.availableProviders;
  const filteredProviders = (availableProviders || []).filter((provider) =>
    providerSupportsPaymentMethod(provider, paymentMethod)
  );

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    // Fetch currency information on mount
    fetch('/api/pricing')
      .then((res) => res.json())
      .then((data) => {
        setCurrencyInfo(data);
        setSelectedProvider(data.recommendedProvider);
      })
      .catch((err) => {
        console.error('Failed to fetch currency info:', err);
        // Use defaults on error
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
      })
      .finally(() => setLoadingCurrency(false));
  }, []);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') {
      // Free plan should not open the payment modal.
      setShowCheckoutModal(false);
      window.location.href = user ? '/dashboard' : '/register';
      return;
    }

    // Set tier and show modal immediately - no login required!
    setSelectedTier(tier);
    setEmail(user?.email || '');
    setShowCheckoutModal(true);
  };

  const handleCheckout = async () => {
    if (!selectedTier || !email) {
      alert('Please enter your email');
      return;
    }

    if (selectedTier === 'free') {
      alert('Free plan does not require payment.');
      setShowCheckoutModal(false);
      return;
    }

    if (availableProviders && filteredProviders.length === 0) {
      alert('No payment gateways support the selected payment option. Please choose another option.');
      return;
    }

    try {
      // For new users (no account), we'll auto-create on payment success
      // For existing users, link payment to their account
      const checkoutData = {
        planId: selectedTier,
        provider: selectedProvider,
        paymentMethod: paymentMethod,
        email: email,
        successUrl: `${window.location.origin}/dashboard?welcome=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`,
      };

      // If user is logged in, include auth token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      const accessToken = await getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      // Create checkout session via API
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(checkoutData),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        // If server returned non-JSON (e.g., plain text stack), surface it.
        throw new Error(raw || 'Failed to create checkout session');
      }
      
      if (!response.ok) {
        const errorMessage = data.error || 'Failed to create checkout session';
        throw new Error(errorMessage);
      }
      
      // Redirect to payment gateway
      if (data.url) {
        // Close modal before redirect
        setShowCheckoutModal(false);
        // Redirect to payment page
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      alert(`Checkout error: ${error instanceof Error ? error.message : 'Unknown error. Please try again.'}`);
    }
  };

  useEffect(() => {
    if (!availableProviders) return;
    if (filteredProviders.length === 0) return;
    if (!filteredProviders.includes(selectedProvider)) {
      setSelectedProvider(filteredProviders[0]);
    }
  }, [availableProviders, filteredProviders, selectedProvider]);

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
          <span className="ml-3">
            Bulk generation {features.bulkGenerationAllowed ? `(${features.maxBulkItems} items)` : ''}
          </span>
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
          <span className="ml-3">
            AI customization {features.aiCustomizationAllowed ? `(${features.maxAICustomizations} designs)` : ''}
          </span>
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
          <span className="ml-3">
            Team members {features.teamMembersAllowed ? `(${features.maxTeamMembers} members)` : ''}
          </span>
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

  const proPrice = currencyInfo?.pricing.pro.formatted || '$9.99';
  const businessPrice = currencyInfo?.pricing.business.formatted || '$29.99';
  const currencySymbol = currencyInfo?.currency.symbol || '$';
  const currencyCode = currencyInfo?.currency.code || 'USD';

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
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid grid-cols-1 gap-y-10 gap-x-8 lg:grid-cols-3">
          {/* Free Tier */}
          <div className={`relative rounded-2xl shadow-xl overflow-hidden transform transition hover:scale-105 ${subscriptionTier === 'free' ? 'ring-4 ring-indigo-600' : ''}`}>
            <div className="px-6 py-8 bg-white sm:p-10 sm:pb-6">
              <div>
                <h3 className="text-center text-2xl font-bold text-gray-900">
                  Free
                </h3>
                <p className="mt-2 text-center text-sm text-gray-500">Perfect to get started</p>
                <div className="mt-6 flex justify-center items-baseline">
                  <span className="text-6xl font-extrabold text-gray-900">$0</span>
                  <span className="ml-2 text-xl font-medium text-gray-500">/month</span>
                </div>
              </div>
            </div>
            <div className="px-6 pt-6 pb-8 bg-gray-50 sm:p-10">
              {renderFeatures('free')}
              <div className="mt-8">
                <button
                  onClick={() => handleUpgrade('free')}
                  disabled={subscriptionTier === 'free'}
                  className={`w-full py-4 px-6 rounded-xl shadow-lg font-semibold transition-all ${
                    subscriptionTier === 'free'
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-800 text-white hover:bg-gray-900 hover:shadow-xl'
                  }`}
                >
                  {subscriptionTier === 'free' ? '✓ Current Plan' : 'Get Started Free'}
                </button>
              </div>
            </div>
          </div>

          {/* Pro Tier - MOST POPULAR */}
          <div className={`relative rounded-2xl shadow-2xl overflow-hidden transform transition hover:scale-105 ${subscriptionTier === 'pro' ? 'ring-4 ring-indigo-600' : 'ring-2 ring-indigo-500'}`}>
            {/* Popular Badge */}
            <div className="absolute top-0 right-0 mt-4 mr-4">
              <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                ⭐ MOST POPULAR
              </span>
            </div>
            <div className="px-6 py-8 bg-gradient-to-br from-indigo-50 to-white sm:p-10 sm:pb-6">
              <div>
                <h3 className="text-center text-2xl font-bold text-gray-900">
                  Pro
                </h3>
                <p className="mt-2 text-center text-sm text-indigo-600 font-medium">Best for growing businesses</p>
                <div className="mt-6 flex justify-center items-baseline">
                  <span className="text-6xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{proPrice}</span>
                  <span className="ml-2 text-xl font-medium text-gray-500">/month</span>
                </div>
                {currencyCode !== 'USD' && (
                  <p className="mt-2 text-center text-sm text-gray-500">
                    ≈ ${currencyInfo?.pricing.pro.usd}
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
                  {subscriptionTier === 'pro' ? '✓ Current Plan' : 
                   subscriptionTier === 'business' ? 'Downgrade to Pro' : '🚀 Start Free Trial'}
                </button>
                {subscriptionTier !== 'pro' && (
                  <p className="mt-3 text-center text-xs text-gray-500">
                    No payment required • Start trial in 30 seconds
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Business Tier */}
          <div className={`relative rounded-2xl shadow-xl overflow-hidden transform transition hover:scale-105 ${subscriptionTier === 'business' ? 'ring-4 ring-indigo-600' : ''}`}>
            <div className="px-6 py-8 bg-white sm:p-10 sm:pb-6">
              <div>
                <h3 className="text-center text-2xl font-bold text-gray-900">
                  Business
                </h3>
                <p className="mt-2 text-center text-sm text-gray-500">For large teams & enterprises</p>
                <div className="mt-6 flex justify-center items-baseline">
                  <span className="text-6xl font-extrabold text-gray-900">{businessPrice}</span>
                  <span className="ml-2 text-xl font-medium text-gray-500">/month</span>
                </div>
                {currencyCode !== 'USD' && (
                  <p className="mt-2 text-center text-sm text-gray-500">
                    ≈ ${currencyInfo?.pricing.business.usd}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">24/7 Support</h4>
                <p className="text-sm text-gray-600">Expert help whenever you need it</p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Money-Back Guarantee</h4>
                <p className="text-sm text-gray-600">14-day no-questions-asked refund</p>
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
                <p className="mt-3 text-gray-600 text-sm">Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll prorate any charges.</p>
              </details>
              
              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  What payment methods do you accept?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">We accept all major credit cards, PayStack, and Flutterwave. All payments are processed securely.</p>
              </details>
              
              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  Is there a free trial?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">Yes! Pro and Business plans come with a 14-day free trial. No credit card required to start.</p>
              </details>
              
              <details className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition">
                <summary className="font-semibold text-gray-900 cursor-pointer flex items-center justify-between">
                  Can I cancel anytime?
                  <span className="ml-2 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-gray-600 text-sm">Absolutely! You can cancel your subscription at any time from your account dashboard. No cancellation fees.</p>
              </details>
            </div>
          </div>
        </div>
        
        {/* Checkout Section */}
        {showCheckoutModal && selectedTier && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setShowCheckoutModal(false)}
              ></div>

              {/* Modal panel */}
              <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-lg animate-slideUp">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Plan
                      </h3>
                      <p className="mt-1 text-indigo-100 text-sm">
                        14-day free trial • Cancel anytime
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCheckoutModal(false)}
                      className="text-white hover:text-gray-200 transition"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Price */}
                  <div className="mt-4 flex items-baseline">
                    <span className="text-5xl font-extrabold text-white">
                      {selectedTier === 'pro' ? proPrice : businessPrice}
                    </span>
                    <span className="ml-2 text-xl text-indigo-100">/month</span>
                  </div>
                </div>

                {/* Form */}
                <div className="px-6 py-6 space-y-6">
                  {/* Email field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {user ? 'We\'ll send your receipt here' : 'We\'ll create your account automatically'}
                    </p>
                  </div>

                  {/* Payment Method Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Mobile Money - HIGHLIGHTED */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('mobile_money')}
                        className={`relative flex flex-col items-center p-4 border-2 rounded-lg transition-all ${
                          paymentMethod === 'mobile_money'
                            ? 'border-indigo-600 bg-indigo-50 shadow-md'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {paymentMethod === 'mobile_money' && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <div className="text-3xl mb-2">📱</div>
                        <span className="text-sm font-medium text-gray-900">Mobile Money</span>
                        <span className="text-xs text-gray-500 mt-1">M-Pesa, Airtel</span>
                      </button>

                      {/* Card */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`relative flex flex-col items-center p-4 border-2 rounded-lg transition-all ${
                          paymentMethod === 'card'
                            ? 'border-indigo-600 bg-indigo-50 shadow-md'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {paymentMethod === 'card' && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <div className="text-3xl mb-2">💳</div>
                        <span className="text-sm font-medium text-gray-900">Card</span>
                        <span className="text-xs text-gray-500 mt-1">Visa, Mastercard</span>
                      </button>

                      {/* Apple Pay */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('apple_pay')}
                        className={`relative flex flex-col items-center p-4 border-2 rounded-lg transition-all ${
                          paymentMethod === 'apple_pay'
                            ? 'border-indigo-600 bg-indigo-50 shadow-md'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {paymentMethod === 'apple_pay' && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <div className="text-3xl mb-2"></div>
                        <span className="text-sm font-medium text-gray-900">Apple Pay</span>
                        <span className="text-xs text-gray-500 mt-1">1-tap</span>
                      </button>

                      {/* Google Pay */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('google_pay')}
                        className={`relative flex flex-col items-center p-4 border-2 rounded-lg transition-all ${
                          paymentMethod === 'google_pay'
                            ? 'border-indigo-600 bg-indigo-50 shadow-md'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {paymentMethod === 'google_pay' && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <div className="text-3xl mb-2">G</div>
                        <span className="text-sm font-medium text-gray-900">Google Pay</span>
                        <span className="text-xs text-gray-500 mt-1">1-tap</span>
                      </button>
                    </div>
                  </div>

                  {/* Payment Provider */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Payment Processor
                    </label>
                    {availableProviders && filteredProviders.length === 0 && (
                      <p className="mb-3 text-sm text-red-600">
                        No gateways support the selected payment option.
                      </p>
                    )}
                    <PaymentProviderSelector
                      selectedProvider={selectedProvider}
                      onSelectProvider={setSelectedProvider}
                      availableProviders={availableProviders ? filteredProviders : undefined}
                    />
                  </div>

                  {/* Trust signals */}
                  <div className="flex items-center justify-center space-x-6 text-xs text-gray-500 border-t pt-4">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-green-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Secure Payment
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-blue-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Cancel Anytime
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-yellow-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      Instant Access
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={handleCheckout}
                    disabled={Boolean(availableProviders) && filteredProviders.length === 0}
                    className="w-full py-4 px-6 rounded-xl shadow-lg font-bold text-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    🚀 Start 14-Day Free Trial
                  </button>

                  <p className="text-center text-xs text-gray-500">
                    No payment required now. You'll only be charged after your trial ends.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}