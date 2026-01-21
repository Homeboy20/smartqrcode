"use client";

import Link from 'next/link';

export default function BrandingSettings() {
  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900">Branding Settings</h2>
      <p className="mt-2 text-sm text-gray-600">This legacy page has been retired as part of the Supabase migration.</p>
      <p className="mt-3 text-sm text-gray-600">
        Manage branding from the admin panel:{' '}
        <Link href="/admin/settings" className="underline">
          /admin/settings
        </Link>
        .
      </p>
    </div>
  );
}