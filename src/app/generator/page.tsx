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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <h1 className="text-2xl font-bold mb-4">Open the Generator</h1>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Create QR codes, barcodes, sequences, and bulk batches from one place.
        </p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <SubscriptionInfo />

          <div className="bg-white shadow-md rounded-lg p-6 mt-6">
            <h2 className="text-lg font-bold text-gray-900">Quick Tabs</h2>
            <p className="text-sm text-gray-600 mt-1">Jump directly to a generator mode.</p>

            <div className="mt-4 space-y-2">
              <Link
                href="/generator#qrcode"
                className="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
              >
                <span className="font-semibold text-gray-900">QR Code</span>
                <span className="text-indigo-700">→</span>
              </Link>
              <Link
                href="/generator#barcode"
                className="flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-md transition"
              >
                <span className="font-semibold text-gray-900">Barcode</span>
                <span className="text-purple-700">→</span>
              </Link>
              <Link
                href="/generator#sequence"
                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition"
              >
                <span className="font-semibold text-gray-900">Sequence</span>
                <span className="text-gray-700">→</span>
              </Link>
              {subscriptionTier !== 'free' ? (
                <Link
                  href="/generator#bulk"
                  className="flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-md transition"
                >
                  <span className="font-semibold text-gray-900">Bulk Generator</span>
                  <span className="text-green-700">→</span>
                </Link>
              ) : (
                <Link
                  href="/pricing/"
                  className="flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-md transition"
                >
                  <span className="font-semibold text-gray-900">Unlock Bulk Generator</span>
                  <span className="text-green-700">Upgrade →</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Generator</h1>
                <p className="text-gray-600 text-sm">
                  Create QR codes, barcodes, sequences, and bulk batches.
                </p>
              </div>
              <Link href="/pricing/" className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
                Upgrade for premium features →
              </Link>
            </div>
            <UnifiedGenerator />
          </div>
        </div>
      </div>
    </div>
  );
}
