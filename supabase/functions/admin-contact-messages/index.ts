// Supabase Edge Function: admin-contact-messages
// Admin-only endpoint to list contact messages.
// - Verifies caller is authenticated
// - Verifies caller is admin (via users table) using service role
// - Performs reads using service role (RLS bypass)
//
// Deploy with: supabase functions deploy admin-contact-messages

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  // CORS is a browser-side policy, not an auth boundary. We reflect Origin for browser clients
  // so localhost/dev works without extra secrets. AuthZ is enforced by bearer token + admin check.
  const allowOrigin = origin ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonCors(req, 405, { error: 'Method not allowed' });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonCors(req, 500, { error: 'Supabase environment not configured' });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return jsonCors(req, 401, { error: 'Authentication required' });
  }

  // Verify user identity via anon client + provided JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return jsonCors(req, 401, { error: 'Invalid or expired session' });
  }

  const userId = userData.user.id;

  // Admin check + data read via service role
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roleRow, error: roleErr } = await adminClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (roleErr || roleRow?.role !== 'admin') {
    return jsonCors(req, 403, { error: 'Admin access required' });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || '100'), 500);

  const { data: messages, error: listErr } = await adminClient
    .from('contact_messages')
    .select('id, created_at, name, email, subject, message, user_id, ip_hash, source, is_spam, spam_score')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (listErr) {
    return jsonCors(req, 500, { error: 'Failed to fetch messages' });
  }

  // Best-effort audit logging for admin access
  try {
    const requestId = crypto.randomUUID();
    await adminClient.from('contact_audit_events').insert({
      event_type: 'admin_list',
      request_id: requestId,
      actor_key: `user:${userId}`,
      user_id: userId,
      details: { limit },
    });
  } catch {
    // ignore
  }

  return jsonCors(req, 200, { messages: messages || [] });
});
