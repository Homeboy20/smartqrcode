import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function toIsoDay(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await verifyUserAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: codeRow, error: codeErr } = await supabase
      .from('qrcodes')
      .select('id, user_id, name, type, scans, created_at, last_scan')
      .eq('id', params.id)
      .maybeSingle();

    if (codeErr || !codeRow) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    if (codeRow.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { count: totalEvents } = await supabase
      .from('qrcode_scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('code_id', params.id);

    const { data: events } = await supabase
      .from('qrcode_scan_events')
      .select('scanned_at, country, referer, user_agent')
      .eq('code_id', params.id)
      .order('scanned_at', { ascending: false })
      .limit(200);

    const countryCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};

    for (const e of events || []) {
      const country = (e as any).country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;

      const day = toIsoDay((e as any).scanned_at);
      if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    const perDay = Object.entries(dailyCounts)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([day, count]) => ({ day, count }));

    return NextResponse.json({
      code: {
        id: codeRow.id,
        name: codeRow.name,
        type: codeRow.type,
        scans: codeRow.scans ?? 0,
        created_at: codeRow.created_at,
        last_scan: codeRow.last_scan,
      },
      events: events || [],
      summary: {
        total_events: totalEvents ?? 0,
        top_countries: topCountries,
        per_day: perDay,
      },
    });
  } catch (error: any) {
    console.error('GET /api/codes/[id]/analytics error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
