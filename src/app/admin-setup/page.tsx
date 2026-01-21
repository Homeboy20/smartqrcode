"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

type StatusState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function AdminSetupPage() {
  const { user, loading, getAccessToken } = useSupabaseAuth();
  const [setupSecret, setSetupSecret] = useState('');
  const [status, setStatus] = useState<StatusState>({ kind: 'idle' });
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user) {
        if (!cancelled) setIsAdmin(null);
        return;
      }

      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled) setIsAdmin(false);
          return;
        }

        const response = await fetch('/api/admin/auth-status', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (!cancelled) setIsAdmin(false);
          return;
        }

        const data = await response.json();
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken]);

  const makeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setStatus({ kind: 'error', message: 'You must be logged in to run setup.' });
      return;
    }

    if (!setupSecret.trim()) {
      setStatus({ kind: 'error', message: 'ADMIN_SETUP_SECRET is required.' });
      return;
    }

    try {
      setStatus({ kind: 'loading', message: 'Creating admin…' });

      const response = await fetch('/api/setup/admin-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          setupSecret: setupSecret.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to create admin');
      }

      setSetupSecret('');
      setStatus({ kind: 'success', message: payload?.message || 'Admin created successfully. Sign out and sign back in.' });
      setIsAdmin(true);
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to create admin' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Admin Setup</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Admin Setup</h1>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-yellow-700">You must be logged in to access this page.</p>
          <p className="mt-2 text-sm text-yellow-700">
            Go to <Link href="/login" className="underline">Login</Link> or <Link href="/register" className="underline">Register</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Admin Setup</h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Your Supabase Account</h2>
        <p><strong>User ID:</strong> {user.id}</p>
        <p><strong>Email:</strong> {user.email || 'N/A'}</p>
        <p><strong>Admin Status:</strong> {isAdmin === null ? 'Unknown' : isAdmin ? 'Admin' : 'Not admin'}</p>

        {isAdmin ? (
          <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-4">
            <p className="text-green-700">You already have admin privileges.</p>
          </div>
        ) : (
          <form onSubmit={makeAdmin} className="mt-4 space-y-3">
            <div>
              <label htmlFor="setupSecret" className="block text-sm font-medium text-gray-700">
                Setup Secret Key (ADMIN_SETUP_SECRET)
              </label>
              <input
                id="setupSecret"
                type="password"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Enter ADMIN_SETUP_SECRET"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-500">
                After setup, remove ADMIN_SETUP_SECRET from your environment.
              </p>
            </div>

            <button
              type="submit"
              disabled={status.kind === 'loading'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {status.kind === 'loading' ? 'Processing…' : 'Make Me Admin'}
            </button>
          </form>
        )}

        {status.kind !== 'idle' && (
          <div className={`mt-4 p-4 rounded ${status.kind === 'success' ? 'bg-green-50 text-green-700' : status.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {status.message}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p className="font-semibold">Important Notes:</p>
          <ul className="list-disc pl-4 mt-2">
            <li>Only the first admin can be created via this setup flow.</li>
            <li>After becoming admin, sign out and sign back in.</li>
            <li>If you already have an admin, manage roles from the admin panel.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}