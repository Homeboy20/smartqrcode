import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/server';
import { SUBSCRIPTION_PRICING, type PricingTier, type CurrencyCode } from '@/lib/currency';

type FirebaseSettings = {
  enabled?: boolean;
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  phoneAuthEnabled?: boolean;
  recaptchaSiteKey?: string;
};

type SubscriptionPricing = Record<'pro' | 'business', PricingTier>;

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function mergePricingSettings(input: any): SubscriptionPricing {
  const defaults: SubscriptionPricing = SUBSCRIPTION_PRICING;
  const raw = (input?.pricing ?? input?.subscriptionPricing ?? input?.subscription_pricing ?? {}) as any;

  const tiers: Array<'pro' | 'business'> = ['pro', 'business'];
  const merged: SubscriptionPricing = {
    pro: { ...defaults.pro, localPrices: { ...(defaults.pro.localPrices ?? {}) } },
    business: { ...defaults.business, localPrices: { ...(defaults.business.localPrices ?? {}) } },
  };

  for (const tier of tiers) {
    const candidate = (raw?.[tier] ?? {}) as any;
    const usdPrice = toNumberOrUndefined(candidate?.usdPrice ?? candidate?.usd_price);
    if (usdPrice !== undefined) merged[tier].usdPrice = usdPrice;

    const localPrices = (candidate?.localPrices ?? candidate?.local_prices ?? {}) as Record<string, unknown>;
    for (const [code, value] of Object.entries(localPrices)) {
      const upper = String(code || '').toUpperCase() as CurrencyCode;
      const n = toNumberOrUndefined(value);
      if (!n) continue;
      if (!['USD', 'NGN', 'GHS', 'KES', 'ZAR', 'GBP', 'EUR'].includes(upper)) continue;
      (merged[tier].localPrices as any)[upper] = n;
    }
  }

  return merged;
}

function mergeFirebaseSettings(input: any): FirebaseSettings {
  const defaults: FirebaseSettings = {
    enabled: false,
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
    phoneAuthEnabled: false,
    recaptchaSiteKey: '',
  };

  const firebaseConfig = (input?.firebaseConfig ?? input?.firebase_config ?? {}) as FirebaseSettings;
  const firebase = (input?.firebase ?? {}) as FirebaseSettings;

  // Merge order: defaults -> legacy firebaseConfig -> firebase
  // This preserves `firebase.enabled` while allowing legacy config fields to fill gaps.
  return {
    ...defaults,
    ...firebaseConfig,
    ...firebase,
  };
}

// Public endpoint to check if app is in free mode
export async function GET(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) console.log('[app-settings API] Fetching settings from database...');

    const supabase = createAnonClient();
    if (!supabase) {
      console.warn('[app-settings API] Supabase anon client not configured; returning defaults');
      return NextResponse.json({ 
        freeMode: false,
        freeModeFeatures: {
          qrCodeGeneration: true,
          barcodeGeneration: true,
          basicTemplates: true,
          basicFormats: true,
        },
        branding: {
          siteName: 'ScanMagic',
          logoUrl: '',
          logoSvgUrl: '',
          faviconUrl: '',
        },
        firebase: {
          enabled: false,
          apiKey: '',
          authDomain: '',
          projectId: '',
          storageBucket: '',
          messagingSenderId: '',
          appId: '',
          measurementId: '',
        },
        pricing: SUBSCRIPTION_PRICING,
      });
    }

    // Fetch app settings from database
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[app-settings API] Database error:', error);
      throw error;
    }

    if (isDev) {
      if (!data) console.log('[app-settings API] No data found, using defaults');
      else console.log('[app-settings API] Found data');
    }

    // Return only free mode status (don't expose all settings)
    const settings = data?.value || {
      freeMode: false,
      freeModeFeatures: {
        qrCodeGeneration: true,
        barcodeGeneration: true,
        basicTemplates: true,
        basicFormats: true,
      },
      branding: {
        siteName: 'ScanMagic',
        logoUrl: '',
        logoSvgUrl: '',
        faviconUrl: '',
      },
      firebase: {
        enabled: false,
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
        phoneAuthEnabled: false,
        recaptchaSiteKey: '',
      },
      pricing: SUBSCRIPTION_PRICING,
    };

    const mergedFirebase = mergeFirebaseSettings(settings);
    const mergedPricing = mergePricingSettings(settings);

    const response = { 
      freeMode: settings.freeMode,
      freeModeFeatures: settings.freeModeFeatures,
      branding: settings.branding || {
        siteName: 'ScanMagic',
        logoUrl: '',
        logoSvgUrl: '',
        faviconUrl: '',
      },
      // Firebase Web App config is safe to expose client-side.
      firebase: mergedFirebase,
      // Pricing is also safe to expose client-side.
      pricing: mergedPricing,
    };
    
    if (isDev) console.log('[app-settings API] Returning response');
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching app settings:', error);
    // Return default values on error
    return NextResponse.json({ 
      freeMode: false,
      freeModeFeatures: {
        qrCodeGeneration: true,
        barcodeGeneration: true,
        basicTemplates: true,
        basicFormats: true,
      },
      branding: {
        siteName: 'ScanMagic',
        logoUrl: '',
        logoSvgUrl: '',
        faviconUrl: '',
      },
      firebase: {
        enabled: false,
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
        phoneAuthEnabled: false,
        recaptchaSiteKey: '',
      },
      pricing: SUBSCRIPTION_PRICING,
    });
  }
}
