'use client';

import React from 'react';
import PaymentCredentialsForm from '@/components/admin/PaymentCredentialsForm';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function CredentialsPage() {
  const { user, loading, isAdmin } = useSupabaseAuth();
  const router = useRouter();
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login?redirect=/admin/credentials');
      return;
    }

    if (!isAdmin) {
      router.push('/');
      return;
    }

    setCheckingAdmin(false);
  }, [user, loading, isAdmin, router]);

  if (loading || checkingAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="ml-4">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">API Credentials Management</h1>
      <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              All credentials are securely encrypted before being stored. They cannot be viewed in plain text after saving.
            </p>
          </div>
        </div>
      </div>
      
      <PaymentCredentialsForm />
      
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4">
        <h2 className="font-medium text-gray-700 mb-2">How credential storage works</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
          <li>Credentials are encrypted using AES-256-CBC encryption</li>
          <li>Encrypted values are stored in Firestore, not in environment variables</li>
          <li>Application code retrieves and decrypts credentials as needed</li>
          <li>Access is restricted to admin users only</li>
          <li>All credential access is logged for security purposes</li>
        </ul>
      </div>
    </div>
  );
} 