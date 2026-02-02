import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { validateEmail } from '@/lib/validation';
import { verifyUserAccess } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || '').trim();
    const text = String(body?.text || '').trim();
    const subject = String(body?.subject || '').trim();
    const providedEmail = String(body?.email || '').trim().toLowerCase();

    if (!sessionId) return json(400, { error: 'sessionId is required' });
    if (!text) return json(400, { error: 'Message text is required' });

    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const auth = await verifyUserAccess(request);
      userId = auth.userId;
      userEmail = auth.email || null;
    } catch {
      // No auth session, fall back to optional email.
    }

    if (!userEmail && providedEmail) {
      try {
        validateEmail(providedEmail, 'email');
        userEmail = providedEmail;
      } catch {
        return json(400, { error: 'Invalid email address' });
      }
    }

    const now = new Date().toISOString();
    const sessionPayload: Record<string, any> = {
      session_id: sessionId,
      last_message_at: now,
      updated_at: now,
      status: 'open',
    };

    if (userId) sessionPayload.user_id = userId;
    if (userEmail) sessionPayload.user_email = userEmail;
    if (subject) sessionPayload.subject = subject;

    const { error: sessionError } = await admin
      .from('support_chat_sessions')
      .upsert(sessionPayload, { onConflict: 'session_id' });

    if (sessionError) return json(500, { error: sessionError.message });

    const { error: messageError } = await admin
      .from('support_chat_messages')
      .insert({
        session_id: sessionId,
        sender: 'user',
        message: text,
        user_id: userId,
      });

    if (messageError) return json(500, { error: messageError.message });

    return json(200, { ok: true });
  } catch (error: any) {
    return json(500, { error: String(error?.message || 'Failed to send message') });
  }
}