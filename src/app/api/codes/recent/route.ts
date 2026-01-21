import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(20, Number(limitParam || 5) || 5));

    const { data, error } = await supabase
      .from('qrcodes')
      .select('id,name,type,scans,created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ codes: data || [] });
  } catch (error: any) {
    const message = error?.message || 'Unauthorized';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
