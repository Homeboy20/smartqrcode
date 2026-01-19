import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
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

function mergePricingSettings(raw: any, defaults: SubscriptionPricing): SubscriptionPricing {
  const input = (raw?.pricing ?? raw?.subscriptionPricing ?? raw?.subscription_pricing ?? {}) as any;
  const tiers: Array<'pro' | 'business'> = ['pro', 'business'];

  const merged: SubscriptionPricing = {
    pro: { ...defaults.pro, localPrices: { ...(defaults.pro.localPrices ?? {}) } },
    business: { ...defaults.business, localPrices: { ...(defaults.business.localPrices ?? {}) } },
  };

  for (const tier of tiers) {
    const candidate = (input?.[tier] ?? {}) as any;
    const usdPrice = toNumberOrUndefined(candidate?.usdPrice ?? candidate?.usd_price);
    if (usdPrice !== undefined) merged[tier].usdPrice = usdPrice;

    const localPrices = (candidate?.localPrices ?? candidate?.local_prices ?? {}) as Record<string, unknown>;
    for (const [code, value] of Object.entries(localPrices)) {
      const upper = String(code || '').toUpperCase() as CurrencyCode;
      const n = toNumberOrUndefined(value);
      if (!n) continue;
      if (!/^[A-Z]{3}$/.test(upper)) continue;
      (merged[tier].localPrices as any)[upper] = n;
    }
  }

  return merged;
}

function mergeFirebaseSettings(raw: any, defaults: FirebaseSettings): FirebaseSettings {
  const firebaseConfig = (raw?.firebaseConfig ?? raw?.firebase_config ?? {}) as FirebaseSettings;
  const firebase = (raw?.firebase ?? {}) as FirebaseSettings;

  return {
    ...defaults,
    ...firebaseConfig,
    ...firebase,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authResult = await verifyAdminAccess(request);
    if (!authResult.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase server client is not configured',
          details: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment.'
        },
        { status: 500 }
      );
    }

    // Fetch app settings from database
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    const defaults = {
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

    const raw = ((data as any)?.value ?? {}) as any;

    const settings = {
      ...defaults,
      ...raw,
      freeModeFeatures: {
        ...defaults.freeModeFeatures,
        ...(raw?.freeModeFeatures ?? {}),
      },
      branding: {
        ...defaults.branding,
        ...(raw?.branding ?? {}),
      },
      firebase: mergeFirebaseSettings(raw, defaults.firebase),
      pricing: mergePricingSettings(raw, defaults.pricing),
    };

    // Avoid returning legacy keys to the admin UI.
    delete (settings as any).firebaseConfig;
    delete (settings as any).firebase_config;
    delete (settings as any).subscriptionPricing;
    delete (settings as any).subscription_pricing;

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch app settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) console.log('[admin/app-settings POST] Starting save...');
    
    // Verify admin access
    const authResult = await verifyAdminAccess(request);
    if (!authResult.isAdmin) {
      console.error('[admin/app-settings POST] Admin access denied');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase server client is not configured',
          details: 'Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in your environment.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { settings } = body;
    if (isDev) console.log('[admin/app-settings POST] Received settings');

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings are required' },
        { status: 400 }
      );
    }

    // Normalize settings before saving (support legacy firebaseConfig field)
    const normalizedSettings = { ...(settings as any) };
    const firebaseDefaults: FirebaseSettings = {
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
    normalizedSettings.firebase = mergeFirebaseSettings(normalizedSettings, firebaseDefaults);
    delete normalizedSettings.firebaseConfig;
    delete normalizedSettings.firebase_config;

    const pricingDefaults: SubscriptionPricing = SUBSCRIPTION_PRICING;
    normalizedSettings.pricing = mergePricingSettings(normalizedSettings, pricingDefaults);
    delete normalizedSettings.subscriptionPricing;
    delete normalizedSettings.subscription_pricing;

    if (isDev) console.log('[admin/app-settings POST] Upserting settings...');
    const nowIso = new Date().toISOString();
    const { data: saved, error: upsertError } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'general',
          value: normalizedSettings,
          updated_at: nowIso,
        },
        {
          onConflict: 'key',
        }
      )
      .select('value')
      .single();

    if (upsertError) {
      console.error('[admin/app-settings POST] Database error:', upsertError);
      if (upsertError.message?.includes('relation') || upsertError.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'Database table "app_settings" does not exist. Please run the SQL migration in Supabase Dashboard.',
            details: 'Go to Supabase Dashboard → SQL Editor → Run CREATE_APP_SETTINGS_TABLE.sql'
          },
          { status: 500 }
        );
      }
      throw upsertError;
    }

    if (isDev) console.log('[admin/app-settings POST] Settings saved successfully');
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: (saved as any)?.value ?? normalizedSettings,
    });
  } catch (error: any) {
    console.error('[admin/app-settings POST] Error saving app settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save app settings' },
      { status: 500 }
    );
  }
}
