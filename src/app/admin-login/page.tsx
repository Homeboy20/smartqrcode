import { Suspense } from 'react';

import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AdminLoginClient />
    </Suspense>
  );
}