'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase/client';

type ContactMessage = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  user_id: string | null;
};

function truncate(text: string, maxLen: number) {
  const cleaned = (text || '').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`;
}

export default function AdminContactMessagesPage() {
  const { loading: authLoading, isAdmin } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      setError(null);
      setMessages([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          setError('Please log in again to continue.');
          setMessages([]);
          return;
        }

        const res = await fetch('/api/admin/contact-messages', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError((json as any)?.error || 'Request failed');
          setMessages([]);
          return;
        }

        setMessages(Array.isArray((json as any)?.messages) ? (json as any).messages : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load messages');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, isAdmin]);

  const canSee = useMemo(() => {
    if (authLoading) return false;
    return isAdmin;
  }, [authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        <p className="ml-4">Verifying authentication...</p>
      </div>
    );
  }

  if (!canSee) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-yellow-700">Please log in with an admin account to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 py-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contact Messages</h1>
        <p className="mt-1 text-sm text-gray-600">Latest submissions from the /contact form (most recent first)</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
          <p className="ml-4">Loading messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">No messages yet.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{m.name}</div>
                      <div className="text-gray-500">{m.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                      <div className="truncate" title={m.subject}>{m.subject}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                      <div className="truncate" title={m.message}>{truncate(m.message, 160)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {m.user_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
