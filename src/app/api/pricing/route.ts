import { NextRequest, NextResponse } from 'next/server';
import { 
  detectCountryFromHeaders, 
  getCurrencyForCountry,
  formatCurrency,
  getRecommendedProvider,
  SUBSCRIPTION_PRICING,
  CURRENCY_CONFIGS
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

function toFxRateMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as any)) {
    const code = String(k || '').toUpperCase().trim();
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (!code || !Number.isFinite(n) || n <= 0) continue;
    out[code] = n;
  }
  return out;
}

function roundForCurrency(amount: number, currencyCode: string): number {
  const cfg = (CURRENCY_CONFIGS as any)[currencyCode];
  const minorUnit = Number(cfg?.minorUnit || 100);
  if (minorUnit === 1) return Math.round(amount);
  if (minorUnit === 1000) return Math.round(amount * 1000) / 1000;
  return Math.round(amount * 100) / 100;
}

function toYearlyAmount(monthlyAmount: number, currencyCode: string): number {
  // Default: 2 months free (10x monthly).
  const YEARLY_MULTIPLIER = 10;
  return roundForCurrency(monthlyAmount * YEARLY_MULTIPLIER, currencyCode);
}

function getPaidTrialConfig(): { days: number; multiplier: number } {
  const daysRaw = Number(process.env.PAID_TRIAL_DAYS ?? 7);
  const multiplierRaw = Number(process.env.PAID_TRIAL_MULTIPLIER ?? 0.3);

  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(31, Math.floor(daysRaw))) : 7;
  const multiplier = Number.isFinite(multiplierRaw)
    ? Math.max(0.05, Math.min(1, multiplierRaw))
    : 0.3;

  return { days, multiplier };
}

function toTrialAmount(monthlyAmount: number, currencyCode: string, multiplier: number): number {
  return roundForCurrency(monthlyAmount * multiplier, currencyCode);
}

function getAmountForCurrency(params: {
  tier: 'pro' | 'business';
  currencyCode: string;
  mergedPricing: any;
  fxRates: Record<string, number>;
}): number {
  const { tier, currencyCode, mergedPricing, fxRates } = params;
  const localPrices = (mergedPricing?.[tier]?.localPrices ?? {}) as Record<string, number>;
  const usdPrice = Number(mergedPricing?.[tier]?.usdPrice || 0);

  const explicit = localPrices?.[currencyCode];
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) return explicit;

  if (currencyCode !== 'USD') {
    const rate = fxRates[currencyCode];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && usdPrice > 0) {
      return roundForCurrency(usdPrice * rate, currencyCode);
    }
  }

  return usdPrice;
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

    const fxRates = toFxRateMap(overrides?.fxRates ?? overrides?.fx_rates);

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

    const proAmount = getAmountForCurrency({
      tier: 'pro',
      currencyCode: currencyConfig.code,
      mergedPricing,
      fxRates,
    });
    const businessAmount = getAmountForCurrency({
      tier: 'business',
      currencyCode: currencyConfig.code,
      mergedPricing,
      fxRates,
    });
    
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

    const pricingYearly = {
      pro: {
        amount: toYearlyAmount(proAmount, currencyConfig.code),
        formatted: formatCurrency(toYearlyAmount(proAmount, currencyConfig.code), currencyConfig.code),
        usd: mergedPricing.pro.usdPrice,
      },
      business: {
        amount: toYearlyAmount(businessAmount, currencyConfig.code),
        formatted: formatCurrency(toYearlyAmount(businessAmount, currencyConfig.code), currencyConfig.code),
        usd: mergedPricing.business.usdPrice,
      },
    };

    const paidTrial = getPaidTrialConfig();
    const pricingTrial = {
      pro: {
        amount: toTrialAmount(proAmount, currencyConfig.code, paidTrial.multiplier),
        formatted: formatCurrency(toTrialAmount(proAmount, currencyConfig.code, paidTrial.multiplier), currencyConfig.code),
        usd: mergedPricing.pro.usdPrice,
      },
      business: {
        amount: toTrialAmount(businessAmount, currencyConfig.code, paidTrial.multiplier),
        formatted: formatCurrency(
          toTrialAmount(businessAmount, currencyConfig.code, paidTrial.multiplier),
          currencyConfig.code
        ),
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
      pricingYearly,
      paidTrial: {
        days: paidTrial.days,
        multiplier: paidTrial.multiplier,
      },
      pricingTrial,
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
      pricingYearly: {
        pro: {
          amount: 99.9,
          formatted: '$99.90',
          usd: 9.99,
        },
        business: {
          amount: 299.9,
          formatted: '$299.90',
          usd: 29.99,
        },
      },
      paidTrial: { days: 7, multiplier: 0.3 },
      pricingTrial: {
        pro: { amount: 2.99, formatted: '$2.99', usd: 9.99 },
        business: { amount: 8.99, formatted: '$8.99', usd: 29.99 },
      },
    });
  }
}
