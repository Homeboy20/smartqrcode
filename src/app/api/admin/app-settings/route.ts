import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

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
      },
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
    };

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
    console.log('[admin/app-settings POST] Starting save...');
    
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
    console.log('[admin/app-settings POST] Received settings:', JSON.stringify(settings));

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings are required' },
        { status: 400 }
      );
    }

    console.log('[admin/app-settings POST] Upserting settings...');
    const nowIso = new Date().toISOString();
    const { data: saved, error: upsertError } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'general',
          value: settings,
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

    console.log('[admin/app-settings POST] Settings saved successfully! Saved value:', JSON.stringify((saved as any)?.value));
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: (saved as any)?.value ?? settings,
    });
  } catch (error: any) {
    console.error('[admin/app-settings POST] Error saving app settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save app settings' },
      { status: 500 }
    );
  }
}
