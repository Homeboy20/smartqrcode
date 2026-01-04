// Supabase Edge Function: submit-contact
// Public endpoint for contact form submissions.
// - Supports anonymous + authenticated users
// - Prevents user_id spoofing (server determines user_id)
// - Implements rate limiting and basic anti-spam
//
// Deploy with: supabase functions deploy submit-contact

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SubmitPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
  // Honeypot field (must be empty)
  website?: string;
  // Optional client-provided recaptcha token (verify inside this function if enabled)
  recaptchaToken?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Avoid caching rate-limit responses
      'Cache-Control': 'no-store',
    },
  });
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  // CORS is a browser-side policy, not an auth boundary. Reflect Origin to support localhost/dev.
  const allowOrigin = origin ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonCors(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function btrim(s: string) {
  return (s ?? '').trim();
}

function normalizeWhitespace(s: string) {
  return btrim(s).replace(/\s+/g, ' ');
}

function isLikelyValidEmail(email: string) {
  // Must match DB constraint (keep these aligned)
  return /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(email);
}

function getClientIp(req: Request): string | null {
  // Common reverse proxy headers
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function minuteBucketStart(now: Date) {
  const d = new Date(now);
  d.setSeconds(0, 0);
  return d.toISOString();
}

function daysFromEnv(name: string, fallbackDays: number) {
  const raw = Deno.env.get(name);
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallbackDays;
  return Math.floor(n);
}

function addDaysIso(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonCors(req, 405, { error: 'Method not allowed' });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const CONTACT_IP_PEPPER = Deno.env.get('CONTACT_IP_PEPPER') || '';
  const CONTACT_RETENTION_DAYS = daysFromEnv('CONTACT_RETENTION_DAYS', 180);
  const CONTACT_AUDIT_RETENTION_DAYS = daysFromEnv('CONTACT_AUDIT_RETENTION_DAYS', 365);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonCors(req, 500, { error: 'Supabase environment not configured' });
  }

  let payload: SubmitPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonCors(req, 400, { error: 'Invalid JSON body' });
  }

  const requestId = crypto.randomUUID();

  // Honeypot: if filled, silently accept (avoid giving spammers a signal)
  if (payload.website && btrim(payload.website).length > 0) {
    // Best-effort audit (service role only)
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await adminClient.from('contact_audit_events').insert({
        event_type: 'honeypot',
        request_id: requestId,
        details: { note: 'honeypot_filled' },
        retention_expires_at: addDaysIso(new Date(), CONTACT_AUDIT_RETENTION_DAYS),
      });
    } catch {
      // ignore
    }
    return jsonCors(req, 200, { ok: true });
  }

  const name = normalizeWhitespace(payload.name);
  const email = normalizeWhitespace(payload.email).toLowerCase();
  const subject = normalizeWhitespace(payload.subject);
  const message = btrim(payload.message);

  // Validate (must align with DB constraints)
  if (name.length < 1 || name.length > 120) return jsonCors(req, 400, { error: 'Invalid name' });
  if (!isLikelyValidEmail(email)) return jsonCors(req, 400, { error: 'Invalid email' });
  if (subject.length < 1 || subject.length > 200) return jsonCors(req, 400, { error: 'Invalid subject' });
  if (message.length < 1 || message.length > 5000) return jsonCors(req, 400, { error: 'Invalid message' });

  const userAgent = req.headers.get('user-agent') || null;

  // Determine authenticated user (optional)
  const authHeader = req.headers.get('authorization');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const { data } = await anonClient.auth.getUser();
    userId = data.user?.id ?? null;
  }

  const ip = getClientIp(req);
  const ipHash = ip ? await sha256Hex(`${CONTACT_IP_PEPPER}|${ip}`) : null;
  const contentHash = await sha256Hex(`${email}\n${subject}\n${message}`);

  // Rate limiting: per-minute bucket by user (if authed) else by IP hash.
  // Tune these numbers as needed.
  const now = new Date();
  const bucketStart = minuteBucketStart(now);
  const actorKey = userId ? `user:${userId}` : ipHash ? `ip:${ipHash}` : 'ip:unknown';
  const maxPerMinute = userId ? 6 : 3;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Abuse blocks (manual/admin-controlled)
  const { data: blockRow, error: blockErr } = await adminClient
    .from('contact_abuse_blocks')
    .select('blocked_until')
    .eq('actor_key', actorKey)
    .maybeSingle();

  if (!blockErr && blockRow?.blocked_until) {
    const blockedUntil = new Date(blockRow.blocked_until);
    if (blockedUntil.getTime() > now.getTime()) {
      // Best-effort audit
      try {
        await adminClient.from('contact_audit_events').insert({
          event_type: 'blocked',
          request_id: requestId,
          actor_key: actorKey,
          user_id: userId,
          ip_hash: ipHash,
          user_agent: userAgent,
          content_hash: contentHash,
          details: { blocked_until: blockRow.blocked_until },
          retention_expires_at: addDaysIso(now, CONTACT_AUDIT_RETENTION_DAYS),
        });
      } catch {
        // ignore
      }
      return jsonCors(req, 429, { error: 'Too many requests. Please try later.' });
    }
  }

  const { data: newCount, error: rateErr } = await adminClient.rpc('increment_contact_rate_limit', {
    p_actor_key: actorKey,
    p_bucket_start: bucketStart,
  });

  if (rateErr) {
    return jsonCors(req, 500, { error: 'Rate limit check failed' });
  }

  if (typeof newCount === 'number' && newCount > maxPerMinute) {
    // Best-effort audit
    try {
      await adminClient.from('contact_audit_events').insert({
        event_type: 'rate_limited',
        request_id: requestId,
        actor_key: actorKey,
        user_id: userId,
        ip_hash: ipHash,
        user_agent: userAgent,
        content_hash: contentHash,
        details: { bucket_start: bucketStart, count: newCount, max_per_minute: maxPerMinute },
        retention_expires_at: addDaysIso(now, CONTACT_AUDIT_RETENTION_DAYS),
      });
    } catch {
      // ignore
    }
    return jsonCors(req, 429, { error: 'Too many requests. Please wait and try again.' });
  }

  // Deduplication: reject identical content hashes within a short window.
  // This is an anti-spam measure, not a uniqueness guarantee.
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: recent, error: recentErr } = await adminClient
    .from('contact_messages')
    .select('id')
    .eq('content_hash', contentHash)
    .gte('created_at', tenMinutesAgo)
    .limit(1);

  if (!recentErr && (recent?.length || 0) > 0) {
    // Best-effort audit
    try {
      await adminClient.from('contact_audit_events').insert({
        event_type: 'deduped',
        request_id: requestId,
        actor_key: actorKey,
        user_id: userId,
        ip_hash: ipHash,
        user_agent: userAgent,
        content_hash: contentHash,
        details: { window_minutes: 10 },
        retention_expires_at: addDaysIso(now, CONTACT_AUDIT_RETENTION_DAYS),
      });
    } catch {
      // ignore
    }
    // Silently accept to avoid letting spammers probe dedupe behavior
    return jsonCors(req, 200, { ok: true });
  }

  const retentionExpiresAt = addDaysIso(now, CONTACT_RETENTION_DAYS);

  const { data: inserted, error: insertErr } = await adminClient
    .from('contact_messages')
    .insert({
    user_id: userId,
    name,
    email,
    subject,
    message,
    ip_hash: ipHash,
    user_agent: userAgent,
    content_hash: contentHash,
    source: 'edge_function',
    is_spam: false,
    spam_score: 0,
    retention_expires_at: retentionExpiresAt,
  })
    .select('id')
    .single();

  if (insertErr) {
    return jsonCors(req, 500, { error: 'Failed to submit message' });
  }

  // Enqueue notification (email worker will pick it up)
  try {
    await adminClient.from('contact_notification_outbox').insert({
      message_id: inserted.id,
      status: 'pending',
      next_attempt_at: now.toISOString(),
      retention_expires_at: addDaysIso(now, CONTACT_AUDIT_RETENTION_DAYS),
    });
  } catch {
    // ignore (submission still succeeded)
  }

  // Audit submit
  try {
    await adminClient.from('contact_audit_events').insert({
      event_type: 'submitted',
      request_id: requestId,
      actor_key: actorKey,
      user_id: userId,
      ip_hash: ipHash,
      user_agent: userAgent,
      content_hash: contentHash,
      message_id: inserted.id,
      details: { retention_expires_at: retentionExpiresAt },
      retention_expires_at: addDaysIso(now, CONTACT_AUDIT_RETENTION_DAYS),
    });
  } catch {
    // ignore
  }

  return jsonCors(req, 200, { ok: true });
});
