import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard - Smart QR Code Generator',
  description: 'Admin panel for managing Smart QR Code Generator',
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
      <AdminLayout>{children}</AdminLayout>
    </div>
  );
} 