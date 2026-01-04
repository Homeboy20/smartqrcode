// Supabase Scheduled Edge Function: process-contact-outbox
// Sends automated email notifications for new contact messages.
//
// Best practice: use outbox table so submission is fast and resilient.
// This function should be scheduled (e.g., every minute) in Supabase.
//
// Required secrets:
// - RESEND_API_KEY (or replace with your provider)
// - CONTACT_NOTIFY_TO (destination email, e.g. support@scanmagic.online)
// - CONTACT_NOTIFY_FROM (verified sender, e.g. ScanMagic <noreply@scanmagic.online>)
//
// Deploy: supabase functions deploy process-contact-outbox

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowOrigin = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonCors(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffSeconds(attempts: number) {
  // exponential-ish backoff with cap
  const base = Math.min(60 * 30, Math.pow(2, Math.min(attempts, 10))); // cap ~30m
  return Math.max(10, base);
}

async function sendViaResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email provider error (${res.status}): ${body}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const CONTACT_NOTIFY_TO = Deno.env.get('CONTACT_NOTIFY_TO');
  const CONTACT_NOTIFY_FROM = Deno.env.get('CONTACT_NOTIFY_FROM');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonCors(req, 500, { error: 'Supabase environment not configured' });
  }

  if (!RESEND_API_KEY || !CONTACT_NOTIFY_TO || !CONTACT_NOTIFY_FROM) {
    return jsonCors(req, 500, { error: 'Email environment not configured' });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull a small batch each run; scale by increasing schedule frequency.
  const { data: jobs, error } = await adminClient
    .from('contact_notification_outbox')
    .select('id, message_id, attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) return jsonCors(req, 500, { error: 'Failed to fetch outbox' });

  let sent = 0;
  let failed = 0;

  for (const job of jobs || []) {
    try {
      // Fetch message payload (service role)
      const { data: msg, error: msgErr } = await adminClient
        .from('contact_messages')
        .select('created_at, name, email, subject, message')
        .eq('id', job.message_id)
        .single();

      if (msgErr || !msg) throw new Error('Missing contact message');

      const subject = `[Contact] ${msg.subject}`;
      const text = [
        `Date: ${new Date(msg.created_at).toLocaleString()}`,
        `From: ${msg.name} <${msg.email}>`,
        '',
        msg.message,
      ].join('\n');

      await sendViaResend({
        apiKey: RESEND_API_KEY,
        from: CONTACT_NOTIFY_FROM,
        to: CONTACT_NOTIFY_TO,
        subject,
        text,
      });

      await adminClient
        .from('contact_notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', job.id);

      sent += 1;
    } catch (e: any) {
      failed += 1;
      const attempts = (job.attempts ?? 0) + 1;
      const next = new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString();

      await adminClient
        .from('contact_notification_outbox')
        .update({
          status: attempts >= 12 ? 'failed' : 'pending',
          attempts,
          last_error: e?.message || 'Unknown error',
          next_attempt_at: next,
        })
        .eq('id', job.id);

      // small delay to avoid hammering provider
      await sleep(250);
    }
  }

  return jsonCors(req, 200, { ok: true, processed: (jobs || []).length, sent, failed });
});
