'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import DashboardShell from '@/components/dashboard/DashboardShell';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
};

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success'; message: string };

async function fetchWithAuthFallback(
  getAccessToken: () => Promise<string | null>,
  input: RequestInfo,
  init?: RequestInit
) {
  let res = await fetch(input, init);

  if (res.status !== 401) return res;

  const token = await getAccessToken();
  if (!token) return res;

  const headers = new Headers(init?.headers || undefined);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

export default function DashboardQrPage() {
  const { getAccessToken } = useSupabaseAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [table, setTable] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuthFallback(getAccessToken, '/api/restaurant', { method: 'GET' });
        const json = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(json?.error || `Failed to load restaurant (${res.status})`);
        const r = (json as any)?.restaurant as Restaurant | null;
        if (!cancelled) setRestaurant(r);
      } catch (e: any) {
        if (!cancelled) setStatus({ kind: 'error', message: e?.message || 'Failed to load restaurant' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const menuUrl = useMemo(() => {
    if (!restaurant?.slug) return '';
    if (typeof window === 'undefined') return '';

    const base = `${window.location.origin}/menu/${restaurant.slug}`;
    const tableTrim = table.trim();
    if (!tableTrim) return base;

    const n = Number(tableTrim);
    if (!Number.isFinite(n) || n <= 0) return base;

    return `${base}?table=${encodeURIComponent(String(n))}`;
  }, [restaurant?.slug, table]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setStatus({ kind: 'success', message: 'Copied menu link' });
      setTimeout(() => setStatus({ kind: 'idle' }), 1500);
    } catch {
      setStatus({ kind: 'error', message: 'Copy failed. Please copy manually.' });
    }
  }

  return (
    <DashboardShell
      title="Menu QR"
      subtitle="Generate QR codes that open your menu and collect WhatsApp orders"
      actions={
        restaurant ? (
          <Link
            href={menuUrl || `/menu/${restaurant.slug}`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Preview menu
          </Link>
        ) : null
      }
    >
      {status.kind === 'error' ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{status.message}</div>
      ) : null}
      {status.kind === 'success' ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{status.message}</div>
      ) : null}

      {!loading && !restaurant ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Restaurant not set up yet</div>
          <p className="mt-1 text-sm text-amber-900/90">Create your restaurant profile first.</p>
          <div className="mt-3">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to settings
            </Link>
          </div>
        </div>
      ) : null}

      {restaurant ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-900">Menu link</label>
                <input
                  value={menuUrl}
                  readOnly
                  className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                />
                <p className="mt-2 text-xs text-gray-600">
                  Use the optional table number to help identify where the order is coming from.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900">Table (optional)</label>
                <input
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 5"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    disabled={!menuUrl}
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Copy
                  </button>
                  <a
                    href={menuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Generate QR (reuse existing generator)</div>
            <QRCodeGenerator initialUrl={menuUrl} />
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
