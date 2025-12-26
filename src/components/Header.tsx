"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, loading, logout } = useSupabaseAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      // No need to redirect as the auth state change will trigger UI updates
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-white/90 backdrop-blur-md py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <Link href="/" className="flex items-center">
                <span className="text-xl font-bold text-gray-900">Smart<span className="text-indigo-600">QR</span></span>
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/#qrcode" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
              QR Code
            </Link>
            <Link href="/#barcode" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
              Barcode
            </Link>
            <Link href="/#bulk" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
              Bulk Generator
            </Link>
            <Link href="#features" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
              Features
            </Link>
            {user && (
              <Link href="/dashboard" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                Dashboard
              </Link>
            )}
            {user && 'role' in user && user.role === 'admin' && (
              <Link href="/admin?public=true" className="text-gray-700 hover:text-indigo-600 font-bold transition-colors border border-gray-500 px-3 py-1 rounded-md">
                Admin Panel (Public)
              </Link>
            )}
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {loading ? (
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center space-x-3">
                <span className="text-gray-700 font-medium text-sm">
                  {user.displayName || user.email}
                </span>
                <button 
                  onClick={handleLogout}
                  className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                  Sign Up
                </Link>
              </>
            )}
            
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 rounded-md text-gray-700"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-100">
            <nav className="flex flex-col space-y-3 mt-4">
              <Link href="/#qrcode" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors py-2" onClick={() => setIsMobileMenuOpen(false)}>
                QR Code
              </Link>
              <Link href="/#barcode" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors py-2" onClick={() => setIsMobileMenuOpen(false)}>
                Barcode
              </Link>
              <Link href="/#bulk" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors py-2" onClick={() => setIsMobileMenuOpen(false)}>
                Bulk Generator
              </Link>
              <Link href="#features" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors py-2" onClick={() => setIsMobileMenuOpen(false)}>
                Features
              </Link>
              {user && (
                <Link href="/dashboard" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors py-2" onClick={() => setIsMobileMenuOpen(false)}>
                  Dashboard
                </Link>
              )}
              {user && 'role' in user && user.role === 'admin' && (
                <Link href="/admin?public=true" className="text-gray-700 hover:text-indigo-600 font-bold transition-colors py-2 border-t border-gray-100 pt-3" onClick={() => setIsMobileMenuOpen(false)}>
                  Admin Panel (Public)
                </Link>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                {loading ? (
                  <div className="h-8 w-16 rounded-lg bg-gray-200 animate-pulse"></div>
                ) : user ? (
                  <div className="flex flex-col">
                    <span className="text-gray-700 font-medium text-sm">{user.displayName || user.email}</span>
                    <button
                      onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                      className="text-left text-red-600 hover:text-red-800 font-medium transition-colors text-sm mt-1"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-3">
                    <Link href="/login" className="text-gray-700 hover:text-indigo-600 font-medium transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Sign In</Link>
                    <Link href="/register" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm" onClick={() => setIsMobileMenuOpen(false)}>Sign Up</Link>
                  </div>
                )}
                <button
                  onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setIsMobileMenuOpen(false); }}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
} 