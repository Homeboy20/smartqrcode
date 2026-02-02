import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  try {
    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const url = new URL(request.url);
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    if (!sessionId) return json(400, { error: 'sessionId is required' });

    const { data, error } = await admin
      .from('support_chat_messages')
      .select('id, session_id, sender, message, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return json(500, { error: error.message });

    const messages = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      from: row.sender,
      text: row.message,
      ts: new Date(row.created_at).getTime(),
    }));

    return json(200, { messages });
  } catch (error: any) {
    return json(500, { error: String(error?.message || 'Failed to fetch messages') });
  }
}