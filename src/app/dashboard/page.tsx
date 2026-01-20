"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import SubscriptionInfo from '@/components/SubscriptionInfo';
import { useSubscription } from '@/hooks/useSubscription';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const { subscriptionTier, loading } = useSubscription();

  useEffect(() => {
    // Backward compatibility: old links used /dashboard#generator.
    if (typeof window !== 'undefined' && window.location.hash === '#generator') {
      router.replace('/generator');
    }
  }, [router]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
        <p className="text-gray-600 mb-6">You need to be signed in to access your dashboard.</p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-8">
        <div className="h-32 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
          <div className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
          <div className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
        <div className="w-full md:w-1/3">
          <SubscriptionInfo />
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link 
                href="/generator#qrcode" 
                className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-md transition"
              >
                <span className="p-2 bg-blue-500 rounded-md mr-3">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                <span>Generate QR Code</span>
              </Link>
              
              <Link 
                href="/generator#barcode" 
                className="flex items-center p-3 bg-purple-50 hover:bg-purple-100 rounded-md transition"
              >
                <span className="p-2 bg-purple-500 rounded-md mr-3">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </span>
                <span>Generate Barcode</span>
              </Link>
              
              {subscriptionTier !== 'free' && (
                <Link 
                  href="/generator#bulk" 
                  className="flex items-center p-3 bg-green-50 hover:bg-green-100 rounded-md transition"
                >
                  <span className="p-2 bg-green-500 rounded-md mr-3">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z M9 17v-6 M12 17v-10 M15 17v-2" />
                    </svg>
                  </span>
                  <span>Bulk Generation</span>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        <div className="w-full md:w-2/3">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Recent Activity</h2>
              <Link href="/qrcode" className="text-blue-600 hover:text-blue-800 text-sm">
                View All
              </Link>
            </div>
            
            {/* Placeholder for recent activity - would be populated from backend */}
            <div className="border border-gray-200 rounded-md p-8 flex flex-col items-center justify-center">
              <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600">No recent activity to display</p>
              <Link href="/qrcode" className="mt-4 text-blue-600 hover:underline">
                Generate your first QR code
              </Link>
            </div>
          </div>
          
          {subscriptionTier !== 'free' && (
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Analytics Overview</h2>
              <div className="border border-gray-200 rounded-md p-8 flex flex-col items-center justify-center">
                <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-600">No analytics data available yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}