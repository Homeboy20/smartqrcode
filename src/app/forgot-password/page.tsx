'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword, loading, error: authError, clearError } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMountedRef.current) return;
    setError(null);
    setMessage(null);

    if (!email) {
      setError('Please enter your email');
      return;
    }

    try {
      setSubmitting(true);
      clearError();
      const ok = await resetPassword(email);
      if (!ok) {
        if (isMountedRef.current) {
          setError(authError || 'Failed to send reset email');
        }
        return;
      }
      if (isMountedRef.current) {
        setMessage('If an account exists for this email, a password reset link has been sent.');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to send reset email');
      }
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-900">ScanMagic</span>
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-600">Enter your email and we’ll send you a reset link.</p>
        </div>

        {message && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
            {message}
          </div>
        )}

        {(error || authError) && !message && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
            {error || authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="you@example.com"
              disabled={submitting || loading}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className="text-sm text-center">
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to sign in
          </Link>
        </div>

        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our{' '}
          <Link href="/terms&condition" className="font-medium text-gray-600 hover:text-gray-900">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacypolicy" className="font-medium text-gray-600 hover:text-gray-900">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
