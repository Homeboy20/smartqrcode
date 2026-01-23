import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { requireFeatureAccess } from '@/lib/subscription/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MenuItemRow = {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description: string | null;
  image_url?: string | null;
  price: string | number;
  available: boolean;
  created_at: string;
  updated_at: string;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getRestaurantIdForUser(userId: string) {
  const supabase = createServerClient();
  if (!supabase) return { supabase: null as any, restaurantId: null as string | null, error: 'Database not configured' };

  const gate = await requireFeatureAccess(
    supabase,
    userId,
    'restaurant',
    'Restaurant features require a Pro or Business plan (or paid trial).'
  );
  if (!gate.ok) return { supabase, restaurantId: null as string | null, error: gate.error };

  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { supabase, restaurantId: null, error: error.message };
  return { supabase, restaurantId: data?.id || null, error: null as string | null };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const { supabase, restaurantId, error } = await getRestaurantIdForUser(userId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!restaurantId) return NextResponse.json({ items: [] });

    const { data, error: itemsError } = await supabase
      .from('menu_items')
      .select('id,restaurant_id,category,name,description,image_url,price,available,created_at,updated_at')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

    return NextResponse.json({ items: (data || []) as MenuItemRow[] });
  } catch (error: any) {
    const message = error?.message || 'Unauthorized';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyUserAccess(request);

    const body = await request.json().catch(() => null);

    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : null;
    const priceRaw = body?.price;
    const available = body?.available === undefined ? true : Boolean(body.available);

    const price = typeof priceRaw === 'number' ? priceRaw : typeof priceRaw === 'string' ? Number(priceRaw) : NaN;

    if (!category) return badRequest('Category is required');
    if (!name) return badRequest('Name is required');
    if (!Number.isFinite(price) || price < 0) return badRequest('Price must be a valid number');
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return badRequest('Image URL must be a valid http(s) URL');

    const { supabase, restaurantId, error } = await getRestaurantIdForUser(userId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!restaurantId) return NextResponse.json({ error: 'Please complete restaurant onboarding first' }, { status: 409 });

    const { data: created, error: createError } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        category,
        name,
        description: description || null,
        image_url: imageUrl || null,
        price,
        available,
      })
      .select('id,restaurant_id,category,name,description,image_url,price,available,created_at,updated_at')
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message || 'Failed to create item' }, { status: 500 });
    }

    return NextResponse.json({ item: created as MenuItemRow }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/menu-items error:', error);
    const message = error?.message || 'Failed to create item';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
