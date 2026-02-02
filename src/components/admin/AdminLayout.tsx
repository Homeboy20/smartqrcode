'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/context/SupabaseAuthContext';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const { user, loading, adminLoading, isAdmin, logout } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const isPublic = searchParams?.get('public') === 'true';
  const router = useRouter();
  const pathname = usePathname();
  const [showStuckHint, setShowStuckHint] = useState(false);
  const [initialAuthResolved, setInitialAuthResolved] = useState(false);

  useEffect(() => {
    if (!(loading || adminLoading)) {
      setShowStuckHint(false);
      setInitialAuthResolved(true);
      return;
    }
    const t = setTimeout(() => setShowStuckHint(true), 10_000);
    return () => clearTimeout(t);
  }, [loading, adminLoading]);

  useEffect(() => {
    // If public mode is enabled, bypass admin check
    if (isPublic || loading || adminLoading) {
      return;
    }

    // If not logged in, redirect to admin login
    if (!user) {
      // Don't redirect if already on the login page to avoid loops
      if (pathname && !pathname.startsWith('/admin/login') && !pathname.startsWith('/admin-login')) {
        router.push(`/admin-login?returnTo=${encodeURIComponent(pathname)}`);
      }
    }
  }, [user, loading, isPublic, router, pathname]);

  // Show loading state while checking auth
  if (!initialAuthResolved && (loading || adminLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 animate-spin text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <div>
              <div className="text-sm font-medium text-gray-900">Loading admin…</div>
              <div className="text-xs text-gray-600">Checking your session and permissions.</div>
            </div>
          </div>

          {showStuckHint && (
            <div className="mt-4 text-sm text-gray-700">
              <div className="mb-3">
                This is taking longer than expected. If you just switched tabs, your browser may have paused network activity.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If not logged in (and not public), we will redirect to login.
  // Avoid flashing "Access Denied" while the redirect happens.
  if (!user && !isPublic && !loading && !adminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="text-sm font-medium text-gray-900">Redirecting to login…</div>
          <div className="mt-1 text-xs text-gray-600">If this doesn’t happen automatically, use the button below.</div>
          <div className="mt-4">
            <Link
              href={`/admin-login?returnTo=${encodeURIComponent(pathname || '/admin')}`}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Go to Admin Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Allow access if user is admin or public access is enabled
  if (isAdmin || isPublic) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header at the top */}
        <AdminHeader />
        
        {isPublic && (
          <div className="bg-yellow-50 p-2 text-center text-yellow-800">
            <strong>Public Mode</strong> - This is a public view of the admin panel. Some actions may be restricted.
          </div>
        )}
        
        {/* Main content area with sidebar */}
        <div className="flex flex-1 h-[calc(100vh-4rem)]">
          {/* Sidebar - hidden on mobile, directly including the component */}
          <div className="hidden sm:block">
            <AdminSidebar />
          </div>
          
          {/* Main content - scrollable */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto relative">
            {(loading || adminLoading) && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-2 shadow-sm">
                  <svg
                    className="h-4 w-4 animate-spin text-indigo-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  <span className="text-xs text-gray-700">Refreshing session…</span>
                </div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    );
  }

  // If not admin and not public, show access denied
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You do not have permission to access the admin panel.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
          <div className="text-sm text-gray-700">
            If you believe this is a mistake (or you just switched tabs), try retrying the permission check.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Reload
            </button>
            <Link
              href={`/admin-login?returnTo=${encodeURIComponent(pathname || '/admin')}`}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Go to Admin Login
            </Link>
            {user && (
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SupabaseAuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SupabaseAuthProvider>
  );
} 