"use client";

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function SecureAdminSetupPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
      } else {
        setUserId(null);
        setUserEmail(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const makeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      setStatus('You must be logged in');
      return;
    }
    
    if (!setupSecret.trim()) {
      setStatus('Setup secret is required');
      return;
    }
    
    try {
      setProcessing(true);
      setStatus('Processing...');
      
      const response = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
          setupSecret: setupSecret.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin');
      }
      
      setStatus('✅ ' + data.message);
      setSetupSecret(''); // Clear the secret
    } catch (err) {
      console.error('Error:', err);
      setStatus(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Secure Admin Setup</h1>
        
        {!userId ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-yellow-800">
              You must be logged in to set up an admin account.
            </p>
            <a 
              href="/login" 
              className="mt-3 inline-block text-blue-600 hover:underline"
            >
              Go to Login →
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                <strong>User ID:</strong> {userId}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {userEmail}
              </p>
            </div>
            
            <form onSubmit={makeAdmin}>
              <div className="mb-4">
                <label 
                  htmlFor="setupSecret" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Setup Secret Key
                </label>
                <input
                  type="password"
                  id="setupSecret"
                  value={setupSecret}
                  onChange={(e) => setSetupSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the ADMIN_SETUP_SECRET"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  This is the ADMIN_SETUP_SECRET from your environment variables.
                </p>
              </div>
              
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Creating Admin...' : 'Make Me Admin'}
              </button>
            </form>
            
            {status && (
              <div className={`mt-4 p-4 rounded ${
                status.includes('✅') 
                  ? 'bg-green-50 text-green-700' 
                  : status.includes('❌')
                  ? 'bg-red-50 text-red-700'
                  : 'bg-blue-50 text-blue-700'
              }`}>
                {status}
              </div>
            )}
          </>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Instructions:</h2>
          <ol className="text-sm text-gray-600 list-decimal pl-4 space-y-1">
            <li>Set <code className="bg-gray-100 px-1">ADMIN_SETUP_SECRET</code> in Coolify</li>
            <li>Sign up or log in with your account</li>
            <li>Enter the secret key above</li>
            <li>Click &quot;Make Me Admin&quot;</li>
            <li>Sign out and sign back in</li>
            <li>Remove ADMIN_SETUP_SECRET after setup</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
