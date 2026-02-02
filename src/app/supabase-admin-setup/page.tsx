'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function SupabaseAdminSetup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'register' | 'setup'>('register');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Step 1: Register/Sign in user with Supabase Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMountedRef.current) return;
    setStatus('loading');
    setMessage('');

    try {
      // Try to sign up first
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError && signUpError.message.includes('already registered')) {
        // User exists, try to sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (isMountedRef.current) {
            setStatus('error');
            setMessage('Sign in failed: ' + signInError.message);
          }
          return;
        }

        if (isMountedRef.current) {
          setMessage('Signed in successfully! Now enter the setup secret.');
          setStep('setup');
        }
      } else if (signUpError) {
        if (isMountedRef.current) {
          setStatus('error');
          setMessage('Registration failed: ' + signUpError.message);
        }
        return;
      } else {
        if (isMountedRef.current) {
          setMessage('Account created! Now enter the setup secret.');
          setStep('setup');
        }
      }

      if (isMountedRef.current) {
        setStatus('idle');
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setStatus('error');
        setMessage('Error: ' + error.message);
      }
    }
  };

  // Step 2: Set up admin with secret key
  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMountedRef.current) return;
    setStatus('loading');
    setMessage('');

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (isMountedRef.current) {
          setStatus('error');
          setMessage('You must be signed in to set up admin.');
        }
        return;
      }

      // Call the Supabase admin setup API
      const response = await fetch('/api/setup/admin-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          setupSecret,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (isMountedRef.current) {
          setStatus('error');
          setMessage(data.error || 'Failed to set up admin');
        }
        return;
      }

      if (isMountedRef.current) {
        setStatus('success');
        setMessage('🎉 Admin user created successfully! You can now access the admin panel.');
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setStatus('error');
        setMessage('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Supabase Admin Setup
        </h1>

        {step === 'register' && (
          <form onSubmit={handleAuth} className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">
              Step 1: Create an account or sign in with your email and password.
            </p>

            <div>
              <label htmlFor="supabaseAdminEmail" className="block text-gray-300 mb-2">Email</label>
              <input
                id="supabaseAdminEmail"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="supabaseAdminPassword" className="block text-gray-300 mb-2">Password</label>
              <input
                id="supabaseAdminPassword"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                placeholder="Your password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded font-medium transition-colors"
            >
              {status === 'loading' ? 'Processing...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'setup' && (
          <form onSubmit={handleAdminSetup} className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">
              Step 2: Enter the admin setup secret (from your server's ADMIN_SETUP_SECRET environment variable).
            </p>

            <div>
              <label htmlFor="supabaseAdminSetupSecret" className="block text-gray-300 mb-2">Setup Secret</label>
              <input
                id="supabaseAdminSetupSecret"
                name="setupSecret"
                type="password"
                autoComplete="off"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter setup secret"
                required
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded font-medium transition-colors"
            >
              {status === 'loading' ? 'Setting up...' : 'Create Admin User'}
            </button>

            <button
              type="button"
              onClick={() => setStep('register')}
              className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors"
            >
              Back
            </button>
          </form>
        )}

        {message && (
          <div
            className={`mt-4 p-4 rounded ${
              status === 'success'
                ? 'bg-green-900/50 text-green-300 border border-green-700'
                : status === 'error'
                ? 'bg-red-900/50 text-red-300 border border-red-700'
                : 'bg-blue-900/50 text-blue-300 border border-blue-700'
            }`}
          >
            {message}
          </div>
        )}

        {status === 'success' && (
          <div className="mt-4">
            <a
              href="/admin"
              className="block w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium text-center transition-colors"
            >
              Go to Admin Panel
            </a>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-white font-medium mb-2">Setup Instructions:</h3>
          <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
            <li>Set <code className="bg-gray-700 px-1 rounded">ADMIN_SETUP_SECRET</code> in Coolify</li>
            <li>Set <code className="bg-gray-700 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in Coolify</li>
            <li>Create a <code className="bg-gray-700 px-1 rounded">users</code> table in Supabase</li>
            <li>Enter your email/password above</li>
            <li>Enter the setup secret</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
