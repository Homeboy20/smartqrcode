import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/server';

// Public endpoint to check if app is in free mode
export async function GET(request: NextRequest) {
  try {
    console.log('[app-settings API] Fetching settings from database...');

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

    if (!data) {
      console.log('[app-settings API] No data found, using defaults');
    } else {
      console.log('[app-settings API] Found data:', data);
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
    };

    const response = { 
      freeMode: settings.freeMode,
      freeModeFeatures: settings.freeModeFeatures,
      branding: settings.branding || {
        siteName: 'ScanMagic',
        logoUrl: '',
      },
      // Firebase Web App config is safe to expose client-side.
      firebase: settings.firebase || {
        enabled: false,
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
      },
    };
    
    console.log('[app-settings API] Returning:', response);
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
    });
  }
}
