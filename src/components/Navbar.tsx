"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/FirebaseAuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
// Removed unused Lucide icons
// import { Menu, X } from "lucide-react";

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'QR Modal', href: '/qr-modal-example' },
  { name: 'Login', href: '/login' },
  { name: 'Register', href: '/register' },
];

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const { settings: appSettings } = useAppSettings();

  const siteName = appSettings?.branding?.siteName || 'ScanMagic';
  const logoUrl = appSettings?.branding?.logoUrl || appSettings?.branding?.logoSvgUrl || '';
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Reset error state when logo URL changes
    setLogoError(false);
  }, [logoUrl]);
  
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const isActive = (path: string) => pathname === path;

  const toggleMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto flex items-center justify-between p-4 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="sr-only">{siteName}</span>
            {logoUrl && !logoError ? (
              <img 
                src={logoUrl} 
                alt={`${siteName} logo`} 
                className="h-8 w-auto object-contain" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <svg className="h-8 w-auto text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
              </svg>
            )}
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={toggleMenu}
          >
            <span className="sr-only">Open main menu</span>
            {!mobileMenuOpen ? (
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            ) : (
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href} className={`text-sm font-semibold leading-6 ${isActive(item.href) ? 'text-primary' : 'text-gray-700 hover:text-primary transition-colors'}`}>
              {item.name}
            </Link>
          ))}
        </div>
        <div className="hidden lg:flex lg:items-center lg:justify-end lg:flex-1">
          <Link 
            href="/pricing"
            className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md mr-4 transition-colors"
          >
            Upgrade
          </Link>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            {loading ? (
              <div className="h-5 w-5 border-t-2 border-primary rounded-full animate-spin"></div>
            ) : user ? (
              <div className="relative ml-3">
                <div>
                  <button
                    type="button"
                    className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    id="user-menu-button"
                    aria-expanded="false"
                    aria-haspopup="true"
                    onClick={toggleMenu}
                  >
                    <span className="sr-only">Open user menu</span>
                    {user && 'photoURL' in user && user.photoURL ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                </div>
                {mobileMenuOpen && (
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex={-1}
                  >
                    <Link href="/profile" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
                      role="menuitem">
                      Your Profile
                    </Link>
                    <Link href="/dashboard" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
                      role="menuitem">
                      Dashboard
                    </Link>
                    {user && 'role' in user && user.role === 'admin' && (
                      <Link href="/admin" 
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" 
                        role="menuitem">
                        Admin Panel
                      </Link>
                    )}
                    {user && 'role' in user && user.role === 'admin' && (
                      <Link href="/admin?public=true" 
                        className="block px-4 py-2 text-sm text-indigo-600 hover:bg-gray-100" 
                        role="menuitem">
                        Admin Panel (Public)
                      </Link>
                    )}
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                      role="menuitem"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link href="/login" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary bg-white hover:bg-gray-50">
                  Sign in
                </Link>
                <Link href="/signup" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark">
                  Sign up
                </Link>
              </div>
            )}
            <button onClick={toggleTheme} className="ml-4">
              {theme === "dark" ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </nav>
      {isClient && mobileMenuOpen && (
        <div className="lg:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 z-50" />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Link href="/" className="-m-1.5 p-1.5">
                <span className="sr-only">{siteName}</span>
                {logoUrl && !logoError ? (
                  <img 
                    src={logoUrl} 
                    alt={`${siteName} logo`} 
                    className="h-8 w-auto object-contain" 
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <svg className="h-8 w-auto text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                  </svg>
                )}
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
                onClick={toggleMenu}
              >
                <span className="sr-only">Close menu</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
                <div className="py-6">
                  <Link
                    href="/pricing"
                    className="block w-full text-center px-3 py-2.5 text-base font-semibold leading-7 text-white bg-green-600 hover:bg-green-700 rounded-lg mb-4"
                  >
                    Upgrade
                  </Link>
                  {user ? (
                    <div className="py-6 border-t border-gray-200">
                      <div className="flex items-center px-5">
                        <div className="flex-shrink-0">
                          {user && 'photoURL' in user && user.photoURL ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={user.photoURL}
                              alt="User"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                              {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-base font-medium text-gray-800">{user.displayName || 'User'}</div>
                          <div className="text-sm font-medium text-gray-500">{user.email}</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 px-2">
                        <Link
                          href="/profile"
                          className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-100"
                        >
                          Your Profile
                        </Link>
                        <Link
                          href="/dashboard"
                          className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-100"
                        >
                          Dashboard
                        </Link>
                        {user && 'role' in user && user.role === 'admin' && (
                          <Link
                            href="/admin"
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-900 hover:bg-gray-100"
                          >
                            Admin Panel
                          </Link>
                        )}
                        {user && 'role' in user && user.role === 'admin' && (
                          <Link
                            href="/admin?public=true"
                            className="block px-3 py-2 rounded-md text-base font-medium text-indigo-600 hover:bg-gray-100"
                          >
                            Admin Panel (Public)
                          </Link>
                        )}
                        <button
                          onClick={() => logout()}
                          className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-gray-100"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 px-5 border-t border-gray-200">
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <Link
                          href="/login"
                          className="text-center rounded-md border border-transparent bg-white py-2 px-4 text-base font-medium text-primary shadow-sm hover:bg-gray-50"
                        >
                          Sign in
                        </Link>
                        <Link
                          href="/signup"
                          className="text-center rounded-md border border-transparent bg-primary py-2 px-4 text-base font-medium text-white shadow-sm hover:bg-primary-dark"
                        >
                          Sign up
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
} 