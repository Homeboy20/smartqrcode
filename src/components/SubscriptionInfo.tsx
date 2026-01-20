"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type BillingInterval = 'monthly' | 'yearly' | 'unknown';

type SubscriptionInfoProps = {
  variant?: 'default' | 'compact';
};

function parseDate(value: any): Date | null {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

function computeBillingIntervalFromDates(start: any, end: any): BillingInterval {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return 'unknown';
  const days = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(days) || days <= 0) return 'unknown';
  return days >= 300 ? 'yearly' : 'monthly';
}

export default function SubscriptionInfo({ variant = 'default' }: SubscriptionInfoProps) {
  const { 
    subscriptionTier, 
    loading,
    getLimit,
    featuresUsage,
    error
  } = useSubscription();

  const isCompact = variant === 'compact';

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('unknown');

  useEffect(() => {
    let mounted = true;

    async function fetchInterval() {
      try {
        // Only attempt to read subscription rows when the user is not on free tier.
        // RLS should allow users to read their own subscription row; if not, we just keep "unknown".
        if (subscriptionTier === 'free') {
          if (mounted) setBillingInterval('unknown');
          return;
        }

        const { data, error } = await supabase
          .from('subscriptions')
          .select('current_period_start,current_period_end,updated_at')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) return;
        const row = (data as any)?.[0];
        const interval = computeBillingIntervalFromDates(row?.current_period_start, row?.current_period_end);
        if (mounted) setBillingInterval(interval);
      } catch {
        // ignore
      }
    }

    fetchInterval();
    return () => {
      mounted = false;
    };
  }, [subscriptionTier]);

  const billingLabel = useMemo(() => {
    if (billingInterval === 'yearly') return 'Yearly';
    if (billingInterval === 'monthly') return 'Monthly';
    return 'Unknown';
  }, [billingInterval]);

  if (loading) {
    return (
      <div
        className={
          isCompact
            ? 'animate-pulse bg-gray-200 h-14 rounded-lg w-full'
            : 'animate-pulse bg-gray-200 h-32 rounded-lg w-full'
        }
      ></div>
    );
  }
  
  if (error) {
    // Show a warning instead of an error since we're falling back to defaults
    return (
      <div className={
        isCompact
          ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md'
          : 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4'
      }>
        {error}
      </div>
    );
  }

  const qrLimit = getLimit('qrGenerationLimit');
  const barcodeLimit = getLimit('barcodeGenerationLimit');
  const bulkLimit = getLimit('bulkGenerationLimit');

  const usageSummary = [
    `QR ${featuresUsage.qrCodesGenerated}/${qrLimit}`,
    `Barcode ${featuresUsage.barcodesGenerated}/${barcodeLimit}`,
    bulkLimit > 0 ? `Bulk ${featuresUsage.bulkGenerations}/${bulkLimit}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className={
      isCompact
        ? 'rounded-lg border border-gray-200 bg-white px-4 py-3'
        : 'bg-white shadow-md rounded-lg p-6 mb-6'
    }>
      <div className={
        isCompact
          ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'
          : 'flex justify-between items-center mb-4'
      }>
        <div className={isCompact ? 'flex items-center gap-2' : undefined}>
          <h2 className={isCompact ? 'text-sm font-semibold text-gray-900' : 'text-xl font-bold text-gray-800'}>
            Your Subscription
          </h2>
          {subscriptionTier !== 'free' && isCompact ? (
            <span className="text-xs font-semibold text-gray-500">({billingLabel})</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className={
            isCompact
              ? 'px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize'
              : 'px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 capitalize'
          }>
            {subscriptionTier}
          </span>

          {subscriptionTier === 'free' ? (
            <Link
              href="/pricing"
              className={
                isCompact
                  ? 'inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700'
                  : 'block text-center w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-200'
              }
            >
              Upgrade
            </Link>
          ) : null}
        </div>
      </div>

      {subscriptionTier !== 'free' && !isCompact && (
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Billing:</span> {billingLabel}
        </div>
      )}

      {isCompact ? (
        <p className="mt-2 text-xs text-gray-600">{usageSummary}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">QR Codes Generated</h3>
            <div className="flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, (featuresUsage.qrCodesGenerated / qrLimit) * 100)}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700 ml-2">
                {featuresUsage.qrCodesGenerated} / {qrLimit}
              </span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Barcodes Generated</h3>
            <div className="flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, (featuresUsage.barcodesGenerated / barcodeLimit) * 100)}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700 ml-2">
                {featuresUsage.barcodesGenerated} / {barcodeLimit}
              </span>
            </div>
          </div>
          
          {bulkLimit > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Bulk Generations</h3>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full" 
                    style={{ 
                      width: `${Math.min(100, (featuresUsage.bulkGenerations / bulkLimit) * 100)}%` 
                    }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-700 ml-2">
                  {featuresUsage.bulkGenerations} / {bulkLimit}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {subscriptionTier === 'free' && !isCompact && (
        <div className="mt-6">
          <Link 
            href="/pricing" 
            className="block text-center w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-200"
          >
            Upgrade Your Plan
          </Link>
        </div>
      )}
    </div>
  );
} 