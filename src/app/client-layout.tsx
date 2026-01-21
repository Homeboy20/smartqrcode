"use client";

import { useEffect, useState } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import dynamic from 'next/dynamic';
import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePathname } from 'next/navigation';

const FirebaseAuthProvider = dynamic(
  () => import('@/context/FirebaseAuthContext').then((mod) => mod.AuthProvider),
  { ssr: false }
);

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const { settings: appSettings } = useAppSettings();
  const isAdminPage = pathname?.startsWith('/admin');
  const needsFirebaseAuth =
    pathname?.startsWith('/phone-auth') ||
    pathname?.startsWith('/verify-account');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const faviconUrl = appSettings?.branding?.faviconUrl;
    if (!faviconUrl) return;

    const upsert = (rel: string) => {
      const existing = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (existing) {
        existing.href = faviconUrl;
        return;
      }
      const link = document.createElement('link');
      link.rel = rel;
      link.href = faviconUrl;
      document.head.appendChild(link);
    };

    upsert('icon');
    upsert('shortcut icon');
  }, [appSettings?.branding?.faviconUrl]);

  // For admin pages, just wrap with providers but don't add any layout elements
  if (isAdminPage) {
    return (
      <SupabaseAuthProvider>
        {children}
      </SupabaseAuthProvider>
    );
  }

  const page = needsFirebaseAuth ? <FirebaseAuthProvider>{children}</FirebaseAuthProvider> : children;

  // For regular pages, include header and footer
  return (
    <SupabaseAuthProvider>
      {isMounted ? (
        <>
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {page}
          </main>
          <Footer />
        </>
      ) : (
        <div className="flex-grow container mx-auto px-4 py-8">
          <div className="h-64 w-full bg-gray-200 rounded animate-pulse"></div>
        </div>
      )}
    </SupabaseAuthProvider>
  )
} 