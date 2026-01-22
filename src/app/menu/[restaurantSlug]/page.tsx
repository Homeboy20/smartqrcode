import { notFound, redirect } from 'next/navigation';

import { createAnonClient } from '@/lib/supabase/server';
import MenuClient from './MenuClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  accepted_payments: string[];
  enable_table_qr?: boolean;
};

type MenuItem = {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description: string | null;
  image_url?: string | null;
  price: string | number;
  available: boolean;
};

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: { restaurantSlug: string };
  searchParams?: { table?: string };
}) {
  const rawSlug = params.restaurantSlug;
  const slug = (rawSlug ? decodeURIComponent(rawSlug) : '').trim().toLowerCase();
  if (!slug) notFound();

  // Handle mixed-case or encoded scans by redirecting to canonical slug.
  if (rawSlug !== slug) {
    const tableParam = typeof searchParams?.table === 'string' ? searchParams.table.trim() : '';
    const qs = tableParam ? `?table=${encodeURIComponent(tableParam)}` : '';
    redirect(`/menu/${slug}${qs}`);
  }

  const supabase = createAnonClient();
  if (!supabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
          <div className="text-sm font-semibold text-gray-900">Menu unavailable</div>
          <p className="mt-2 text-sm text-gray-600">
            This menu can’t be loaded right now. The server is missing required configuration.
          </p>
        </div>
      </div>
    );
  }

  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('id,name,slug,whatsapp_number,accepted_payments,enable_table_qr')
    .eq('slug', slug)
    .maybeSingle();

  if (!restaurant) notFound();
  if (rErr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
          <div className="text-sm font-semibold text-gray-900">Menu unavailable</div>
          <p className="mt-2 text-sm text-gray-600">Please try again in a moment.</p>
        </div>
      </div>
    );
  }

  const { data: items, error: iErr } = await supabase
    .from('menu_items')
    .select('id,restaurant_id,category,name,description,image_url,price,available')
    .eq('restaurant_id', restaurant.id)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (iErr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
          <div className="text-sm font-semibold text-gray-900">Menu unavailable</div>
          <p className="mt-2 text-sm text-gray-600">We couldn’t load the menu items. Please try again.</p>
        </div>
      </div>
    );
  }

  const tableParam = typeof searchParams?.table === 'string' ? searchParams?.table : '';
  const table = restaurant?.enable_table_qr ? tableParam : '';

  return (
    <MenuClient
      restaurant={restaurant as Restaurant}
      items={(items || []) as MenuItem[]}
      table={table}
    />
  );
}
