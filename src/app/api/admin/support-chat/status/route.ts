import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

const VALID_STATUSES = new Set(['open', 'pending', 'closed']);

export async function PATCH(request: Request) {
  try {
    await verifyAdminAccess(request);

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || '').trim();
    const status = String(body?.status || '').trim();

    if (!sessionId) return json(400, { error: 'sessionId is required' });
    if (!VALID_STATUSES.has(status)) return json(400, { error: 'Invalid status' });

    const { error } = await admin
      .from('support_chat_sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to update status');
    if (/admin access required/i.test(message)) return json(403, { error: 'Admin access required' });
    if (/no authentication token|invalid or expired token/i.test(message)) return json(401, { error: message });
    return json(500, { error: message });
  }
}