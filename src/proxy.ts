import type { NextRequest } from 'next/server';

import { createSupabaseMiddlewareClient } from '@/lib/supabase/ssr';

/**
 * Supabase SSR proxy.
 * Refreshes auth cookies so route handlers and server components can trust cookie auth.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  // If env vars are missing, just continue.
  if (!supabase) return response;

  // Touch auth to trigger cookie refresh when needed.
  // We do not enforce redirects here (pages already guard client-side).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on all routes except Next internals and common static assets.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
