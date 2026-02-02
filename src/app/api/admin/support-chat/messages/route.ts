import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  try {
    await verifyAdminAccess(request);

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const url = new URL(request.url);
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    if (!sessionId) return json(400, { error: 'sessionId is required' });

    const { data, error } = await admin
      .from('support_chat_messages')
      .select('id, session_id, sender, message, created_at, user_id, agent_id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return json(500, { error: error.message });

    const messages = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      from: row.sender,
      text: row.message,
      ts: new Date(row.created_at).getTime(),
      userId: row.user_id,
      agentId: row.agent_id,
    }));

    return json(200, { messages });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to load messages');
    if (/admin access required/i.test(message)) return json(403, { error: 'Admin access required' });
    if (/no authentication token|invalid or expired token/i.test(message)) return json(401, { error: message });
    return json(500, { error: message });
  }
}