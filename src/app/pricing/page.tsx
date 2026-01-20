import { headers } from 'next/headers';

import { detectCountryFromHeaders } from '@/lib/currency';

import PricingClient from './PricingClient';

export const runtime = 'nodejs';

function getBaseUrl() {
  const h = headers();
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return null;
  return `${proto}://${host}`;
}

export default async function PricingPage() {
  const h = headers();
  const country = detectCountryFromHeaders(h);

  let initialCurrencyInfo: any = null;
  try {
    const baseUrl = getBaseUrl();
    if (baseUrl) {
      const url = `${baseUrl}/api/pricing?country=${encodeURIComponent(country)}`;
      const res = await fetch(url, {
        next: { revalidate: 300 },
        headers: {
          'x-checkout-country': country,
        },
      });
      if (res.ok) {
        initialCurrencyInfo = await res.json();
      }
    }
  } catch {
    initialCurrencyInfo = null;
  }

  return <PricingClient initialCurrencyInfo={initialCurrencyInfo} />;
}