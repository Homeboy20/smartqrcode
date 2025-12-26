'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/context/SupabaseAuthContext';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const { user, loading } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const isPublic = searchParams?.get('public') === 'true';
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check admin status
    const checkAdminStatus = async () => {
      // If public mode is enabled, bypass admin check
      if (isPublic) {
        setCheckingAdmin(false);
        return;
      }

      if (!user) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        
        // Don't redirect if already on the login page to avoid loops
        if (pathname && !pathname.startsWith('/admin/login')) {
          // Redirect to admin login with current path as returnTo
          router.push(`/admin-login?returnTo=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      try {
        // Check if user has admin role
        if ('role' in user && user.role === 'admin') {
          setIsAdmin(true);
        } else {
          // Use the API to check admin status
          if ('getIdToken' in user) {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/admin/check-admin', {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });

            if (response.ok) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } else {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, isPublic, router, pathname]);

  // Show loading state while checking admin status
  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
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
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
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