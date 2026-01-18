import { NextRequest, NextResponse } from 'next/server';

import type { CurrencyCode } from '@/lib/currency';
import {
  getSupportedPaymentMethodsForContext,
  type CheckoutPaymentMethod,
  type UniversalPaymentProvider,
} from '@/lib/checkout/paymentMethodSupport';
import { listFlutterwaveBanks } from '@/lib/flutterwave';
import { listPaystackBanks } from '@/lib/paystack';
import { getFlutterwavePaymentOptionsMatrix } from '@/lib/flutterwave';
import { getPaystackChannelsForCheckoutMethod, PAYSTACK_CHANNELS } from '@/lib/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeProvider(value: string | null | undefined): UniversalPaymentProvider | null {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'paystack' || v === 'flutterwave') return v;
  return null;
}

function normalizeCurrency(value: string | null | undefined): CurrencyCode | null {
  const v = String(value || '').trim().toUpperCase();
  if (!v) return null;
  // Keep in sync with CurrencyCode union.
  if (['USD', 'NGN', 'GHS', 'KES', 'ZAR', 'GBP', 'EUR'].includes(v)) return v as CurrencyCode;
  return null;
}

export async function GET(request: NextRequest) {
  const countryCode = normalizeCountryCode(request.nextUrl.searchParams.get('country'));
  const provider = normalizeProvider(request.nextUrl.searchParams.get('provider'));
  const currency = normalizeCurrency(request.nextUrl.searchParams.get('currency'));

  if (!countryCode) {
    return NextResponse.json(
      { error: 'Missing or invalid country. Use ISO alpha-2, e.g. ?country=NG' },
      { status: 400 }
    );
  }

  const providers: UniversalPaymentProvider[] = provider ? [provider] : ['flutterwave', 'paystack'];

  const results = await Promise.all(
    providers.map(async (p) => {
      let banks: Array<{ name: string; code?: string; slug?: string }> = [];
      let banksError: string | null = null;

      try {
        if (p === 'flutterwave') {
          banks = await listFlutterwaveBanks(countryCode);
        } else if (p === 'paystack') {
          banks = await listPaystackBanks(countryCode);
        }
      } catch (err: any) {
        banksError = String(err?.message || 'Failed to fetch banks');
      }

      // Note: pay modes are enforced by our own rules. Providers don't always expose a
      // reliable "list supported payment methods" endpoint across countries.
      const paymentMethodsAllowed: CheckoutPaymentMethod[] | null = currency
        ? getSupportedPaymentMethodsForContext({
            provider: p,
            countryCode,
            currency,
          })
        : null;

      return {
        provider: p,
        countryCode,
        currency: currency || null,
        live: {
          banks,
          error: banksError,
        },
        providerNative: {
          // These are the provider-specific knobs we send/expect at checkout time.
          flutterwave:
            p === 'flutterwave'
              ? {
                  paymentOptions: getFlutterwavePaymentOptionsMatrix(),
                }
              : null,
          paystack:
            p === 'paystack'
              ? {
                  channels: {
                    card: getPaystackChannelsForCheckoutMethod('card'),
                    mobile_money: getPaystackChannelsForCheckoutMethod('mobile_money'),
                    any: [...PAYSTACK_CHANNELS],
                  },
                }
              : null,
        },
        internal: {
          paymentMethodsAllowed,
        },
      };
    })
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    results,
  });
}
