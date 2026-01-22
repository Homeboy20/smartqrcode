"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import SubscriptionInfo from '@/components/SubscriptionInfo';
import { useSubscription } from '@/hooks/useSubscription';
import { useRestaurantAccess } from '@/hooks/useRestaurantAccess';

type RecentCode = {
  id: string;
  name: string;
  type: 'qrcode' | 'barcode' | string;
  scans: number;
  created_at?: string;
  updated_at?: string;
};

function formatShortDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, getAccessToken } = useSupabaseAuth();
  const { subscriptionTier, loading, featuresUsage, limits } = useSubscription();
  const { loading: accessLoading, access } = useRestaurantAccess();

  const [recentCodes, setRecentCodes] = useState<RecentCode[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    // Backward compatibility: old links used /dashboard#generator.
    if (typeof window !== 'undefined' && window.location.hash === '#generator') {
      router.replace('/generator');
    }
  }, [router]);

  useEffect(() => {
    if (accessLoading) return;
    if (access && !access.isOwner) {
      router.replace('/dashboard/orders');
    }
  }, [accessLoading, access, router]);

  useEffect(() => {
    if (!user) {
      setRecentCodes(null);
      setRecentError(null);
      setRecentLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setRecentLoading(true);
      setRecentError(null);
      try {
        // Preferred: cookie auth (httpOnly, managed by Supabase SSR).
        // If cookie auth isn't available yet, we fall back to a Bearer token.
        let res = await fetch('/api/codes/recent?limit=5', { method: 'GET' });
        if (res.status === 401) {
          let token: string | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            token = await getAccessToken();
            if (token) break;
            await new Promise((r) => setTimeout(r, 150));
          }

          if (token) {
            res = await fetch('/api/codes/recent?limit=5', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          }
        }

        const json = await res.json().catch(() => ({} as any));

        if (!res.ok) {
          throw new Error(json?.error || `Failed to load recent codes (${res.status})`);
        }

        const codes = Array.isArray((json as any)?.codes) ? ((json as any).codes as RecentCode[]) : [];
        if (!cancelled) setRecentCodes(codes);
      } catch (err: any) {
        if (!cancelled) {
          setRecentError(err?.message || 'Failed to load recent codes');
          setRecentCodes([]);
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken]);

  const greetingName = useMemo(() => {
    const meta = (user?.user_metadata as any) || {};
    return meta.display_name || meta.full_name || user?.email || 'there';
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
        <p className="text-gray-600 mb-6">You need to be signed in to access your dashboard.</p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>
          <div className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>
          <div className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
        <div className="h-64 bg-gray-200 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {greetingName}</h1>
            <p className="text-sm text-gray-600">Manage your generators, dynamic codes, and account.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/generator#qrcode"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              New QR
            </Link>
            <Link
              href="/generator#barcode"
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              New Barcode
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Account
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">QR codes generated</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{featuresUsage.qrCodesGenerated}</div>
          <div className="mt-2 text-xs text-gray-500">Daily limit: {limits.qrGenerationLimit.daily}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Barcodes generated</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{featuresUsage.barcodesGenerated}</div>
          <div className="mt-2 text-xs text-gray-500">Daily limit: {limits.barcodeGenerationLimit.daily}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Bulk generations</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{featuresUsage.bulkGenerations}</div>
          <div className="mt-2 text-xs text-gray-500">Daily limit: {limits.bulkGenerationLimit.daily}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="w-full md:w-1/3">
          <SubscriptionInfo />

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tools</h2>
            <div className="space-y-2">
              <Link
                href="/generator#qrcode"
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">QR Generator</span>
                <span className="text-xs text-gray-500">Static & Dynamic</span>
              </Link>

              <Link
                href="/generator#barcode"
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">Barcode Generator</span>
                <span className="text-xs text-gray-500">Multiple formats</span>
              </Link>

              <Link
                href="/sequence"
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">Sequence Generator</span>
                <span className="text-xs text-gray-500">Numbered batches</span>
              </Link>

              <Link
                href={subscriptionTier === 'free' ? '/pricing' : '/generator#bulk'}
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">Bulk Generator</span>
                <span className="text-xs text-gray-500">ZIP download</span>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mt-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Restaurant Menu</h2>
            <div className="space-y-2">
              <Link
                href="/dashboard/settings"
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">Onboarding & Settings</span>
                <span className="text-xs text-gray-500">WhatsApp + payments</span>
              </Link>

              <Link
                href="/dashboard/menu"
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">Manage Menu</span>
                <span className="text-xs text-gray-500">CRUD items</span>
              </Link>

              <Link
                href="/dashboard/qr"
                className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900">Generate Menu QR</span>
                <span className="text-xs text-gray-500">/menu/slug</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="w-full md:w-2/3">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recent dynamic codes</h2>
              <Link href="/generator#qrcode" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                Create a dynamic code
              </Link>
            </div>

            {recentLoading ? (
              <div className="space-y-3">
                <div className="h-12 bg-gray-100 animate-pulse rounded-md"></div>
                <div className="h-12 bg-gray-100 animate-pulse rounded-md"></div>
                <div className="h-12 bg-gray-100 animate-pulse rounded-md"></div>
              </div>
            ) : recentError ? (
              <div className="border border-red-200 bg-red-50 text-red-800 rounded-md p-4 text-sm">
                {recentError}
              </div>
            ) : (recentCodes && recentCodes.length > 0) ? (
              <div className="divide-y divide-gray-100">
                {recentCodes.map((code) => (
                  <div key={code.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{code.name}</span>
                        <span className={
                          `text-xs font-semibold px-2 py-0.5 rounded-full ${code.type === 'barcode' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`
                        }>
                          {code.type === 'barcode' ? 'Barcode' : 'QR'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatShortDate(code.created_at)}{typeof code.scans === 'number' ? ` • ${code.scans} scans` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/c/${code.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Open
                      </Link>

                      <Link
                        href={`/dashboard/codes/${code.id}/analytics`}
                        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        Analytics
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md p-6 text-center">
                <div className="text-sm text-gray-700 font-semibold">No dynamic codes yet</div>
                <p className="mt-1 text-sm text-gray-600">
                  Create a dynamic QR code to get a short link you can update later.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link
                    href="/generator#qrcode"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Create QR
                  </Link>
                  <Link
                    href={subscriptionTier === 'free' ? '/pricing' : '/generator#barcode'}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    {subscriptionTier === 'free' ? 'Upgrade' : 'Create Barcode'}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}