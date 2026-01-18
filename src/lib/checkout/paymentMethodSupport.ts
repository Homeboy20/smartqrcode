export type CheckoutPaymentMethod = 'card' | 'mobile_money' | 'apple_pay' | 'google_pay';

export type UniversalPaymentProvider = 'paystack' | 'flutterwave' | 'stripe' | 'paypal';

import { isAfricanCountryCode, type CurrencyCode } from '@/lib/currency';

const PROVIDER_METHOD_SUPPORT: Record<UniversalPaymentProvider, Record<CheckoutPaymentMethod, boolean>> = {
  paystack: {
    card: true,
    // Treat Paystack's USSD/bank transfer flows as "mobile".
    mobile_money: true,
    apple_pay: false,
    google_pay: false,
  },
  flutterwave: {
    card: true,
    mobile_money: true,
    apple_pay: false,
    google_pay: false,
  },
  stripe: {
    card: true,
    mobile_money: false,
    apple_pay: true,
    google_pay: true,
  },
  paypal: {
    card: false,
    mobile_money: false,
    apple_pay: false,
    google_pay: false,
  },
};

export function providerSupportsPaymentMethod(provider: UniversalPaymentProvider, method: CheckoutPaymentMethod) {
  return Boolean(PROVIDER_METHOD_SUPPORT[provider]?.[method]);
}

export function getSupportedPaymentMethods(provider: UniversalPaymentProvider): CheckoutPaymentMethod[] {
  const support = PROVIDER_METHOD_SUPPORT[provider];
  if (!support) return [];
  return (Object.keys(support) as CheckoutPaymentMethod[]).filter((method) => Boolean(support[method]));
}

export function getSupportedPaymentMethodsForContext(options: {
  provider: UniversalPaymentProvider;
  countryCode: string;
  currency: CurrencyCode;
}): CheckoutPaymentMethod[] {
  const methods = getSupportedPaymentMethods(options.provider);
  const countryIsAfrican = isAfricanCountryCode(options.countryCode);

  // Outside Africa: card-only in USD/EUR.
  if (!countryIsAfrican) {
    return methods.filter((m) => m === 'card');
  }

  // Africa: allow local-style methods only for local currencies.
  const localCurrencies: CurrencyCode[] = ['NGN', 'GHS', 'KES', 'ZAR'];
  const isLocalCurrency = localCurrencies.includes(options.currency);

  if (options.provider === 'flutterwave') {
    if (!isLocalCurrency) {
      return methods.filter((m) => m === 'card');
    }
    return methods;
  }

  // Paystack is primarily Africa-focused; keep mobile methods only where we have local currency pricing.
  if (options.provider === 'paystack') {
    if (!isLocalCurrency) {
      return methods.filter((m) => m === 'card');
    }
    return methods;
  }

  return methods;
}
