"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  CHECKOUT_COUNTRY_OVERRIDE_KEY,
  clearGeoCurrencyCache,
  useGeoCurrencyInfo,
} from '@/hooks/useGeoCurrencyInfo';

const LOCATION_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'AUTO', label: 'Auto (detect)' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'GH', label: 'Ghana' },
  { code: 'KE', label: 'Kenya' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'UG', label: 'Uganda' },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading, logout, isAdmin } = useSupabaseAuth();
  const { settings: appSettings } = useAppSettings();
  const [geoEnabled, setGeoEnabled] = useState(false);

  const [countryOverride, setCountryOverride] = useState<string>('AUTO');

  const showPricingContext = useMemo(() => {
    const p = pathname || '';
    return p.startsWith('/pricing') || p.startsWith('/checkout');
  }, [pathname]);

  const showLocationOverride = showPricingContext || countryOverride !== 'AUTO';

  const { geo, countryName } = useGeoCurrencyInfo({ enabled: geoEnabled && showPricingContext });

  const siteName = appSettings?.branding?.siteName || 'ScanMagic';
  const logoUrl = appSettings?.branding?.logoSvgUrl || appSettings?.branding?.logoUrl || '';
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    // Reset error state when logo URL changes
    setLogoError(false);
  }, [logoUrl]);

  useEffect(() => {
    // Avoid doing geo/pricing work during initial paint.
    setGeoEnabled(true);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CHECKOUT_COUNTRY_OVERRIDE_KEY);
      const normalized = String(stored || '').trim().toUpperCase();
      setCountryOverride(/^[A-Z]{2}$/.test(normalized) ? normalized : 'AUTO');
    } catch {
      setCountryOverride('AUTO');
    }
  }, []);

  const applyCountryOverride = useCallback((next: string) => {
    const normalized = String(next || '').trim().toUpperCase();
    const value = normalized === 'AUTO' ? '' : normalized;
    try {
      if (!value) {
        window.localStorage.removeItem(CHECKOUT_COUNTRY_OVERRIDE_KEY);
      } else {
        window.localStorage.setItem(CHECKOUT_COUNTRY_OVERRIDE_KEY, value);
      }
    } catch {
      // ignore
    }

    clearGeoCurrencyCache();
    setCountryOverride(value || 'AUTO');

    // Refresh server components (pricing/checkout pages use server prefetch).
    router.refresh();
  }, [router]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const next = window.scrollY > 10;
        setIsScrolled((prev) => (prev === next ? prev : next));
        ticking = false;
      });
    };

    // Initialize once so the style matches current scroll position.
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Close mobile menu after navigation.
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [logout]);

  const navLinks = useMemo(() => {
    const createHref = user ? '/generator' : '/register/';
    return [
      { href: createHref, label: 'Create', icon: '✨' },
      { href: '/pricing/', label: 'Pricing', icon: '💎' },
      { href: '/about/', label: 'About', icon: 'ℹ️' },
    ];
  }, [user]);

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-lg py-2' 
        : 'bg-white py-3'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!!geo?.currency?.code && !!geo?.country && (
          <div className="hidden md:flex items-center justify-center pb-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-800 px-4 py-1 text-xs font-semibold border border-indigo-100">
              <span>
                Welcome{countryName ? `, ${countryName}` : ''}
              </span>
              <span className="text-indigo-400">•</span>
              <span>
                Prices in {geo.currency.code}
              </span>
              {geo.recommendedProvider && (
                <>
                  <span className="text-indigo-400">•</span>
                  <span className="capitalize">
                    Pay with {geo.recommendedProvider}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-between items-center">
          {/* Logo & Branding */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-lg group-hover:shadow-indigo-200 transition-shadow overflow-hidden">
              {logoUrl && !logoError ? (
                <img
                  src={logoUrl}
                  alt={`${siteName} logo`}
                  className="h-full w-full object-contain bg-white"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-900">{siteName}</span>
              <span className="text-xs text-gray-500 hidden sm:block">QR Code & Barcode Generator</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link 
                key={link.href}
                href={link.href} 
                className="px-4 py-2 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium transition-all"
              >
                {link.label}
              </Link>
            ))}
            {user && !isAdmin && (
              <Link 
                href="/dashboard/" 
                className="px-4 py-2 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium transition-all"
              >
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link 
                href="/admin/" 
                className="px-4 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-semibold transition-all flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
          </nav>

          {/* Location override (desktop) */}
          {showLocationOverride && (
          <div className="hidden md:flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500" htmlFor="country-override">
              Location
            </label>
            <select
              id="country-override"
              value={countryOverride}
              onChange={(e) => applyCountryOverride(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          )}

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {loading ? (
              <div className="h-10 w-24 rounded-lg bg-gray-100 animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {(user.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <span className="text-gray-700 font-medium text-sm max-w-[120px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 font-medium transition-all text-sm"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link 
                  href="/login/" 
                  className="px-4 py-2 text-gray-700 hover:text-indigo-600 font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  href="/register/" 
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
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
          <div className="md:hidden mt-4 pb-4 border-t border-gray-100 animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col space-y-1 mt-4">
              {/* Location override (mobile) */}
              {showLocationOverride && (
              <div className="px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 mb-2" htmlFor="country-override-mobile">
                  Location
                </label>
                <select
                  id="country-override-mobile"
                  value={countryOverride}
                  onChange={(e) => applyCountryOverride(e.target.value)}
                  className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {LOCATION_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href} 
                  className="flex items-center gap-3 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-all py-3 px-4 rounded-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              {user && !isAdmin && (
                <Link 
                  href="/dashboard/" 
                  className="flex items-center gap-3 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 font-medium transition-all py-3 px-4 rounded-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span>📊</span>
                  Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link 
                  href="/admin/" 
                  className="flex items-center gap-3 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold transition-all py-3 px-4 rounded-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span>⚙️</span>
                  Admin Panel
                </Link>
              )}
              
              {/* Mobile Auth Section */}
              <div className="pt-4 mt-2 border-t border-gray-100">
                {loading ? (
                  <div className="h-12 rounded-lg bg-gray-100 animate-pulse"></div>
                ) : user ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {(user.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                        <p className="text-xs text-gray-500">{isAdmin ? 'Admin account' : 'Signed in'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                      className="w-full text-center py-3 px-4 text-red-600 hover:bg-red-50 font-medium transition-all rounded-lg"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Link 
                      href="/login/" 
                      className="block text-center py-3 px-4 text-gray-700 hover:bg-gray-50 font-medium transition-all rounded-lg border border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link 
                      href="/register/" 
                      className="block text-center py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-md"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Create Account
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
} 