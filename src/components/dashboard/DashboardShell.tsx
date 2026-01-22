'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white'
          : 'inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100'
      }
    >
      {label}
    </Link>
  );
}

export default function DashboardShell({
  title,
  subtitle,
  children,
  actions,
  navItems,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  navItems?: Array<{ href: string; label: string }>;
}) {
  const { user, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-28 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-96 bg-gray-200 animate-pulse rounded-lg mt-6" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          You need to be signed in to manage your restaurant menu.
        </p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(navItems || [
            { href: '/dashboard', label: 'Overview' },
            { href: '/dashboard/orders', label: 'Orders' },
            { href: '/dashboard/menu', label: 'Menu' },
            { href: '/dashboard/qr', label: 'QR' },
            { href: '/dashboard/staff', label: 'Staff' },
            { href: '/dashboard/settings', label: 'Settings' },
          ]).map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">{children}</div>
    </div>
  );
}
