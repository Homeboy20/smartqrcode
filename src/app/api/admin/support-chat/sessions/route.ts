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

    const { data, error } = await admin
      .from('support_chat_sessions')
      .select('id, session_id, user_id, user_email, subject, status, last_message_at, created_at, updated_at, transcript_last_sent_at')
      .order('last_message_at', { ascending: false });

    if (error) return json(500, { error: error.message });

    const sessions = (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      userEmail: row.user_email,
      subject: row.subject,
      status: row.status,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      transcriptLastSentAt: row.transcript_last_sent_at,
    }));

    return json(200, { sessions });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to load sessions');
    if (/admin access required/i.test(message)) return json(403, { error: 'Admin access required' });
    if (/no authentication token|invalid or expired token/i.test(message)) return json(401, { error: message });
    return json(500, { error: message });
  }
}