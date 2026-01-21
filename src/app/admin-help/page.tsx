"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function AdminHelpPage() {
  const { user } = useSupabaseAuth();
  const [copied, setCopied] = useState(false);

  const userId = user?.id || 'YOUR_SUPABASE_USER_ID';
  const email = user?.email || 'YOUR_EMAIL';

  const setupSnippet = useMemo(() => {
    return `await fetch('/api/setup/admin-supabase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: '${userId}',
    email: '${email}',
    setupSecret: 'YOUR_ADMIN_SETUP_SECRET'
  })
}).then(r => r.json());`;
  }, [userId, email]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(setupSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Admin Setup Help</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Supabase Admin Setup</h2>

        <p className="mb-4 text-sm text-gray-600">
          Recommended: use the guided setup page at <Link href="/admin-setup" className="underline">/admin-setup</Link>.
        </p>

        {user ? (
          <div className="mb-4 text-sm text-gray-700">
            <p>Current Supabase User ID: <code className="bg-gray-100 px-2 py-1 rounded">{userId}</code></p>
            <p>Current Email: <code className="bg-gray-100 px-2 py-1 rounded">{email}</code></p>
          </div>
        ) : (
          <p className="text-yellow-600 mb-4">You are not logged in. Log in first so we can prefill your user ID.</p>
        )}

        <p className="mb-4">If you need a manual option, you can run this in the browser console (dev only):</p>
        
        <div className="relative">
          <pre className="bg-gray-800 text-green-400 p-4 rounded-md overflow-x-auto text-sm">
            {setupSnippet}
          </pre>
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p className="font-semibold">Notes</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>This setup flow is protected by <code className="bg-gray-100 px-1">ADMIN_SETUP_SECRET</code>.</li>
            <li>Only the first admin can be created via the setup endpoint.</li>
            <li>Remove <code className="bg-gray-100 px-1">ADMIN_SETUP_SECRET</code> after setup.</li>
          </ul>
        </div>
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <h3 className="font-bold text-yellow-700">Important Security Warning</h3>
        <p className="text-yellow-700">
          Do not expose your setup secret publicly. Use only in trusted environments and remove it after creating the initial admin.
        </p>
      </div>
    </div>
  );
} 