// Supabase Scheduled Edge Function: purge-contact-data
// Enforces GDPR retention by deleting expired contact data.
// Schedule daily (or more frequently) in Supabase.
//
// Deploy: supabase functions deploy purge-contact-data

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonCors(req, 500, { error: 'Supabase environment not configured' });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Use RPC so purge logic stays centralized in the DB and is service-role only.
  const { data, error } = await adminClient.rpc('purge_contact_data', { p_limit: 5000 });
  if (error) return jsonCors(req, 500, { error: 'Purge failed', details: error.message });

  return jsonCors(req, 200, { ok: true, result: data });
});
