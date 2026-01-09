'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getCountryCallingCodeOptions,
  findBestCountryMatchFromE164,
  findOptionByCountry,
} from '@/lib/phone/countryCallingCodes';
import { normalizeToE164 } from '@/lib/phone/e164';

export default function VerifyAccountPage() {
  const { user, loading, error, sendVerificationEmail, setupRecaptcha, sendPhoneVerificationCode, verifyPhoneCode } = useAuth();
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email');
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [countryQuery, setCountryQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const router = useRouter();

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
    if (!loading && user) {
      const isVerified = Boolean(user.emailVerified) || Boolean(user.phoneNumber);
      
      if (isVerified) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);
  
  // Redirect to login if no user
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  const handleSendVerification = async () => {
    setSending(true);
    setStatusMessage('');
    
    try {
      if (verificationMethod === 'email') {
        // Send email verification
        const success = await sendVerificationEmail();
        if (success) {
          setVerificationSent(true);
          setStatusMessage('Verification email sent! Please check your inbox and click the verification link.');
        } else {
          setStatusMessage('Failed to send verification email. Please try again.');
        }
      } else {
        // Phone verification - first send code
        if (!phoneNumber) {
          setStatusMessage('Please enter a valid phone number');
          setSending(false);
          return;
        }
        
        try {
          const { e164 } = normalizeToE164({ raw: phoneNumber, defaultCountry: selectedCountry });
          
          // Store the phone number in the window object for later use
          (window as any).phoneNumber = e164;

          const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
          const confirmation = await sendPhoneVerificationCode(e164, recaptchaVerifier);
          setConfirmationResult(confirmation);
          setCodeSent(true);
          setStatusMessage('Verification code sent to your phone. Please enter it below.');
        } catch (error: any) {
          console.error('Error sending phone verification:', error);
          setStatusMessage(`Error sending verification code: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error('Error sending verification:', error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };
  
  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmationResult) {
      setStatusMessage('Please enter the verification code');
      return;
    }
    
    setVerifying(true);
    setStatusMessage('');
    
    try {
      const success = await verifyPhoneCode(confirmationResult, verificationCode);
      if (success) {
        setStatusMessage('Phone verified successfully!');
        // Redirect to dashboard after successful verification
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setStatusMessage('Failed to verify phone. Please check the code and try again.');
      }
    } catch (error: any) {
      console.error('Error verifying phone:', error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setVerifying(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Verify Your Account</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {statusMessage && (
        <div className={`mb-4 p-3 rounded-md ${statusMessage.includes('Error') 
          ? 'bg-red-100 text-red-700' 
          : 'bg-green-100 text-green-700'}`}>
          {statusMessage}
        </div>
      )}
      
      <div className="mb-6">
        <div className="flex justify-center space-x-4 mb-4">
          <button
            className={`px-4 py-2 rounded-md transition ${
              verificationMethod === 'email'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setVerificationMethod('email')}
          >
            Email Verification
          </button>
          <button
            className={`px-4 py-2 rounded-md transition ${
              verificationMethod === 'phone'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setVerificationMethod('phone')}
          >
            Phone Verification
          </button>
        </div>
        
        {verificationMethod === 'email' ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              We'll send a verification link to your email address. Click the link to verify your account.
            </p>
            
            {verificationSent ? (
              <div className="text-center">
                <p className="mb-3">Didn't receive the email?</p>
                <button
                  onClick={handleSendVerification}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleSendVerification}
                disabled={sending}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <select
                    id="phoneCountry"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-500">
                    Select your country and enter your number, or paste a full international number starting with +.
                  </p>
                </div>
                
                <button
                  id="phone-auth-button" // This ID is important for reCAPTCHA
                  onClick={handleSendVerification}
                  disabled={sending || !phoneNumber}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <button
                  onClick={handleVerifyCode}
                  disabled={verifying || !verificationCode}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
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
            className="text-blue-500 hover:underline"
          >
            {verificationMethod === 'email' ? 'phone number' : 'email address'}
          </button>
          .
        </p>
        <p className="mt-2">
          <Link href="/dashboard" className="text-blue-500 hover:underline">
            Skip for now
          </Link>
          {' '} (some features may be limited)
        </p>
      </div>
    </div>
  );
} 