import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRestaurantAccess } from '@/lib/restaurant/access';
import { requireFeatureAccess } from '@/lib/subscription/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

const ALL_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const;

type OrderStatus = (typeof ALL_STATUSES)[number];

function normalizeStatus(value: any): OrderStatus | null {
  return (ALL_STATUSES as readonly string[]).includes(String(value)) ? (String(value) as OrderStatus) : null;
}

export async function GET(request: Request) {
  try {
    const access = await getRestaurantAccess(request);

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const gate = await requireFeatureAccess(
      admin,
      access.userId,
      'restaurant',
      'Restaurant orders require a Pro or Business plan (or paid trial).'
    );
    if (!gate.ok) return json(gate.status, { error: gate.error });

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '50'), 1), 200);
    const status = normalizeStatus(url.searchParams.get('status'));

    let q = admin
      .from('restaurant_orders')
      .select('id, restaurant_id, status, order_type, table_number, customer_name, customer_phone, delivery_address, delivery_notes, items, total, placed_via, assigned_to_user_id, assigned_by_user_id, assigned_at, created_at, updated_at')
      .eq('restaurant_id', access.restaurantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return json(500, { error: error.message });

    return json(200, { orders: data || [], access });
  } catch (e: any) {
    const message = String(e?.message || 'Unauthorized');
    if (/unauthorized|invalid or expired token|no authentication token/i.test(message)) {
      return json(401, { error: message });
    }
    return json(500, { error: message });
  }
}
