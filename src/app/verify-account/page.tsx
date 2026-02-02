'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getCountryCallingCodeOptions,
  findBestCountryMatchFromE164,
  findOptionByCountry,
} from '@/lib/phone/countryCallingCodes';
import { normalizeToE164 } from '@/lib/phone/e164';
import { toFriendlyFirebasePhoneAuthError } from '@/lib/phone/firebasePhoneErrors';

export default function VerifyAccountPage() {
  const {
    user: firebaseUser,
    loading: firebaseLoading,
    error,
    sendVerificationEmail,
    setupRecaptcha,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    getIdToken,
  } = useAuth();
  const {
    user: supabaseUser,
    loading: supabaseLoading,
    getAccessToken,
    refreshSession,
  } = useSupabaseAuth();
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('phone');
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [countryQuery, setCountryQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const canEmailVerify = Boolean(firebaseUser?.email);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/dashboard';
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const countryOptions = React.useMemo(() => getCountryCallingCodeOptions(), []);
  const selectedOption = React.useMemo(
    () => countryOptions.find((o) => o.country === selectedCountry) || countryOptions[0],
    [countryOptions, selectedCountry]
  );
  const filteredCountryOptions = React.useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countryOptions;

    const matches = countryOptions.filter((opt) => {
      const haystack = `${opt.name} ${opt.country} +${opt.callingCode}`.toLowerCase();
      return haystack.includes(q);
    });

    if (selectedOption && !matches.some((m) => m.country === selectedOption.country)) {
      return [selectedOption, ...matches];
    }

    return matches;
  }, [countryOptions, countryQuery, selectedOption]);

  // Default-select the user's country (best-effort) based on the same country detection used in pricing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pricing', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        const detected = (data as any)?.country as string | undefined;
        const opt = findOptionByCountry(detected);
        if (!cancelled && opt) setSelectedCountry(opt.country);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Check if user is already verified
  useEffect(() => {
    if (!supabaseLoading && supabaseUser) {
      const meta = (supabaseUser.user_metadata || {}) as any;
      const isVerified = Boolean(meta.phone_verified_at) || Boolean(meta.phone_number);
      
      if (isVerified) {
        router.push(redirectTo);
      }
    }
  }, [supabaseUser, supabaseLoading, router, redirectTo]);
  
  // Redirect to login if no user
  useEffect(() => {
    if (!supabaseLoading && !supabaseUser) {
      router.push(`/login?redirect=${encodeURIComponent(`/verify-account?redirect=${redirectTo}`)}`);
    }
  }, [supabaseUser, supabaseLoading, router, redirectTo]);
  
  const handleSendVerification = async () => {
    if (!isMountedRef.current) return;
    setSending(true);
    setStatusMessage('');
    
    try {
      if (verificationMethod === 'email') {
        if (!canEmailVerify) {
          if (isMountedRef.current) {
            setStatusMessage('Email verification is unavailable because this account has no email address. Please verify by phone instead.');
          }
          return;
        }
        // Send email verification
        const success = await sendVerificationEmail();
        if (success) {
          if (isMountedRef.current) {
            setVerificationSent(true);
            setStatusMessage('Verification email sent! Please check your inbox and click the verification link.');
          }
        } else {
          if (isMountedRef.current) {
            setStatusMessage('Failed to send verification email. Please try again.');
          }
        }
      } else {
        // Phone verification - first send code
        if (!phoneNumber) {
          if (isMountedRef.current) {
            setStatusMessage('Please enter a valid phone number');
            setSending(false);
          }
          return;
        }
        
        try {
          const { e164 } = normalizeToE164({ raw: phoneNumber, defaultCountry: selectedCountry });

          const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
          const confirmation = await sendPhoneVerificationCode(e164, recaptchaVerifier);
          if (isMountedRef.current) {
            setConfirmationResult(confirmation);
            setCodeSent(true);
            setStatusMessage('Verification code sent to your phone. Please enter it below.');
          }
        } catch (error: any) {
          console.error('Error sending phone verification:', error);
          if (isMountedRef.current) {
            setStatusMessage(`Error sending verification code: ${toFriendlyFirebasePhoneAuthError(error)}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending verification:', error);
      if (isMountedRef.current) {
        setStatusMessage(`Error: ${toFriendlyFirebasePhoneAuthError(error)}`);
      }
    } finally {
      if (isMountedRef.current) {
        setSending(false);
      }
    }
  };
  
  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmationResult) {
      if (isMountedRef.current) {
        setStatusMessage('Please enter the verification code');
      }
      return;
    }
    
    if (!isMountedRef.current) return;
    setVerifying(true);
    setStatusMessage('');
    
    try {
      const success = await verifyPhoneCode(confirmationResult, verificationCode);
      if (success) {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          if (isMountedRef.current) {
            setStatusMessage('Please sign in again to finish verification.');
          }
          return;
        }

        const firebaseToken = await getIdToken();
        if (!firebaseToken) {
          if (isMountedRef.current) {
            setStatusMessage('Missing Firebase token after verification. Please try again.');
          }
          return;
        }

        const res = await fetch('/api/account/verify-phone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ firebaseIdToken: firebaseToken }),
        });

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          throw new Error(String((data as any)?.error || 'Failed to sync phone verification'));
        }

        // Ensure the client immediately sees updated `user_metadata` (phone_verified_at).
        await refreshSession();

        if (isMountedRef.current) {
          setStatusMessage('Phone verified successfully!');
          setTimeout(() => {
            if (isMountedRef.current) {
              router.push(redirectTo);
            }
          }, 1200);
        }
      } else {
        if (isMountedRef.current) {
          setStatusMessage('Failed to verify phone. Please check the code and try again.');
        }
      }
    } catch (error: any) {
      console.error('Error verifying phone:', error);
      if (isMountedRef.current) {
        setStatusMessage(`Error: ${toFriendlyFirebasePhoneAuthError(error)}`);
      }
    } finally {
      if (isMountedRef.current) {
        setVerifying(false);
      }
    }
  };
  
  if (firebaseLoading || supabaseLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!supabaseUser) {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 py-10 px-4 sm:px-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
          <div className="text-center">
            <Link href="/" className="inline-flex items-center justify-center">
              <span className="text-lg font-semibold text-gray-900">ScanMagic</span>
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Verify your account</h1>
            <p className="mt-1 text-sm text-gray-600">Confirm your email or phone number to unlock all features.</p>
          </div>
      
      {error && (
        <div className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200" role="alert" aria-live="polite">
          {error}
        </div>
      )}
      
      {statusMessage && (
        <div
          className={`mt-6 rounded-md p-4 text-sm border ${statusMessage.includes('Error')
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-green-50 text-green-800 border-green-200'}`}
          role={statusMessage.includes('Error') ? 'alert' : 'status'}
          aria-live="polite"
        >
          {statusMessage}
        </div>
      )}
      
      <div className="mt-6">
        <div className="flex justify-center gap-3 mb-5">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              verificationMethod === 'email'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setVerificationMethod('email')}
            disabled={!canEmailVerify}
            aria-disabled={!canEmailVerify}
            title={canEmailVerify ? undefined : 'Email verification requires an email address on the account'}
          >
            Email Verification
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              verificationMethod === 'phone'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setVerificationMethod('phone')}
          >
            Phone Verification
          </button>
        </div>
        
        {verificationMethod === 'email' ? (
          <div className="space-y-4">
            {!canEmailVerify && (
              <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
                Email verification is unavailable because this account has no email address. Please verify by phone instead.
              </div>
            )}
            <p className="text-gray-600">
              We'll send a verification link to your email address. Click the link to verify your account.
            </p>
            
            {verificationSent ? (
              <div className="text-center">
                <p className="mb-3">Didn't receive the email?</p>
                <button
                  onClick={handleSendVerification}
                  disabled={sending || !canEmailVerify}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleSendVerification}
                disabled={sending || !canEmailVerify}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Verification Email'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div id="recaptcha-container" />
            {!codeSent ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    id="phoneCountrySearch"
                    type="text"
                    inputMode="search"
                    placeholder="Search country (e.g. Nigeria, NG, +234)"
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                  <select
                    id="phoneCountry"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {filteredCountryOptions.map((opt) => (
                      <option key={opt.country} value={opt.country}>
                        {opt.name} (+{opt.callingCode})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    id="phoneNumber"
                    placeholder={`8012345678 or +${selectedOption?.callingCode}...`}
                    value={phoneNumber}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPhoneNumber(next);
                      if (next.trim().startsWith('+')) {
                        const match = findBestCountryMatchFromE164(next.trim());
                        if (match) setSelectedCountry(match.country);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-sm text-gray-500">
                    Select your country and enter your number, or paste a full international number starting with +.
                  </p>
                </div>
                
                <button
                  id="phone-auth-button" // This ID is important for reCAPTCHA
                  onClick={handleSendVerification}
                  disabled={sending || !phoneNumber}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="verificationCode"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                
                <button
                  onClick={handleVerifyCode}
                  disabled={verifying || !verificationCode}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify Code'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-600">
        <p>
          Want to try a different method? You can verify using {' '}
          <button
            onClick={() => setVerificationMethod(verificationMethod === 'email' ? 'phone' : 'email')}
            className="text-indigo-600 hover:underline"
          >
            {verificationMethod === 'email' ? 'phone number' : 'email address'}
          </button>
          .
        </p>
        <p className="mt-2">
          <Link href="/dashboard" className="text-indigo-600 hover:underline">
            Skip for now
          </Link>
          {' '} (some features may be limited)
        </p>

        <p className="mt-6 text-xs text-gray-500">
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
      </div>
    </div>
  );
} 