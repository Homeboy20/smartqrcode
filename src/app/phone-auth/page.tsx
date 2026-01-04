'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PhoneSignup from '@/components/auth/PhoneSignup';

export default function PhoneAuthPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in with Phone
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-indigo-600 hover:text-indigo-500">
              sign in with email
            </Link>
          </p>
        </div>
        
        <div className="mt-8">
          <PhoneSignup />
        </div>
        
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div>
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Email
              </Link>
            </div>
            <div>
              <Link
                href={`/register?redirect=${encodeURIComponent(redirect)}`}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Account Signup
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 