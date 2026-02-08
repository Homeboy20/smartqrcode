'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { useRouter } from 'next/navigation';

import DashboardShell from '@/components/dashboard/DashboardShell';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRestaurantAccess } from '@/hooks/useRestaurantAccess';
import { useSubscription } from '@/hooks/useSubscription';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  enable_table_qr?: boolean;
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
  const router = useRouter();
  const { getAccessToken } = useSupabaseAuth();
  const { loading: accessLoading, access } = useRestaurantAccess();
  const { subscriptionTier, baseSubscriptionTier, loading: subscriptionLoading, canUseFeature } = useSubscription();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [table, setTable] = useState('');

  const [tableStart, setTableStart] = useState('1');
  const [tableEnd, setTableEnd] = useState('20');

  useEffect(() => {
    if (accessLoading) return;
    if (access && !access.isOwner) {
      router.replace('/dashboard/orders');
    }
  }, [accessLoading, access, router]);

  useEffect(() => {
    let cancelled = false;

    if (subscriptionLoading) return;
    if (!canUseFeature('restaurant')) return;

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
  }, [getAccessToken, subscriptionLoading, canUseFeature]);

  const baseTier = baseSubscriptionTier || subscriptionTier;
  const hasRestaurantAccess = canUseFeature('restaurant');

  const menuUrl = useMemo(() => {
    if (!restaurant?.slug) return '';
    if (typeof window === 'undefined') return '';

    const base = `${window.location.origin}/menu/${restaurant.slug}`;
    if (!restaurant.enable_table_qr) return base;
    const tableTrim = table.trim();
    if (!tableTrim) return base;

    const n = Number(tableTrim);
    if (!Number.isFinite(n) || n <= 0) return base;

    return `${base}?table=${encodeURIComponent(String(n))}`;
  }, [restaurant?.slug, table]);

  const tableUrls = useMemo(() => {
    if (!restaurant?.slug) return [] as Array<{ table: number; url: string }>;
    if (typeof window === 'undefined') return [];
    if (!restaurant.enable_table_qr) return [];

    const start = Number(tableStart.trim());
    const end = Number(tableEnd.trim());
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

    const a = Math.max(1, Math.min(start, end));
    const b = Math.max(1, Math.max(start, end));
    const max = Math.min(200, b - a + 1);

    const base = `${window.location.origin}/menu/${restaurant.slug}`;
    const rows: Array<{ table: number; url: string }> = [];
    for (let i = 0; i < max; i++) {
      const n = a + i;
      rows.push({ table: n, url: `${base}?table=${encodeURIComponent(String(n))}` });
    }
    return rows;
  }, [restaurant?.slug, tableStart, tableEnd]);

  const tableCsv = useMemo(() => {
    if (!tableUrls.length) return '';
    const rows = ['table,url', ...tableUrls.map((t) => `${t.table},${t.url}`)];
    return rows.join('\n');
  }, [tableUrls]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setStatus({ kind: 'success', message: 'Copied menu link' });
      setTimeout(() => setStatus({ kind: 'idle' }), 1500);
    } catch {
      setStatus({ kind: 'error', message: 'Copy failed. Please copy manually.' });
    }
  }

  async function copyTableLinks() {
    if (!tableUrls.length) return;
    try {
      const text = tableUrls.map((t) => `Table ${t.table}: ${t.url}`).join('\n');
      await navigator.clipboard.writeText(text);
      setStatus({ kind: 'success', message: 'Copied table links' });
      setTimeout(() => setStatus({ kind: 'idle' }), 1500);
    } catch {
      setStatus({ kind: 'error', message: 'Copy failed. Please try again.' });
    }
  }

  function downloadTableCsv() {
    if (!tableCsv) return;
    const blob = new Blob([tableCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table-qr-links-${restaurant?.slug || 'menu'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell
      title="Menu QR"
      subtitle="Generate QR codes that open your menu and collect WhatsApp orders"
      actions={
        subscriptionLoading || baseTier === 'free' || !hasRestaurantAccess ? null : restaurant ? (
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
      {subscriptionLoading ? (
        <div className="max-w-3xl mx-auto">
          <div className="h-24 bg-gray-200 animate-pulse rounded-lg" />
        </div>
      ) : baseTier === 'free' || !hasRestaurantAccess ? (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900">Restaurant QR tools are a premium feature</h1>
            <p className="mt-2 text-gray-600">Start a paid trial or subscribe to generate menu/table QR codes.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/pricing?required=1&redirect=${encodeURIComponent('/dashboard/qr')}`}
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                View plans
              </Link>
              <Link
                href="/generator"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Continue to generator
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
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
                  {restaurant.enable_table_qr
                    ? 'Use the optional table number to help identify where the order is coming from.'
                    : 'This is your main menu link (table identity is currently disabled).'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900">Table (optional)</label>
                <input
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  inputMode="numeric"
                  disabled={!restaurant.enable_table_qr}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 5"
                />
                {!restaurant.enable_table_qr ? (
                  <div className="mt-2 text-xs text-gray-500">
                    Enable table QRs in <Link href="/dashboard/settings" className="text-indigo-600 hover:text-indigo-700 font-semibold">Settings</Link>.
                  </div>
                ) : null}
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

          {restaurant.enable_table_qr ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">Dine-in table QRs</div>
                <p className="mt-1 text-xs text-gray-600">Generate one QR per table. Each QR includes the table number identity.</p>
              </div>
              <div className="text-xs text-gray-500">Up to 200 tables per batch</div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Start</label>
                <input
                  value={tableStart}
                  onChange={(e) => setTableStart(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">End</label>
                <input
                  value={tableEnd}
                  onChange={(e) => setTableEnd(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="20"
                />
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700">Tip</label>
                <div className="mt-2 text-xs text-gray-600">Print and place on each table.</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyTableLinks}
                disabled={!tableUrls.length}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Copy all links
              </button>
              <button
                type="button"
                onClick={downloadTableCsv}
                disabled={!tableUrls.length}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Download CSV
              </button>
            </div>

            {tableUrls.length ? (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {tableUrls.map((t) => (
                  <div key={t.table} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs font-bold text-gray-900">Table {t.table}</div>
                    <div className="mt-2 bg-white rounded-md border border-gray-200 p-2 flex items-center justify-center">
                      <QRCode value={t.url} size={140} />
                    </div>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Open link
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-xs text-gray-500">Set a valid start/end to generate table QRs.</div>
            )}
          </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Dine-in table QRs</div>
              <p className="mt-1 text-sm text-gray-600">
                Enable table QRs in Settings to generate per-table codes with table number identity.
              </p>
              <div className="mt-3">
                <Link
                  href="/dashboard/settings"
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Go to settings
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : null}
        </>
      )}
    </DashboardShell>
  );
}
