"use client";

import { useEffect, useMemo, useState } from 'react';
import { AFRICAN_COUNTRIES } from '@/lib/countries/africa';
import type { UniversalPaymentProvider } from '@/lib/checkout/paymentMethodSupport';

export interface GeoCurrencyInfo {
  country: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  availableProviders?: UniversalPaymentProvider[];
  recommendedProvider?: UniversalPaymentProvider;

  // Optional fields returned by /api/pricing (used by marketing pages).
  providerEligibility?: Partial<
    Record<
      UniversalPaymentProvider,
      { enabled: boolean; supportsCountry: boolean; supportsCurrency: boolean; allowed: boolean; reason?: string }
    >
  >;
  pricing?: {
    pro: { amount: number; formatted: string; usd: number };
    business: { amount: number; formatted: string; usd: number };
  };
  pricingYearly?: {
    pro: { amount: number; formatted: string; usd: number };
    business: { amount: number; formatted: string; usd: number };
  };
  paidTrial?: { days: number; multiplier: number };
  pricingTrial?: {
    pro: { amount: number; formatted: string; usd: number };
    business: { amount: number; formatted: string; usd: number };
  };
}

export const GEO_CURRENCY_STORAGE_KEY = 'geoCurrencyInfo:v1';
export const CHECKOUT_COUNTRY_OVERRIDE_KEY = 'checkoutCountry';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let inFlight: Promise<GeoCurrencyInfo> | null = null;

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getCountryDisplayName(countryCode: string): string {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code) return '';

  try {
    const DisplayNames: any = (globalThis as any).Intl?.DisplayNames;
    if (typeof DisplayNames === 'function') {
      const dn = new DisplayNames(['en'], { type: 'region' });
      const label = dn.of(code);
      if (label && typeof label === 'string') return label;
    }
  } catch {
    // ignore
  }

  const african = AFRICAN_COUNTRIES.find((c) => c.code.toUpperCase() === code);
  if (african) return african.name;

  const common: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    IN: 'India',
    DE: 'Germany',
    FR: 'France',
    NL: 'Netherlands',
    ES: 'Spain',
    IT: 'Italy',
    NG: 'Nigeria',
    GH: 'Ghana',
    KE: 'Kenya',
    ZA: 'South Africa',
    TZ: 'Tanzania',
    UG: 'Uganda',
  };

  return common[code] || code;
}

export function getCheckoutCountryOverride(): string | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CHECKOUT_COUNTRY_OVERRIDE_KEY) : null;
    const normalized = String(raw || '').trim().toUpperCase();
    if (!normalized) return null;
    return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function clearGeoCurrencyCache() {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(GEO_CURRENCY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useGeoCurrencyInfo(options?: { enabled?: boolean }): {
  geo: GeoCurrencyInfo | null;
  countryName: string;
  loading: boolean;
} {
  const enabled = options?.enabled ?? true;
  const [geo, setGeo] = useState<GeoCurrencyInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const cached = safeJsonParse<{ ts: number; geo: GeoCurrencyInfo }>(
      typeof window !== 'undefined' ? window.sessionStorage.getItem(GEO_CURRENCY_STORAGE_KEY) : null
    );

    if (cached?.geo && typeof cached.ts === 'number' && Date.now() - cached.ts < TTL_MS) {
      setGeo(cached.geo);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        if (!inFlight) {
          const override = getCheckoutCountryOverride();
          const url = override ? `/api/pricing?country=${encodeURIComponent(override)}` : '/api/pricing';

          inFlight = (async () => {
            const res = await fetch(url, {
              method: 'GET',
              signal: controller.signal,
              headers: override ? { 'x-checkout-country': override } : undefined,
            });
            if (!res.ok) throw new Error(`Failed to load geo pricing (${res.status})`);
            const data = (await res.json()) as GeoCurrencyInfo;
            if (!data?.country || !data?.currency?.code) throw new Error('Invalid geo pricing payload');
            return data;
          })();
        }

        const data = await inFlight;

        setGeo(data);
        try {
          window.sessionStorage.setItem(GEO_CURRENCY_STORAGE_KEY, JSON.stringify({ ts: Date.now(), geo: data }));
        } catch {
          // ignore
        }
      } catch {
        // ignore – geo is optional
      } finally {
        inFlight = null;
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [enabled]);

  const countryName = useMemo(() => (geo?.country ? getCountryDisplayName(geo.country) : ''), [geo?.country]);

  return { geo, countryName, loading };
}
