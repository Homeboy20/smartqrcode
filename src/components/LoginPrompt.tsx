'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LoginPromptProps {
  feature: string;
  onClose?: () => void;
  inline?: boolean;
}

export default function LoginPrompt({ feature, onClose, inline = false }: LoginPromptProps) {
  const router = useRouter();

  if (inline) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h3>
          <p className="text-gray-600 mb-6 max-w-md">
            {feature} requires an account. Create a free account or login to access this feature.
          </p>
          
          <div className="flex gap-3">
            <Link 
              href="/register"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create Free Account
            </Link>
            <Link 
              href="/login"
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <div className="text-center">
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h3>
          <p className="text-gray-600 mb-6">
            {feature} requires an account. Create a free account or login to access this feature and save your work.
          </p>
          
          <div className="flex flex-col gap-3">
            <Link 
              href="/register"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create Free Account
            </Link>
            <Link 
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Login
            </Link>
          </div>
          
          <p className="mt-4 text-xs text-gray-500">
            Free accounts include basic features. Upgrade to Pro for advanced capabilities.
          </p>
        </div>
      </div>
    </div>
  );
}
