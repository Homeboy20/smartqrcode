'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    const redirect = searchParams?.get('redirect');
    if (!redirect) return '/';
    // only allow internal redirects
    if (!redirect.startsWith('/')) return '/';
    return redirect;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    function parseHashParams(hash: string) {
      const out: Record<string, string> = {};
      const cleaned = (hash || '').startsWith('#') ? (hash || '').slice(1) : (hash || '');
      for (const part of cleaned.split('&')) {
        if (!part) continue;
        const [k, v] = part.split('=');
        if (!k) continue;
        out[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
      return out;
    }

    async function run() {
      try {
        const code = searchParams?.get('code');
        const errorDescription = searchParams?.get('error_description');

        if (errorDescription) {
          setError(errorDescription);
          return;
        }

        // If we have a code, exchange it for a session (OAuth PKCE).
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (typeof window !== 'undefined' && window.location.hash) {
          // Magic-link / implicit redirect: access_token and refresh_token are returned in URL hash.
          const hashParams = parseHashParams(window.location.hash);
          const access_token = hashParams['access_token'];
          const refresh_token = hashParams['refresh_token'];

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;

            // Clean the hash to avoid leaking tokens via copy/paste.
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }

        if (!cancelled) {
          router.replace(redirectTarget);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to complete sign-in');
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, redirectTarget]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-bold text-gray-900">Sign-in failed</h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => router.replace('/login')}
            className="mt-6 w-full py-2 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-gray-900">Signing you in…</h1>
        <p className="mt-2 text-gray-600">Please wait while we finish authentication.</p>
        <div className="mt-6 h-2 w-full bg-gray-100 rounded overflow-hidden">
          <div className="h-full w-1/2 bg-indigo-600 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
