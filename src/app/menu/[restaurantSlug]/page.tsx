import { notFound } from 'next/navigation';

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
};

type MenuItem = {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description: string | null;
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
  const slug = params.restaurantSlug;
  if (!slug) notFound();

  const supabase = createAnonClient();
  if (!supabase) {
    // Environment not configured
    notFound();
  }

  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('id,name,slug,whatsapp_number,accepted_payments')
    .eq('slug', slug)
    .maybeSingle();

  if (rErr || !restaurant) notFound();

  const { data: items, error: iErr } = await supabase
    .from('menu_items')
    .select('id,restaurant_id,category,name,description,price,available')
    .eq('restaurant_id', restaurant.id)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (iErr) notFound();

  const table = typeof searchParams?.table === 'string' ? searchParams?.table : '';

  return (
    <MenuClient
      restaurant={restaurant as Restaurant}
      items={(items || []) as MenuItem[]}
      table={table}
    />
  );
}
