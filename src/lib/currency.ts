import { AFRICAN_COUNTRIES } from '@/lib/countries/africa';

// Multi-currency support for payment system
export type CurrencyCode = 'USD' | 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'GBP' | 'EUR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  minorUnit: number; // e.g., 100 for cents/kobo
  preferredProvider: 'paystack' | 'flutterwave';
  countries: string[]; // ISO country codes
}

export const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    minorUnit: 100,
    preferredProvider: 'flutterwave',
    countries: ['US', 'DEFAULT'], // DEFAULT for fallback
  },
  NGN: {
    code: 'NGN',
    symbol: '₦',
    name: 'Nigerian Naira',
    minorUnit: 100,
    preferredProvider: 'paystack',
    countries: ['NG'],
  },
  GHS: {
    code: 'GHS',
    symbol: 'GH₵',
    name: 'Ghanaian Cedi',
    minorUnit: 100,
    preferredProvider: 'paystack',
    countries: ['GH'],
  },
  KES: {
    code: 'KES',
    symbol: 'KSh',
    name: 'Kenyan Shilling',
    minorUnit: 100,
    preferredProvider: 'flutterwave',
    countries: ['KE'],
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    minorUnit: 100,
    preferredProvider: 'paystack',
    countries: ['ZA'],
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    minorUnit: 100,
    preferredProvider: 'flutterwave',
    countries: ['GB'],
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    minorUnit: 100,
    preferredProvider: 'flutterwave',
    countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR'],
  },
};

// Pricing in base currency (USD) with exchange rates
export interface PricingTier {
  usdPrice: number;
  localPrices: Partial<Record<CurrencyCode, number>>;
}

export const SUBSCRIPTION_PRICING: Record<'pro' | 'business', PricingTier> = {
  pro: {
    usdPrice: 9.99,
    localPrices: {
      NGN: 15000,  // ≈$10 at current rates
      GHS: 150,    // ≈$10
      KES: 1200,   // ≈$10
      ZAR: 180,    // ≈$10
      GBP: 8.49,   // ≈$10
      EUR: 9.49,   // ≈$10
    },
  },
  business: {
    usdPrice: 29.99,
    localPrices: {
      NGN: 45000,  // ≈$30
      GHS: 450,    // ≈$30
      KES: 3600,   // ≈$30
      ZAR: 540,    // ≈$30
      GBP: 24.99,  // ≈$30
      EUR: 27.99,  // ≈$30
    },
  },
};

// Used to decide when to show local payment options (e.g., mobile money) vs card-only.
// ISO 3166-1 alpha-2 country codes.
const AFRICAN_COUNTRY_CODES = new Set(AFRICAN_COUNTRIES.map((c) => c.code.toUpperCase()));

// Countries where we prefer EUR by default when outside Africa.
// (EU/EEA + a few common EUR users; keep conservative)
const EUR_COUNTRY_CODES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  'NO','IS','LI','CH',
]);

export function isAfricanCountryCode(countryCode: string): boolean {
  return AFRICAN_COUNTRY_CODES.has(countryCode.toUpperCase());
}

export function isEurCountryCode(countryCode: string): boolean {
  return EUR_COUNTRY_CODES.has(countryCode.toUpperCase());
}

/**
 * Get currency based on country code
 */
export function getCurrencyForCountry(countryCode: string): CurrencyConfig {
  const upperCode = countryCode.toUpperCase();

  // 1) Africa: prefer a configured local currency (NGN/GHS/KES/ZAR etc) when available.
  if (isAfricanCountryCode(upperCode)) {
    for (const currency of Object.values(CURRENCY_CONFIGS)) {
      if (currency.countries.includes(upperCode)) {
        return currency;
      }
    }
    // If we don't have a local mapping yet, fall back to USD.
    return CURRENCY_CONFIGS.USD;
  }

  // 2) Outside Africa: show card payments in USD or EUR.
  // Prefer EUR for common European countries, otherwise USD.
  if (isEurCountryCode(upperCode)) {
    return CURRENCY_CONFIGS.EUR;
  }

  return CURRENCY_CONFIGS.USD;
}

/**
 * Get price in local currency
 */
export function getLocalPrice(
  tier: 'pro' | 'business',
  currency: CurrencyCode
): number {
  const pricing = SUBSCRIPTION_PRICING[tier];
  return pricing.localPrices[currency] ?? pricing.usdPrice;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode
): string {
  const config = CURRENCY_CONFIGS[currency];
  return `${config.symbol}${amount.toFixed(2)}`;
}

/**
 * Convert amount to minor units (e.g., cents/kobo)
 */
export function toMinorUnits(amount: number, currency: CurrencyCode): number {
  const config = CURRENCY_CONFIGS[currency];
  return Math.round(amount * config.minorUnit);
}

/**
 * Convert from minor units to major units
 */
export function fromMinorUnits(amount: number, currency: CurrencyCode): number {
  const config = CURRENCY_CONFIGS[currency];
  return amount / config.minorUnit;
}

/**
 * Detect user's country from request headers (Cloudflare, Vercel, etc.)
 */
export function detectCountryFromHeaders(headers: Headers): string {
  // Check various headers that hosting providers set
  const explicit = headers.get('x-checkout-country') || headers.get('x-country');
  const cfCountry = headers.get('cf-ipcountry'); // Cloudflare
  const vercelCountry = headers.get('x-vercel-ip-country'); // Vercel
  const country = explicit || cfCountry || vercelCountry;

  const normalized = (country || '').trim().toUpperCase();
  // ISO 3166-1 alpha-2
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return 'US'; // Default to US
}

/**
 * Get recommended payment provider for currency
 */
export function getRecommendedProvider(
  currency: CurrencyCode
): 'paystack' | 'flutterwave' {
  return CURRENCY_CONFIGS[currency].preferredProvider;
}
