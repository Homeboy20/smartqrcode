'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function AdminHeader() {
  const pathname = usePathname();
  const { user, logout } = useSupabaseAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Get the current path for returnTo parameter
  const returnToPath = pathname || '/admin';
  
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              type="button"
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            
            {/* Logo/Brand */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/admin" className="text-xl font-bold text-indigo-600 ml-2 sm:ml-0">
                Smart QR Admin
              </Link>
            </div>
          </div>
          
          {/* User profile and actions */}
          <div className="flex items-center">
            {user ? (
              <div className="flex items-center">
                <span className="text-sm text-gray-700 mr-4 hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={() => logout()}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link 
                href={`/admin-login?returnTo=${encodeURIComponent(returnToPath)}`}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile menu - shown only when toggled */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200 pt-2 pb-3">
          <div className="space-y-1 px-4">
            <Link 
              href="/admin" 
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname === '/admin' 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              href="/admin/users" 
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname?.startsWith('/admin/users') 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Users
            </Link>
            <Link 
              href="/admin/transactions" 
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname?.startsWith('/admin/transactions') 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Transactions
            </Link>
            <Link 
              href="/admin/settings" 
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname?.startsWith('/admin/settings') 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Settings
            </Link>
            <Link 
              href="/" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              Back to Main Site
            </Link>
          </div>
        </div>
      )}
    </header>
  );
} 