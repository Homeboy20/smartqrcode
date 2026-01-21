import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Create a Supabase client for Next.js Middleware.
 * This enables cookie-based SSR sessions (httpOnly cookies managed by Supabase).
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) {
    return { supabase: null as any, response: NextResponse.next({ request }) };
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
}

/**
 * Create a Supabase client inside a Route Handler.
 * Returns a response you should return (so cookie updates are preserved).
 */
export function createSupabaseRouteClient(request: NextRequest) {
  const env = getSupabaseEnv();

  // Default response; callers can replace with NextResponse.json but should keep cookie writes.
  const response = NextResponse.next();

  if (!env) {
    return { supabase: null as any, response };
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, response };
}

/**
 * Read-only Supabase server client (route handlers) when you only need to read cookies.
 * Cookie writes are ignored; use middleware to refresh sessions.
 */
export function createSupabaseReadonlyServerClient(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(_cookiesToSet: { name: string; value: string; options: CookieOptionsWithName }[]) {
        // no-op
      },
    },
  });
}
