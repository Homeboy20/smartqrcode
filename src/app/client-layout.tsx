"use client";

import { useEffect, useState } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SubscriptionProvider } from "@/context/SubscriptionProvider";
import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';
import { usePathname } from 'next/navigation';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // For admin pages, just wrap with providers but don't add any layout elements
  if (isAdminPage) {
    return (
      <SupabaseAuthProvider>
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </SupabaseAuthProvider>
    );
  }

  // For regular pages, include header and footer
  return (
    <SupabaseAuthProvider>
      <SubscriptionProvider>
        {isMounted ? (
          <>
            <Header />
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            <Footer />
          </>
        ) : (
          <div className="flex-grow container mx-auto px-4 py-8">
            <div className="h-64 w-full bg-gray-200 rounded animate-pulse"></div>
          </div>
        )}
      </SubscriptionProvider>
    </SupabaseAuthProvider>
  )
} 