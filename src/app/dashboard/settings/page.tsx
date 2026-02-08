'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRestaurantAccess } from '@/hooks/useRestaurantAccess';
import { useSubscription } from '@/hooks/useSubscription';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  accepted_payments: string[];
  enable_table_qr?: boolean;
  logo_url?: string | null;
  brand_primary_color?: string;
  whatsapp_order_note?: string | null;
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

function paymentsToString(payments: string[]) {
  return (payments || []).join(', ');
}

function parsePayments(value: string) {
  return value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function DashboardSettingsPage() {
  const router = useRouter();
  const { getAccessToken } = useSupabaseAuth();
  const { loading: accessLoading, access } = useRestaurantAccess();
  const { subscriptionTier, baseSubscriptionTier, loading: subscriptionLoading, canUseFeature } = useSubscription();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [acceptedPaymentsText, setAcceptedPaymentsText] = useState('');
  const [enableTableQr, setEnableTableQr] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#111827');
  const [whatsappOrderNote, setWhatsappOrderNote] = useState('');

  useEffect(() => {
    if (accessLoading) return;
    if (access && !access.isOwner) {
      router.replace('/dashboard/orders');
    }
  }, [accessLoading, access, router]);

  const baseTier = baseSubscriptionTier || subscriptionTier;
  const hasRestaurantAccess = canUseFeature('restaurant');

  useEffect(() => {
    let cancelled = false;

    if (subscriptionLoading) return;
    if (!hasRestaurantAccess) return;

    (async () => {
      setLoading(true);
      setStatus({ kind: 'idle' });

      try {
        const res = await fetchWithAuthFallback(getAccessToken, '/api/restaurant', { method: 'GET' });
        const json = await res.json().catch(() => ({} as any));

        if (!res.ok) throw new Error(json?.error || `Failed to load restaurant (${res.status})`);

        const r = (json as any)?.restaurant as Restaurant | null;
        if (cancelled) return;

        setRestaurant(r);
        if (r) {
          setName(r.name);
          setWhatsappNumber(r.whatsapp_number);
          setAcceptedPaymentsText(paymentsToString(r.accepted_payments || []));
          setEnableTableQr(Boolean(r.enable_table_qr));
          setLogoUrl(String(r.logo_url || ''));
          setBrandPrimaryColor(String(r.brand_primary_color || '#111827'));
          setWhatsappOrderNote(String(r.whatsapp_order_note || ''));
        }
      } catch (e: any) {
        if (!cancelled) setStatus({ kind: 'error', message: e?.message || 'Failed to load restaurant' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, subscriptionLoading, hasRestaurantAccess]);

  const slug = restaurant?.slug || '';

  const menuUrl = useMemo(() => {
    if (!slug) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/menu/${slug}`;
  }, [slug]);

  const setupChecklist = useMemo(() => {
    const items = [
      { label: 'Restaurant name', done: Boolean(name.trim()) },
      { label: 'WhatsApp number', done: Boolean(whatsappNumber.trim()) },
      { label: 'Accepted payments', done: parsePayments(acceptedPaymentsText).length > 0 },
      { label: 'Menu link ready', done: Boolean(slug) },
      { label: 'Brand color', done: Boolean(brandPrimaryColor) },
    ];
    const completed = items.filter((i) => i.done).length;
    return { items, completed, total: items.length };
  }, [name, whatsappNumber, acceptedPaymentsText, slug, brandPrimaryColor]);

  async function uploadLogo() {
    if (!logoFile) {
      setStatus({ kind: 'error', message: 'Choose a logo image first' });
      return;
    }

    setUploadingLogo(true);
    setStatus({ kind: 'loading' });

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in again');

      const fd = new FormData();
      fd.append('file', logoFile);

      const res = await fetch('/api/uploads/menu', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || json?.details || `Upload failed (${res.status})`);

      const url = String((json as any)?.url || '').trim();
      if (!url) throw new Error('Upload succeeded but URL is missing');

      setLogoUrl(url);
      setLogoFile(null);
      setStatus({ kind: 'success', message: 'Logo uploaded (remember to Save changes)' });
      setTimeout(() => setStatus({ kind: 'idle' }), 1500);
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Upload failed' });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function copyMenuLink() {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      setStatus({ kind: 'success', message: 'Menu link copied' });
      setTimeout(() => setStatus({ kind: 'idle' }), 1500);
    } catch {
      setStatus({ kind: 'error', message: 'Copy failed. Please copy manually.' });
    }
  }

  async function save() {
    setStatus({ kind: 'loading' });

    try {
      const payload = {
        name,
        whatsappNumber,
        acceptedPayments: parsePayments(acceptedPaymentsText),
        enableTableQr,
        logoUrl: logoUrl.trim() ? logoUrl.trim() : null,
        brandPrimaryColor,
        whatsappOrderNote: whatsappOrderNote.trim() ? whatsappOrderNote.trim() : null,
      };

      const res = await fetchWithAuthFallback(getAccessToken, '/api/restaurant', {
        method: restaurant ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      const r = (json as any)?.restaurant as Restaurant | null;
      setRestaurant(r);
      setStatus({ kind: 'success', message: restaurant ? 'Settings updated' : 'Restaurant created' });

      if (r) {
        setName(r.name);
        setWhatsappNumber(r.whatsapp_number);
        setAcceptedPaymentsText(paymentsToString(r.accepted_payments || []));
        setEnableTableQr(Boolean(r.enable_table_qr));
        setLogoUrl(String(r.logo_url || ''));
        setBrandPrimaryColor(String(r.brand_primary_color || '#111827'));
        setWhatsappOrderNote(String(r.whatsapp_order_note || ''));
      }
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Save failed' });
    }
  }

  return (
    <DashboardShell
      title="Restaurant Settings"
      subtitle="Set up your restaurant profile and WhatsApp ordering"
      actions={
        subscriptionLoading || baseTier === 'free' || !hasRestaurantAccess ? null : (
          <button
            type="button"
            onClick={save}
            disabled={status.kind === 'loading' || loading}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {restaurant ? 'Save changes' : 'Create restaurant'}
          </button>
        )
      }
    >
      {subscriptionLoading ? (
        <div className="max-w-3xl mx-auto">
          <div className="h-24 bg-gray-200 animate-pulse rounded-lg" />
        </div>
      ) : baseTier === 'free' || !hasRestaurantAccess ? (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900">Restaurant settings are a premium feature</h1>
            <p className="mt-2 text-gray-600">Start a paid trial or subscribe to manage restaurant settings and branding.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/pricing?required=1&redirect=${encodeURIComponent('/dashboard/settings')}`}
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
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {status.message}
        </div>
      ) : null}

      {status.kind === 'success' ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {status.message}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Setup checklist</div>
              <div className="mt-1 text-xs text-gray-600">
                {setupChecklist.completed} of {setupChecklist.total} complete
              </div>
            </div>
            <div className="text-xs font-semibold text-indigo-600">
              {Math.round((setupChecklist.completed / setupChecklist.total) * 100)}%
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {setupChecklist.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.label}</span>
                <span className={item.done ? 'text-emerald-600' : 'text-gray-400'}>
                  {item.done ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Quick actions</div>
          <div className="mt-2 text-xs text-gray-600">Menu link</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={menuUrl}
              readOnly
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
              placeholder="Menu link will appear after setup"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyMenuLink}
              disabled={!menuUrl}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Copy link
            </button>
            <a
              href={menuUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold ${menuUrl ? 'text-gray-800 hover:bg-gray-50' : 'text-gray-400 pointer-events-none'}`}
            >
              Open menu
            </a>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            Tip: Changes apply after you click <span className="font-semibold">{restaurant ? 'Save changes' : 'Create restaurant'}</span>.
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">Restaurant name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Mama Ntilie"
              autoComplete="organization"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">WhatsApp phone number</label>
            <p className="mt-1 text-xs text-gray-600">
              Use international format when possible (e.g. +255712345678). Customers will order via WhatsApp.
            </p>
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="+2557xxxxxxxx"
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">Accepted payment methods</label>
            <p className="mt-1 text-xs text-gray-600">Comma-separated (e.g. Cash, M-Pesa, Tigo Pesa)</p>
            <input
              value={acceptedPaymentsText}
              onChange={(e) => setAcceptedPaymentsText(e.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Cash, M-Pesa"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Dine-in table QRs</div>
                <p className="mt-1 text-xs text-gray-600">
                  Enable per-table QR codes with table number identity (e.g. Table 1, Table 2). When enabled, table scans
                  enforce dine-in orders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnableTableQr((v) => !v)}
                disabled={!restaurant}
                className={
                  enableTableQr
                    ? 'inline-flex items-center rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50'
                    : 'inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50'
                }
                title={!restaurant ? 'Create restaurant first' : undefined}
              >
                {enableTableQr ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            {!restaurant ? (
              <div className="mt-2 text-xs text-amber-800">Create your restaurant first to enable table QRs.</div>
            ) : null}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">Branding</div>
                <p className="mt-1 text-xs text-gray-600">Customize how your public menu looks.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  className="h-9 w-10 rounded border border-gray-300 bg-white"
                  title="Brand primary color"
                />
                <input
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  className="h-9 w-28 rounded-md border border-gray-300 px-3 text-sm"
                  placeholder="#111827"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900">Logo</label>
                <p className="mt-1 text-xs text-gray-600">Optional. Upload a square logo (PNG/JPG).</p>

                {logoUrl ? (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={logoUrl} alt="Restaurant logo" className="h-12 w-12 rounded-lg border border-gray-200 object-cover bg-white" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm"
                  />
                  <button
                    type="button"
                    onClick={uploadLogo}
                    disabled={!restaurant || uploadingLogo || !logoFile}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {uploadingLogo ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900">WhatsApp order note</label>
                <p className="mt-1 text-xs text-gray-600">Optional. This will be appended to every order message.</p>
                <textarea
                  value={whatsappOrderNote}
                  onChange={(e) => setWhatsappOrderNote(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Please confirm total and estimated time before preparing."
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Restaurant slug</label>
              <p className="mt-1 text-xs text-gray-600">Used in your public menu link. (Locked after creation)</p>
              <input
                value={slug}
                readOnly
                className="mt-2 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                placeholder="(created after onboarding)"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900">Menu URL</label>
              <p className="mt-1 text-xs text-gray-600">This is what your QR code will point to.</p>
              <input
                value={menuUrl}
                readOnly
                className="mt-2 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                placeholder="(available after onboarding)"
              />
            </div>
          </div>

          {!restaurant ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Create your restaurant profile first, then add menu items in the Menu tab.
            </div>
          ) : null}
        </div>
      )}
        </>
      )}
    </DashboardShell>
  );
}
