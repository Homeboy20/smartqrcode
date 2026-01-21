import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type CodeRow = {
  id: string;
  name: string | null;
  type: string | null;
  scans: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const topLimitParam = url.searchParams.get('top');
    const topLimit = Math.max(1, Math.min(10, Number(topLimitParam || 5) || 5));

    const { data, error } = await supabase
      .from('qrcodes')
      .select('id,name,type,scans,created_at,updated_at')
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const codes: CodeRow[] = (data as any) || [];

    const totalCodes = codes.length;
    const totalScans = codes.reduce((sum, code) => sum + (Number(code.scans) || 0), 0);

    const codesByType: Record<string, { count: number; scans: number }> = {};
    for (const code of codes) {
      const type = (code.type || 'unknown').toLowerCase();
      const scans = Number(code.scans) || 0;
      if (!codesByType[type]) codesByType[type] = { count: 0, scans: 0 };
      codesByType[type].count += 1;
      codesByType[type].scans += scans;
    }

    const topCodes = [...codes]
      .sort((a, b) => (Number(b.scans) || 0) - (Number(a.scans) || 0))
      .slice(0, topLimit)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        scans: Number(c.scans) || 0,
        created_at: c.created_at || null,
        updated_at: c.updated_at || null,
      }));

    return NextResponse.json({
      totalCodes,
      totalScans,
      codesByType,
      topCodes,
    });
  } catch (error: any) {
    const message = error?.message || 'Unauthorized';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
