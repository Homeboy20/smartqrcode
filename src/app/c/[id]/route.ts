import { NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';
import { decryptString } from '@/lib/codeEncryption';

export const dynamic = 'force-dynamic';

function isSafeRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: code, error } = await supabase
      .from('qrcodes')
      .select('id, content, scans')
      .eq('id', params.id)
      .single();

    if (error || !code) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    let destination: string;
    try {
      destination = decryptString(String(code.content || ''));
    } catch {
      return NextResponse.json({ error: 'Invalid encrypted destination' }, { status: 400 });
    }

    if (!isSafeRedirectUrl(destination)) {
      return NextResponse.json({ error: 'Invalid destination URL' }, { status: 400 });
    }

    // Best-effort scan increment.
    try {
      const nextScans = Number(code.scans || 0) + 1;
      await supabase
        .from('qrcodes')
        .update({ scans: nextScans, updated_at: new Date().toISOString() })
        .eq('id', params.id);
    } catch (e) {
      console.warn('Failed to increment scans:', e);
    }

    return NextResponse.redirect(destination, 302);
  } catch (error: any) {
    console.error('GET /c/[id] error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to resolve code' },
      { status: 500 }
    );
  }
}
