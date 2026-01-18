import { NextRequest, NextResponse } from 'next/server';

import { CURRENCY_CONFIGS, type CurrencyCode } from '@/lib/currency';
import {
  getProviderEnablement,
  getProviderEligibility,
  isProviderEnabled,
  providerSupportsCountry,
  providerSupportsCurrency,
  type ProviderEligibility,
} from '@/lib/checkout/universalCheckout';
import type { PaymentProvider } from '@/lib/paymentSettingsStore';
import { getProviderRuntimeConfig } from '@/lib/paymentSettingsStore';
import {
  getSupportedPaymentMethods,
  getSupportedPaymentMethodsForContext,
  type CheckoutPaymentMethod,
  type UniversalPaymentProvider,
} from '@/lib/checkout/paymentMethodSupport';
import { getFlutterwavePaymentOptionsMatrix } from '@/lib/flutterwave';
import { getPaystackChannelsForCheckoutMethod, PAYSTACK_CHANNELS } from '@/lib/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTEGRATED_PROVIDERS: PaymentProvider[] = ['flutterwave', 'paystack'];

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function normalizeCurrencyCode(value: string | null | undefined): CurrencyCode | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized in CURRENCY_CONFIGS) return normalized as CurrencyCode;
  return null;
}

function getConfiguredPaystackCountries(): string[] {
  return Array.from(
    new Set(
      Object.values(CURRENCY_CONFIGS)
        .filter((c) => c.preferredProvider === 'paystack')
        .flatMap((c) => c.countries)
        .filter((cc) => cc && cc !== 'DEFAULT')
        .map((cc) => cc.toUpperCase())
    )
  ).sort();
}

export async function GET(request: NextRequest) {
  const country = normalizeCountryCode(request.nextUrl.searchParams.get('country'));
  const currency = normalizeCurrencyCode(request.nextUrl.searchParams.get('currency'));

  // Provider capability snapshot (no secrets).
  const providers: Record<
    string,
    {
      integrated: boolean;
      enabled: boolean;
      enablementReason?: string;
      configuredAllowedCountries?: string[] | null;
      supportedCurrencies: CurrencyCode[];
      supportedCountries: string[] | 'ALL';
      supportedPaymentMethods: CheckoutPaymentMethod[];
      providerNative: {
        flutterwave: null | {
          paymentOptions: ReturnType<typeof getFlutterwavePaymentOptionsMatrix>;
        };
        paystack: null | {
          channels: {
            card: ReturnType<typeof getPaystackChannelsForCheckoutMethod>;
            mobile_money: ReturnType<typeof getPaystackChannelsForCheckoutMethod>;
            any: typeof PAYSTACK_CHANNELS;
          };
        };
      };
    }
  > = {};

  await Promise.all(
    INTEGRATED_PROVIDERS.map(async (provider) => {
      const enablement = await getProviderEnablement(provider).catch(() => ({ enabled: false, reason: 'Unknown' }));
      const enabled = Boolean(enablement.enabled);

      let configuredAllowedCountries: string[] | null = null;
      try {
        const runtime = await getProviderRuntimeConfig(provider);
        const raw = String((runtime as any)?.credentials?.allowedCountries || '').trim();
        if (raw) {
          configuredAllowedCountries = raw
            .split(/[^A-Za-z]+/g)
            .map((p) => p.trim().toUpperCase())
            .filter((p) => /^[A-Z]{2}$/.test(p));
        }
      } catch {
        configuredAllowedCountries = null;
      }

      // Supported currencies are derived from the same enforcement function.
      const supportedCurrencies = (Object.keys(CURRENCY_CONFIGS) as CurrencyCode[]).filter((ccy) =>
        providerSupportsCurrency(provider, ccy)
      );

      const supportedCountries: string[] | 'ALL' =
        provider === 'flutterwave' ? 'ALL' : provider === 'paystack' ? getConfiguredPaystackCountries() : [];

      const supportedPaymentMethods = getSupportedPaymentMethods(provider as unknown as UniversalPaymentProvider);

      providers[provider] = {
        integrated: true,
        enabled,
        ...(enablement?.reason ? { enablementReason: enablement.reason } : {}),
        configuredAllowedCountries,
        supportedCurrencies,
        supportedCountries,
        supportedPaymentMethods,
        providerNative: {
          flutterwave:
            provider === 'flutterwave'
              ? {
                  paymentOptions: getFlutterwavePaymentOptionsMatrix(),
                }
              : null,
          paystack:
            provider === 'paystack'
              ? {
                  channels: {
                    card: getPaystackChannelsForCheckoutMethod('card'),
                    mobile_money: getPaystackChannelsForCheckoutMethod('mobile_money'),
                    any: PAYSTACK_CHANNELS,
                  },
                }
              : null,
        },
      };
    })
  );

  let context:
    | {
        countryCode: string;
        currency: CurrencyCode;
        eligibility: Record<string, ProviderEligibility>;
        paymentMethods: Record<string, CheckoutPaymentMethod[]>;
      }
    | undefined;

  if (country && currency) {
    const eligibility: Record<string, ProviderEligibility> = {};
    const paymentMethods: Record<string, CheckoutPaymentMethod[]> = {};
    await Promise.all(
      INTEGRATED_PROVIDERS.map(async (provider) => {
        eligibility[provider] = await getProviderEligibility({ provider, countryCode: country, currency });

        paymentMethods[provider] = getSupportedPaymentMethodsForContext({
          provider: provider as unknown as UniversalPaymentProvider,
          countryCode: country,
          currency,
        });
      })
    );

    context = {
      countryCode: country,
      currency,
      eligibility,
      paymentMethods,
    };
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    providers,
    ...(context ? { context } : {}),
  });
}
