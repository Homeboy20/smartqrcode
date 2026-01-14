import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';
import type { FeatureType } from '@/lib/subscription';

const ALLOWED_FEATURES: readonly FeatureType[] = [
  'qrCodesGenerated',
  'barcodesGenerated',
  'bulkGenerations',
  'aiCustomizations',
  'noWatermark',
  'svgDownload',
  'pdfDownload',
  'qrCodeTracking',
  'enhancedBarcodes',
  'fileUploads',
  'analytics',
];

function isFeatureType(value: unknown): value is FeatureType {
  return typeof value === 'string' && (ALLOWED_FEATURES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    // Verify user
    const verifier = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await verifier.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = userData.user;

    const body = await request.json().catch(() => null);
    const feature = body?.feature;
    const amountRaw = body?.amount;

    if (!isFeatureType(feature)) {
      return NextResponse.json({ error: 'Invalid feature' }, { status: 400 });
    }

    const amount = Number.isFinite(amountRaw) ? Math.floor(Number(amountRaw)) : 1;
    const safeAmount = Math.min(Math.max(amount, 1), 100);

    // Use a client scoped to the user's JWT so RLS can allow updating their own row.
    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: existingRow, error: rowError } = await authed
      .from('users')
      .select('features_usage')
      .eq('id', user.id)
      .maybeSingle();

    if (rowError) {
      return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
    }

    // If the row doesn't exist yet, create it (idempotent).
    if (!existingRow) {
      await authed
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email,
            subscription_tier: 'free',
            role: 'user',
            features_usage: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );
    }

    const existingUsage = (existingRow?.features_usage as any) || {};
    const currentValue = Number(existingUsage?.[feature] || 0);
    const nextValue = Math.max(0, currentValue + safeAmount);

    const updatedUsage = {
      ...existingUsage,
      [feature]: nextValue,
    };

    const { error: updateError } = await authed
      .from('users')
      .update({ features_usage: updatedUsage })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/usage/track-new error:', error);
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
  }
}
