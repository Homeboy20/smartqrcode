"use client";

import React from 'react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionInfo from '@/components/SubscriptionInfo';
import UnifiedGenerator from '@/components/UnifiedGenerator';

export default function GeneratorPage() {
  const { user } = useSupabaseAuth();
  const { subscriptionTier, loading } = useSubscription();

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="px-6 py-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Try the Generator</h1>
                  <p className="text-gray-600 text-sm">
                    Create a QR code or barcode without signing up. Advanced exports, analytics, and dynamic edits require an account.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/login"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-md"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 font-semibold py-2 px-6 rounded-md"
                  >
                    Create an Account
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Free preview: generate one-off codes. Advanced exports, bulk ZIP, analytics, and dynamic edits require an account.
            </div>
            <UnifiedGenerator />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto grid gap-6">
        <div className="h-28 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="h-96 bg-gray-200 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="px-6 py-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Generator</h1>
                <p className="text-gray-600 text-sm">
                  Create QR codes, barcodes, sequences, and bulk batches.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/generator#qrcode"
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    QR Code
                  </Link>
                  <Link
                    href="/generator#barcode"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Barcode
                  </Link>
                  <Link
                    href="/generator#sequence"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Sequence
                  </Link>
                  {subscriptionTier !== 'free' ? (
                    <Link
                      href="/generator#bulk"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Bulk
                    </Link>
                  ) : null}
                </div>

                {subscriptionTier === 'free' ? (
                  <Link
                    href="/pricing/"
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Upgrade
                  </Link>
                ) : (
                  <Link
                    href="/pricing/"
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Manage plan
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="mb-6">
            <SubscriptionInfo variant="compact" />
          </div>
          <UnifiedGenerator />
        </div>
      </div>
    </div>
  );
}
