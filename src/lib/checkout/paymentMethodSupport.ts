export type CheckoutPaymentMethod = 'card' | 'mobile_money' | 'apple_pay' | 'google_pay';

export type UniversalPaymentProvider = 'paystack' | 'flutterwave' | 'stripe' | 'paypal';

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
