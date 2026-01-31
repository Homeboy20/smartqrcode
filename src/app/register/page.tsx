"use client";

import React, { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const { user, signUp, signInWithGoogle, error: authError, loading: authChecking, clearError } = useSupabaseAuth();
  const { settings: appSettings } = useAppSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const intendedRedirect = searchParams?.get('redirect') || '/dashboard';
  const redirect = `/pricing?required=1&redirect=${encodeURIComponent(intendedRedirect)}`;
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const requiresPhoneVerification = Boolean(appSettings?.firebase?.phoneAuthEnabled);
  const isPhoneVerified = Boolean(
    (user as any)?.user_metadata?.phone_verified_at || (user as any)?.user_metadata?.phone_number
  );

  // Redirect if user is already logged in
  useEffect(() => {
    if (user && !authChecking) {
      if (requiresPhoneVerification && !isPhoneVerified) {
        router.push(`/verify-account?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      router.push(redirect);
    }
  }, [user, authChecking, router, redirect, requiresPhoneVerification, isPhoneVerified]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    // Client-side validation
    const errors: typeof fieldErrors = {};
    
    if (!displayName.trim()) {
      errors.displayName = 'Display name is required';
    }
    
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    setLoading(true);
    try {
      clearError();
      const success = await signUp(email, password, displayName);
      if (!success) {
        const errorMsg = authError || "Registration failed. Please try again.";
        setError(errorMsg);
        // Set field-specific errors if we can detect them
        if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('already')) {
          setFieldErrors({ email: 'This email is already registered' });
        }
        return;
      }
      // Supabase may require email confirmation, so we can't always redirect immediately.
      setSuccessMessage(
        requiresPhoneVerification
          ? 'Account created. If email confirmation is enabled, verify your email, then sign in to verify your phone.'
          : 'Account created. If email confirmation is enabled, check your inbox to verify, then sign in.'
      );
    } catch (err) {
      setError((err as Error).message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      clearError();
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
      const success = await signInWithGoogle({ redirectTo });
      if (!success) {
        setError(authError || 'Failed to sign up with Google. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign up with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-10 px-4 sm:px-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center justify-center">
              <span className="text-lg font-semibold text-gray-900">ScanMagic</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="mt-1 text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </Link>
              .
            </p>
          </div>

          {successMessage && (
            <div className="mt-6 rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200" role="status" aria-live="polite">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-md bg-red-50 p-4" role="alert" aria-live="polite">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (fieldErrors.displayName) {
                    setFieldErrors(prev => ({ ...prev, displayName: undefined }));
                  }
                }}
                disabled={loading}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 sm:text-sm ${
                  fieldErrors.displayName 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-indigo-500'
                }`}
                placeholder="Your name"
                aria-invalid={!!fieldErrors.displayName}
                aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
              />
              {fieldErrors.displayName && (
                <p id="displayName-error" className="mt-1 text-sm text-red-600">
                  {fieldErrors.displayName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors(prev => ({ ...prev, email: undefined }));
                  }
                }}
                disabled={loading}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 sm:text-sm ${
                  fieldErrors.email 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-indigo-500'
                }`}
                placeholder="you@example.com"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors(prev => ({ ...prev, password: undefined }));
                    }
                  }}
                  disabled={loading}
                  className={`block w-full pr-24 px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 sm:text-sm ${
                    fieldErrors.password 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-indigo-500'
                  }`}
                  placeholder="At least 6 characters"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-gray-600 hover:text-gray-900"
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {fieldErrors.password}
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Use at least 6 characters.</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors(prev => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  disabled={loading}
                  className={`block w-full pr-24 px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 sm:text-sm ${
                    fieldErrors.confirmPassword 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-indigo-500'
                  }`}
                  placeholder="Re-enter your password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-gray-600 hover:text-gray-900"
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p id="confirmPassword-error" className="mt-1 text-sm text-red-600">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={handleGoogleSignup}
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                  <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                    <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                    <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                    <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                    <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                  </g>
                </svg>
                Sign up with Google
              </button>

              <Link
                href={`/phone-auth?redirect=${encodeURIComponent(redirect)}`}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-disabled={loading}
              >
                Sign up with Phone (SMS)
              </Link>
            </div>

            <p className="mt-6 text-center text-xs text-gray-500">
              By creating an account, you agree to our{' '}
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
      </div>
    </div>
  );
} 