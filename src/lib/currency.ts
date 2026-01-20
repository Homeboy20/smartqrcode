import { AFRICAN_COUNTRIES } from '@/lib/countries/africa';

// Multi-currency support for payment system
export type CurrencyCode =
  | 'USD'
  | 'NGN'
  | 'GHS'
  | 'KES'
  | 'ZAR'
  | 'GBP'
  | 'EUR'
  // Additional African currencies (Flutterwave local payments)
  | 'TZS'
  | 'UGX'
  | 'RWF'
  | 'ZMW'
  | 'XOF'
  | 'XAF'
  | 'EGP'
  | 'MAD'
  | 'ETB'
  | 'DZD'
  | 'TND'
  | 'MUR'
  | 'BWP'
  | 'NAD'
  | 'MWK'
  | 'MZN'
  | 'AOA'
  | 'XCD'
  | 'CVE'
  | 'SCR'
  | 'GMD'
  | 'SLL'
  | 'LRD'
  | 'CDF'
  | 'SDG'
  | 'ZWL'
  | 'DJF'
  | 'SOS'
  | 'KMF'
  | 'LSL'
  | 'SZL'
  | 'MGA'
  | 'TJS';

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

  // ---- Flutterwave-focused African currencies ----
  TZS: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['TZ'] },
  UGX: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['UG'] },
  RWF: { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['RW'] },
  ZMW: { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['ZM'] },
  XOF: { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['BJ','BF','CI','GW','ML','NE','SN','TG'] },
  XAF: { code: 'XAF', symbol: 'CFA', name: 'Central African CFA Franc', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['CM','CF','TD','CG','GA','GQ'] },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['EG'] },
  MAD: { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['MA'] },
  ETB: { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['ET'] },
  DZD: { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['DZ'] },
  TND: { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar', minorUnit: 1000, preferredProvider: 'flutterwave', countries: ['TN'] },
  MUR: { code: 'MUR', symbol: 'Rs', name: 'Mauritian Rupee', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['MU'] },
  BWP: { code: 'BWP', symbol: 'P', name: 'Botswana Pula', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['BW'] },
  NAD: { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['NA'] },
  MWK: { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['MW'] },
  MZN: { code: 'MZN', symbol: 'MT', name: 'Mozambican Metical', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['MZ'] },
  AOA: { code: 'AOA', symbol: 'Kz', name: 'Angolan Kwanza', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['AO'] },
  XCD: { code: 'XCD', symbol: '$', name: 'East Caribbean Dollar', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['LC'] },
  CVE: { code: 'CVE', symbol: '$', name: 'Cape Verdean Escudo', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['CV'] },
  SCR: { code: 'SCR', symbol: '₨', name: 'Seychellois Rupee', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['SC'] },
  GMD: { code: 'GMD', symbol: 'D', name: 'Gambian Dalasi', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['GM'] },
  SLL: { code: 'SLL', symbol: 'Le', name: 'Sierra Leonean Leone', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['SL'] },
  LRD: { code: 'LRD', symbol: '$', name: 'Liberian Dollar', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['LR'] },
  CDF: { code: 'CDF', symbol: 'FC', name: 'Congolese Franc', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['CD'] },
  SDG: { code: 'SDG', symbol: 'ج.س.', name: 'Sudanese Pound', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['SD'] },
  ZWL: { code: 'ZWL', symbol: '$', name: 'Zimbabwean Dollar', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['ZW'] },
  DJF: { code: 'DJF', symbol: 'Fdj', name: 'Djiboutian Franc', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['DJ'] },
  SOS: { code: 'SOS', symbol: 'Sh', name: 'Somali Shilling', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['SO'] },
  KMF: { code: 'KMF', symbol: 'CF', name: 'Comorian Franc', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['KM'] },
  LSL: { code: 'LSL', symbol: 'L', name: 'Lesotho Loti', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['LS'] },
  SZL: { code: 'SZL', symbol: 'E', name: 'Swazi Lilangeni', minorUnit: 100, preferredProvider: 'flutterwave', countries: ['SZ'] },
  MGA: { code: 'MGA', symbol: 'Ar', name: 'Malagasy Ariary', minorUnit: 1, preferredProvider: 'flutterwave', countries: ['MG'] },
  TJS: { code: 'TJS', symbol: 'ЅМ', name: 'Tajikistani Somoni', minorUnit: 100, preferredProvider: 'flutterwave', countries: [] },
};

const AFRICA_COUNTRY_TO_CURRENCY: Partial<Record<string, CurrencyCode>> = {
  DZ: 'DZD',
  AO: 'AOA',
  BJ: 'XOF',
  BW: 'BWP',
  BF: 'XOF',
  BI: 'RWF',
  CV: 'CVE',
  CM: 'XAF',
  CF: 'XAF',
  TD: 'XAF',
  KM: 'KMF',
  CG: 'XAF',
  CD: 'CDF',
  CI: 'XOF',
  DJ: 'DJF',
  EG: 'EGP',
  GQ: 'XAF',
  ER: 'USD',
  SZ: 'SZL',
  ET: 'ETB',
  GA: 'XAF',
  GM: 'GMD',
  GH: 'GHS',
  GN: 'USD',
  GW: 'XOF',
  KE: 'KES',
  LS: 'LSL',
  LR: 'LRD',
  LY: 'USD',
  MG: 'MGA',
  MW: 'MWK',
  ML: 'XOF',
  MR: 'USD',
  MU: 'MUR',
  MA: 'MAD',
  MZ: 'MZN',
  NA: 'NAD',
  NE: 'XOF',
  NG: 'NGN',
  RW: 'RWF',
  ST: 'USD',
  SN: 'XOF',
  SC: 'SCR',
  SL: 'SLL',
  SO: 'SOS',
  ZA: 'ZAR',
  SS: 'USD',
  SD: 'SDG',
  TZ: 'TZS',
  TG: 'XOF',
  TN: 'TND',
  UG: 'UGX',
  ZM: 'ZMW',
  ZW: 'ZWL',
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
      // Tanzania (TZS): keep an explicit local price to avoid showing USD values with a TZS symbol
      // when FX rates are not configured via app_settings.
      TZS: 26000,
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
      // Tanzania (TZS)
      TZS: 78000,
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
    const mapped = AFRICA_COUNTRY_TO_CURRENCY[upperCode];
    if (mapped && CURRENCY_CONFIGS[mapped]) return CURRENCY_CONFIGS[mapped];

    for (const currency of Object.values(CURRENCY_CONFIGS)) {
      if (currency.countries.includes(upperCode)) return currency;
    }

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
  const decimals = config.minorUnit === 1 ? 0 : config.minorUnit === 1000 ? 3 : 2;
  return `${config.symbol}${amount.toFixed(decimals)}`;
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
  // Cloudflare can return special/unknown values like:
  // - "T1" for Tor
  // - "XX" / "ZZ" for unknown (varies by setup)
  if (normalized === 'T1' || normalized === 'XX' || normalized === 'ZZ') return 'US';
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
