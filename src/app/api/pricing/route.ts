import { NextRequest, NextResponse } from 'next/server';
import { 
  detectCountryFromHeaders, 
  getCurrencyForCountry,
  formatCurrency,
  getRecommendedProvider,
  SUBSCRIPTION_PRICING
} from '@/lib/currency';
import { createAnonClient } from '@/lib/supabase/server';
import {
  chooseDefaultProvider,
  getAvailableCheckoutProvidersStrict,
  getProviderEligibility,
  type ProviderEligibility,
} from '@/lib/checkout/universalCheckout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function getPricingOverridesFromAppSettings() {
  try {
    const supabase = createAnonClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle();

    if (error || !data?.value) return null;
    return (data.value as any)?.pricing ?? null;
  } catch {
    return null;
  }
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export async function GET(request: NextRequest) {
  try {
    // Detect country from headers unless explicitly overridden.
    const urlCountry = normalizeCountryCode(request.nextUrl.searchParams.get('country'));
    const headerCountry = normalizeCountryCode(request.headers.get('x-checkout-country'));
    const countryCode = urlCountry || headerCountry || detectCountryFromHeaders(request.headers);
    const currencyConfig = getCurrencyForCountry(countryCode);

    // Build a detailed eligibility map so the UI can explain why a gateway isn't selectable.
    const providersToDescribe = ['flutterwave', 'paystack'] as const;
    const providerEligibility: Record<string, ProviderEligibility> = {};

    await Promise.all(
      providersToDescribe.map(async (provider) => {
        providerEligibility[provider] = await getProviderEligibility({
          provider,
          countryCode,
          currency: currencyConfig.code,
        });
      })
    );

    const availableProviders = (await getAvailableCheckoutProvidersStrict()).filter((p) => providerEligibility[p]?.allowed);
    const recommendedProvider = chooseDefaultProvider({
      currency: currencyConfig.code,
      availableProviders,
    });

    const basePricing = SUBSCRIPTION_PRICING;
    const overrides = await getPricingOverridesFromAppSettings();

    const mergedPricing = {
      pro: {
        ...basePricing.pro,
        ...(overrides?.pro ?? {}),
        localPrices: {
          ...(basePricing.pro.localPrices ?? {}),
          ...((overrides?.pro?.localPrices ?? overrides?.pro?.local_prices ?? {}) as any),
        },
      },
      business: {
        ...basePricing.business,
        ...(overrides?.business ?? {}),
        localPrices: {
          ...(basePricing.business.localPrices ?? {}),
          ...((overrides?.business?.localPrices ?? overrides?.business?.local_prices ?? {}) as any),
        },
      },
    };

    // Safety: ensure numeric overrides.
    for (const tier of ['pro', 'business'] as const) {
      const usd = toNumberOrUndefined((mergedPricing as any)[tier]?.usdPrice);
      if (usd !== undefined) (mergedPricing as any)[tier].usdPrice = usd;
      for (const [ccy, v] of Object.entries((mergedPricing as any)[tier]?.localPrices ?? {})) {
        const n = toNumberOrUndefined(v);
        if (n === undefined) {
          delete (mergedPricing as any)[tier].localPrices[ccy];
        } else {
          (mergedPricing as any)[tier].localPrices[ccy] = n;
        }
      }
    }

    const proAmount = (mergedPricing.pro.localPrices as any)[currencyConfig.code] ?? mergedPricing.pro.usdPrice;
    const businessAmount = (mergedPricing.business.localPrices as any)[currencyConfig.code] ?? mergedPricing.business.usdPrice;
    
    // Get pricing for all tiers
    const pricing = {
      pro: {
        amount: proAmount,
        formatted: formatCurrency(proAmount, currencyConfig.code),
        usd: mergedPricing.pro.usdPrice,
      },
      business: {
        amount: businessAmount,
        formatted: formatCurrency(businessAmount, currencyConfig.code),
        usd: mergedPricing.business.usdPrice,
      },
    };
    
    return NextResponse.json({
      country: countryCode,
      currency: {
        code: currencyConfig.code,
        symbol: currencyConfig.symbol,
        name: currencyConfig.name,
      },
      availableProviders,
      recommendedProvider,
      providerEligibility,
      pricing,
    });
  } catch (error) {
    console.error('Error detecting currency:', error);
    
    // Return default USD pricing on error
    return NextResponse.json({
      country: 'US',
      currency: {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
      },
      availableProviders: ['flutterwave', 'paystack'],
      recommendedProvider: getRecommendedProvider('USD'),
      providerEligibility: {
        flutterwave: { enabled: true, supportsCountry: true, supportsCurrency: true, allowed: true },
        paystack: {
          enabled: false,
          supportsCountry: false,
          supportsCurrency: false,
          allowed: false,
          reason: 'Eligibility unavailable (fallback response).',
        },
      },
      pricing: {
        pro: {
          amount: 9.99,
          formatted: '$9.99',
          usd: 9.99,
        },
        business: {
          amount: 29.99,
          formatted: '$29.99',
          usd: 29.99,
        },
      },
    });
  }
}
