
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

import { useAuth } from '@/context/FirebaseAuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  getCountryCallingCodeOptions,
  findBestCountryMatchFromE164,
  findOptionByCountry,
} from '@/lib/phone/countryCallingCodes';
import { normalizeToE164 } from '@/lib/phone/e164';

type VerificationStep = 'inputPhone' | 'verifyCode';

export default function PhoneSignup() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';
  const { settings: appSettings, loading: settingsLoading } = useAppSettings();

  const {
    error: firebaseError,
    clearError,
    setupRecaptcha,
    sendPhoneVerificationCode,
    verifyPhoneCode,
    getIdToken,
    isFirebaseAvailable,
  } = useAuth();

  const [verificationStep, setVerificationStep] = useState<VerificationStep>('inputPhone');
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [countryQuery, setCountryQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  const toFriendlyFirebaseAuthError = (err: any): string => {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    const combined = `${code} ${message}`;

    if (combined.includes('auth/billing-not-enabled')) {
      return 'Phone sign-in is not available because billing is not enabled for this Firebase project. Ask the administrator to upgrade the Firebase project to the Blaze plan (Billing enabled) and try again.';
    }

    if (combined.includes('auth/too-many-requests')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }

    if (combined.includes('error-code:-39') || combined.includes('recaptcha')) {
      return 'reCAPTCHA verification failed. This usually means the reCAPTCHA site key is invalid or not properly configured for this domain. Ask the administrator to verify the reCAPTCHA configuration in Firebase Console (Authentication → Sign-in method → Phone → reCAPTCHA verifier).';
    }

    return String(err?.message || 'Something went wrong. Please try again.');
  };

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

    // Ensure the currently selected option remains selectable even if it doesn't match the filter.
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
  
  // Check if phone auth is properly configured
  const isPhoneAuthConfigured = 
    isFirebaseAvailable && 
    appSettings?.firebase?.enabled && 
    appSettings?.firebase?.phoneAuthEnabled &&
    appSettings?.firebase?.recaptchaSiteKey;
  
  // If Firebase or phone auth is not configured, show a message
  if (settingsLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-md">
        <div className="flex items-center">
          <svg className="animate-spin h-5 w-5 text-indigo-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-sm text-gray-600">Loading authentication settings...</p>
        </div>
      </div>
    );
  }
  
  if (!isPhoneAuthConfigured) {
    const missingConfig = [];
    if (!isFirebaseAvailable) missingConfig.push('Firebase not initialized');
    if (!appSettings?.firebase?.enabled) missingConfig.push('Firebase not enabled');
    if (!appSettings?.firebase?.phoneAuthEnabled) missingConfig.push('Phone authentication not enabled');
    if (!appSettings?.firebase?.recaptchaSiteKey) missingConfig.push('reCAPTCHA site key not configured');
    
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Phone Authentication Unavailable</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p className="mb-2">
                Phone authentication requires proper configuration.
              </p>
              {missingConfig.length > 0 && (
                <div className="bg-yellow-100 rounded p-2 mb-2">
                  <p className="font-semibold mb-1">Missing configuration:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    {missingConfig.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                Please use email authentication instead, or contact the administrator to enable Firebase phone authentication.
              </p>
            </div>
            <div className="mt-4">
              <a
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Sign in with Email
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setSuccessMessage(null);

    try {
      setLoading(true);

      const { e164 } = normalizeToE164({ raw: phoneNumber, defaultCountry: selectedCountry });

      const verifier =
        recaptchaVerifierRef.current || (await setupRecaptcha('recaptcha-container'));
      recaptchaVerifierRef.current = verifier;

      const confirmation = await sendPhoneVerificationCode(e164, verifier);
      confirmationResultRef.current = confirmation;

      setVerificationStep('verifyCode');
      setSuccessMessage('Verification code sent.');
    } catch (err: any) {
      setLocalError(toFriendlyFirebaseAuthError(err) || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setSuccessMessage(null);

    const confirmation = confirmationResultRef.current;
    if (!confirmation) {
      setLocalError('Please request a verification code first.');
      setVerificationStep('inputPhone');
      return;
    }

    try {
      setLoading(true);

      const ok = await verifyPhoneCode(
        confirmation,
        verificationCode,
        displayName.trim() ? displayName.trim() : undefined
      );
      if (!ok) return;

      const firebaseIdToken = await getIdToken();
      if (!firebaseIdToken) throw new Error('Missing Firebase ID token');

      const res = await fetch('/api/auth/firebase/sms-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({
          redirect,
          displayName: displayName.trim() ? displayName.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || 'Failed to exchange session');
      if (!(data as any)?.actionLink) throw new Error('Missing actionLink from server');

      window.location.href = (data as any).actionLink;
    } catch (err: any) {
      setLocalError(toFriendlyFirebaseAuthError(err) || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = localError || firebaseError;

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <span className="block sm:inline">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}

      {verificationStep === 'inputPhone' ? (
        <form className="space-y-6" onSubmit={handleSendCode}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="country" className="sr-only">
                Country
              </label>
              <input
                id="country-search"
                type="text"
                inputMode="search"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Search country (e.g. Nigeria, NG, +234)"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
              />
              <select
                id="country"
                name="country"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                {filteredCountryOptions.map((opt) => (
                  <option key={opt.country} value={opt.country}>
                    {opt.name} (+{opt.callingCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="phone-number" className="sr-only">
                Phone Number
              </label>
              <input
                id="phone-number"
                name="phone"
                type="tel"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={`Phone number (e.g. 8012345678 or +${selectedOption?.callingCode}...)`}
                value={phoneNumber}
                onChange={(e) => {
                  const next = e.target.value;
                  setPhoneNumber(next);
                  if (next.trim().startsWith('+')) {
                    const match = findBestCountryMatchFromE164(next.trim());
                    if (match) setSelectedCountry(match.country);
                  }
                }}
              />
            </div>
            <div>
              <label htmlFor="display-name" className="sr-only">
                Display Name (Optional)
              </label>
              <input
                id="display-name"
                name="displayName"
                type="text"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Display Name (Optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <p>
              Select your country and enter your number. You can also paste a full international number starting with +.
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !phoneNumber}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading || !phoneNumber
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </div>
        </form>
      ) : (
        <form className="space-y-6" onSubmit={handleVerifyCode}>
          <div className="rounded-md shadow-sm">
            <label htmlFor="verification-code" className="sr-only">
              Verification Code
            </label>
            <input
              id="verification-code"
              name="code"
              type="text"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter 6-digit verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
          </div>

          <div className="text-sm text-gray-500">
            <p>Enter the 6-digit code sent to your phone.</p>
          </div>

          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6}
            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
              loading || verificationCode.length !== 6
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setVerificationStep('inputPhone');
                setVerificationCode('');
                setSuccessMessage(null);
                setLocalError(null);
                clearError();
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              Use a different phone number
            </button>
          </div>
        </form>
      )}

      {/* Keep the container mounted so Firebase doesn't try to re-render into a new element */}
      <div id="recaptcha-container" />
    </div>
  );
}
