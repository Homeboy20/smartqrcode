import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const adminAuth = await verifyAdminAccess(request);

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || '').trim();
    const text = String(body?.text || '').trim();

    if (!sessionId) return json(400, { error: 'sessionId is required' });
    if (!text) return json(400, { error: 'Message text is required' });

    const now = new Date().toISOString();
    const { error: sessionError } = await admin
      .from('support_chat_sessions')
      .update({ last_message_at: now, updated_at: now })
      .eq('session_id', sessionId);

    if (sessionError) return json(500, { error: sessionError.message });

    const { error: messageError } = await admin
      .from('support_chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'agent',
        message: text,
        agent_id: adminAuth.userId,
      });

    if (messageError) return json(500, { error: messageError.message });

    return json(200, { ok: true });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to send message');
    if (/admin access required/i.test(message)) return json(403, { error: 'Admin access required' });
    if (/no authentication token|invalid or expired token/i.test(message)) return json(401, { error: message });
    return json(500, { error: message });
  }
}