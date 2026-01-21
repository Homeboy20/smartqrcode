"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function DebugAuthPage() {
  const { user, session, loading, logout } = useSupabaseAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isDev = useMemo(() => process.env.NODE_ENV === 'development', []);

  if (!isClient) {
    return null;
  }

  if (!isDev) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Auth Debug</h1>
        <p className="text-gray-600">This page is only available in development.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Supabase Auth Debug</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Session</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(
            {
              hasSession: Boolean(session),
              userId: user?.id || null,
              email: user?.email || null,
              expiresAt: session?.expires_at || null,
              accessTokenPrefix: session?.access_token ? `${session.access_token.slice(0, 12)}...` : null,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Current User</h2>
        {loading ? (
          <div className="animate-pulse h-40 bg-gray-200 rounded"></div>
        ) : user ? (
          <div>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role || 'authenticated'}</p>
            <button 
              onClick={() => logout()} 
              className="mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <p>No user is currently signed in.</p>
        )}
      </div>
    </div>
  );
} 