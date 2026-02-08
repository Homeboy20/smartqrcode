import React, { Suspense } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard - ScanMagic',
  description: 'Admin panel for managing ScanMagic',
};

// For static export, we can't use force-dynamic
// Instead we'll handle dynamic content with client components

export default function AdminPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout will be nested inside the root layout
  return (
    // The actual admin UI will be rendered through AdminLayout
    <div className="w-full min-h-screen max-w-none p-0 m-0">
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <AdminLayout>{children}</AdminLayout>
      </Suspense>
    </div>
  );
} 