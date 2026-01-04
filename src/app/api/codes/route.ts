import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { encryptString } from '@/lib/codeEncryption';
import { hasFeatureAccess, type SubscriptionTier, type FeatureType } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

type CodeType = 'qrcode' | 'barcode';

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await verifyUserAccess(request);

    const body = await request.json().catch(() => null);

    const destination = typeof body?.destination === 'string' ? body.destination.trim() : '';
    const type: CodeType = body?.type === 'barcode' ? 'barcode' : 'qrcode';
    const encrypt = !!body?.encrypt;
    const nameRaw = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!destination) {
      return NextResponse.json({ error: 'Missing destination' }, { status: 400 });
    }

    if (!isValidHttpUrl(destination)) {
      return NextResponse.json(
        { error: 'Destination must be an http(s) URL for dynamic codes' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = ((userRow?.subscription_tier as SubscriptionTier) || 'free') as SubscriptionTier;

    const requiredFeature: FeatureType = type === 'barcode' ? 'enhancedBarcodes' : 'qrCodeTracking';
    if (!hasFeatureAccess(tier, requiredFeature)) {
      return NextResponse.json(
        { error: 'Upgrade required for dynamic codes' },
        { status: 403 }
      );
    }

    const storedContent = encrypt ? encryptString(destination) : destination;

    const name =
      nameRaw ||
      `Dynamic ${type === 'barcode' ? 'Barcode' : 'QR'} (${new Date().toISOString().slice(0, 10)})`;

    const { data: created, error } = await supabase
      .from('qrcodes')
      .insert({
        user_id: userId,
        user_email: email || null,
        name,
        content: storedContent,
        type,
        format: 'png',
        scans: 0,
        customizations: {
          kind: 'dynamic',
          encrypted: encrypt,
        },
      })
      .select('id')
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create code' },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;
    const url = `${origin}/c/${created.id}`;

    return NextResponse.json({ id: created.id, url }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/codes error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create code' },
      { status: 500 }
    );
  }
}
