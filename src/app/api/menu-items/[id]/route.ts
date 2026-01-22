import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getRestaurantIdForUser(userId: string) {
  const supabase = createServerClient();
  if (!supabase) return { supabase: null as any, restaurantId: null as string | null, error: 'Database not configured' };

  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { supabase, restaurantId: null, error: error.message };
  return { supabase, restaurantId: data?.id || null, error: null as string | null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await verifyUserAccess(request);

    const body = await request.json().catch(() => null);

    const category = typeof body?.category === 'string' ? body.category.trim() : undefined;
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const description = typeof body?.description === 'string' ? body.description.trim() : undefined;
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : undefined;
    const available = body?.available === undefined ? undefined : Boolean(body.available);

    const priceRaw = body?.price;
    const price =
      priceRaw === undefined
        ? undefined
        : typeof priceRaw === 'number'
          ? priceRaw
          : typeof priceRaw === 'string'
            ? Number(priceRaw)
            : NaN;

    if (category !== undefined && !category) return badRequest('Category is required');
    if (name !== undefined && !name) return badRequest('Name is required');
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return badRequest('Price must be a valid number');
    if (imageUrl !== undefined && imageUrl && !/^https?:\/\//i.test(imageUrl)) return badRequest('Image URL must be a valid http(s) URL');

    const { supabase, restaurantId, error } = await getRestaurantIdForUser(userId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!restaurantId) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });

    const patch: Record<string, any> = {};
    if (category !== undefined) patch.category = category;
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description || null;
    if (imageUrl !== undefined) patch.image_url = imageUrl || null;
    if (price !== undefined) patch.price = price;
    if (available !== undefined) patch.available = available;

    const { data: updated, error: updateError } = await supabase
      .from('menu_items')
      .update(patch)
      .eq('id', params.id)
      .eq('restaurant_id', restaurantId)
      .select('id,restaurant_id,category,name,description,image_url,price,available,created_at,updated_at')
      .maybeSingle();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (error: any) {
    console.error('PATCH /api/menu-items/[id] error:', error);
    const message = error?.message || 'Failed to update item';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await verifyUserAccess(request);

    const { supabase, restaurantId, error } = await getRestaurantIdForUser(userId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!restaurantId) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });

    const { data: deleted, error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', params.id)
      .eq('restaurant_id', restaurantId)
      .select('id')
      .maybeSingle();

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    if (!deleted) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('DELETE /api/menu-items/[id] error:', error);
    const message = error?.message || 'Failed to delete item';
    const status = /token|auth|unauthorized|expired|bearer/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
