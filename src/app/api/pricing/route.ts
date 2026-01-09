import { NextRequest, NextResponse } from 'next/server';
import { 
  detectCountryFromHeaders, 
  getCurrencyForCountry,
  getLocalPrice,
  formatCurrency,
  getRecommendedProvider,
  SUBSCRIPTION_PRICING
} from '@/lib/currency';
import { chooseDefaultProvider, getAvailableCheckoutProviders } from '@/lib/checkout/universalCheckout';

export async function GET(request: NextRequest) {
  try {
    // Detect country from headers
    const countryCode = detectCountryFromHeaders(request.headers);
    const currencyConfig = getCurrencyForCountry(countryCode);

    const availableProviders = await getAvailableCheckoutProviders();
    const recommendedProvider = chooseDefaultProvider({
      currency: currencyConfig.code,
      availableProviders,
    });
    
    // Get pricing for all tiers
    const pricing = {
      pro: {
        amount: getLocalPrice('pro', currencyConfig.code),
        formatted: formatCurrency(getLocalPrice('pro', currencyConfig.code), currencyConfig.code),
        usd: SUBSCRIPTION_PRICING.pro.usdPrice,
      },
      business: {
        amount: getLocalPrice('business', currencyConfig.code),
        formatted: formatCurrency(getLocalPrice('business', currencyConfig.code), currencyConfig.code),
        usd: SUBSCRIPTION_PRICING.business.usdPrice,
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
