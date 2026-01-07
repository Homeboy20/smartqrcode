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

/**
 * Get currency based on country code
 */
export function getCurrencyForCountry(countryCode: string): CurrencyConfig {
  const upperCode = countryCode.toUpperCase();
  
  for (const currency of Object.values(CURRENCY_CONFIGS)) {
    if (currency.countries.includes(upperCode)) {
      return currency;
    }
  }
  
  // Default to USD
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
  const cfCountry = headers.get('cf-ipcountry'); // Cloudflare
  const vercelCountry = headers.get('x-vercel-ip-country'); // Vercel
  const country = cfCountry || vercelCountry;
  
  return country || 'US'; // Default to US
}

/**
 * Get recommended payment provider for currency
 */
export function getRecommendedProvider(
  currency: CurrencyCode
): 'paystack' | 'flutterwave' {
  return CURRENCY_CONFIGS[currency].preferredProvider;
}
