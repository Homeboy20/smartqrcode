"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type BillingInterval = 'monthly' | 'yearly' | 'unknown';

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

export default function SubscriptionInfo() {
  const { 
    subscriptionTier, 
    loading,
    getLimit,
    featuresUsage,
    error
  } = useSubscription();

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
    return <div className="animate-pulse bg-gray-200 h-32 rounded-lg w-full"></div>;
  }
  
  if (error) {
    // Show a warning instead of an error since we're falling back to defaults
    return <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
      {error}
    </div>;
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Your Subscription</h2>
        <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
          {subscriptionTier}
        </span>
      </div>

      {subscriptionTier !== 'free' && (
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Billing:</span> {billingLabel}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">QR Codes Generated</h3>
          <div className="flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ 
                  width: `${Math.min(100, (featuresUsage.qrCodesGenerated / getLimit('qrGenerationLimit')) * 100)}%` 
                }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-700 ml-2">
              {featuresUsage.qrCodesGenerated} / {getLimit('qrGenerationLimit')}
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
                  width: `${Math.min(100, (featuresUsage.barcodesGenerated / getLimit('barcodeGenerationLimit')) * 100)}%` 
                }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-700 ml-2">
              {featuresUsage.barcodesGenerated} / {getLimit('barcodeGenerationLimit')}
            </span>
          </div>
        </div>
        
        {getLimit('bulkGenerationLimit') > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Bulk Generations</h3>
            <div className="flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-purple-600 h-2.5 rounded-full" 
                  style={{ 
                    width: `${Math.min(100, (featuresUsage.bulkGenerations / getLimit('bulkGenerationLimit')) * 100)}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700 ml-2">
                {featuresUsage.bulkGenerations} / {getLimit('bulkGenerationLimit')}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {subscriptionTier === 'free' && (
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