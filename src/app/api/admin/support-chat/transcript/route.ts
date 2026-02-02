import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabase/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { validateEmail } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function formatTranscript(messages: any[]) {
  return messages
    .map((m) => {
      const ts = new Date(m.created_at).toISOString();
      const who = m.sender === 'agent' ? 'Agent' : m.sender === 'user' ? 'User' : 'System';
      return `[${ts}] ${who}: ${m.message}`;
    })
    .join('\n');
}

export async function POST(request: Request) {
  try {
    await verifyAdminAccess(request);

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      return json(400, { error: 'Email service not configured' });
    }

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || '').trim();
    const overrideEmail = String(body?.toEmail || '').trim().toLowerCase();

    if (!sessionId) return json(400, { error: 'sessionId is required' });

    const { data: sessionRow, error: sessionError } = await admin
      .from('support_chat_sessions')
      .select('session_id, user_email')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (sessionError) return json(500, { error: sessionError.message });

    const recipient = overrideEmail || sessionRow?.user_email || '';
    try {
      validateEmail(recipient, 'email');
    } catch {
      return json(400, { error: 'Valid recipient email is required' });
    }

    const { data: messages, error: messagesError } = await admin
      .from('support_chat_messages')
      .select('sender, message, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) return json(500, { error: messagesError.message });

    const transcript = formatTranscript(messages || []);
    const subject = `Your ScanMagic support chat transcript`;

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject,
      text: transcript || 'No messages in this conversation yet.',
    });

    await admin
      .from('support_chat_sessions')
      .update({ transcript_last_sent_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    return json(200, { ok: true });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to send transcript');
    if (/admin access required/i.test(message)) return json(403, { error: 'Admin access required' });
    if (/no authentication token|invalid or expired token/i.test(message)) return json(401, { error: message });
    return json(500, { error: message });
  }
}