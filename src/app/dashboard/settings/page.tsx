'use client';

import { useEffect, useMemo, useState } from 'react';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  accepted_payments: string[];
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
  const { getAccessToken } = useSupabaseAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [acceptedPaymentsText, setAcceptedPaymentsText] = useState('');

  useEffect(() => {
    let cancelled = false;

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
  }, [getAccessToken]);

  const slug = restaurant?.slug || '';

  const menuUrl = useMemo(() => {
    if (!slug) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/menu/${slug}`;
  }, [slug]);

  async function save() {
    setStatus({ kind: 'loading' });

    try {
      const payload = {
        name,
        whatsappNumber,
        acceptedPayments: parsePayments(acceptedPaymentsText),
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
        <button
          type="button"
          onClick={save}
          disabled={status.kind === 'loading' || loading}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {restaurant ? 'Save changes' : 'Create restaurant'}
        </button>
      }
    >
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

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
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
    </DashboardShell>
  );
}
