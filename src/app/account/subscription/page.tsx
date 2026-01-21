"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionFeatures, subscriptionPricing, SubscriptionTier } from '@/lib/subscriptions';

export default function UserSubscriptionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSupabaseAuth();
  const { subscriptionTier, loading: subscriptionLoading, error } = useSubscription();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/account/subscription');
    }
  }, [authLoading, user, router]);

  if (authLoading || subscriptionLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading subscription details...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const tier = (subscriptionTier || 'free') as SubscriptionTier;
  const features = subscriptionFeatures[tier];
  const price = subscriptionPricing[tier];

  const renderFeaturesList = (t: SubscriptionTier) => {
    const f = subscriptionFeatures[t];
    return (
      <ul className="mt-3 space-y-2 text-sm text-gray-700">
        <li className="flex items-center justify-between">
          <span>QR Codes</span>
          <span className="font-semibold">{f.maxQRCodes}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Barcodes</span>
          <span className="font-semibold">{f.maxBarcodes}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Bulk generation</span>
          <span className="font-semibold">{f.bulkGenerationAllowed ? `Yes (up to ${f.maxBulkItems})` : 'No'}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>AI customization</span>
          <span className="font-semibold">{f.aiCustomizationAllowed ? `Yes (up to ${f.maxAICustomizations}/mo)` : 'No'}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Analytics</span>
          <span className="font-semibold">{f.analyticsEnabled ? 'Yes' : 'No'}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Custom branding</span>
          <span className="font-semibold">{f.customBrandingAllowed ? 'Yes' : 'No'}</span>
        </li>
        <li className="flex items-center justify-between">
          <span>Team members</span>
          <span className="font-semibold">{f.teamMembersAllowed ? `Up to ${f.maxTeamMembers}` : 'No'}</span>
        </li>
      </ul>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Subscription</h1>
          <p className="mt-1 text-sm text-gray-600">Manage your plan and features.</p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Upgrade
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-sm text-yellow-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current plan</h2>
            <p className="text-sm text-gray-600 capitalize">{tier}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{tier === 'free' ? 'Free' : `$${price}/mo`}</div>
            <div className="text-xs text-gray-500">Billed monthly</div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900">Included features</h3>
          {renderFeaturesList(tier)}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/generator"
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-black"
          >
            Create a code
          </Link>
          <Link
            href="/analytics"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-md hover:bg-gray-50"
          >
            View analytics
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['free', 'pro', 'business'] as SubscriptionTier[]).map((t) => (
          <div key={t} className={`bg-white rounded-lg shadow p-6 border ${t === tier ? 'border-indigo-200' : 'border-transparent'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold capitalize">{t}</h3>
              {t === tier && (
                <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700">Current</span>
              )}
            </div>
            <div className="mt-2 text-2xl font-bold">{t === 'free' ? 'Free' : `$${subscriptionPricing[t]}/mo`}</div>
            {renderFeaturesList(t)}
            <div className="mt-4">
              <Link
                href="/pricing"
                className="inline-flex w-full justify-center px-4 py-2 rounded-md border border-gray-200 hover:bg-gray-50"
              >
                {t === tier ? 'View details' : 'Choose'}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
