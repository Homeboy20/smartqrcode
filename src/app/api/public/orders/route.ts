import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

type ItemInput = { id: string; qty: number };

type OrderType = 'delivery' | 'dine_in';

function normalizeOrderType(value: any): OrderType | null {
  return value === 'delivery' || value === 'dine_in' ? value : null;
}

function normalizeItems(value: any): ItemInput[] {
  if (!Array.isArray(value)) return [];
  const out: ItemInput[] = [];
  for (const row of value) {
    const id = String(row?.id || '').trim();
    const qty = Number(row?.qty);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    out.push({ id, qty: Math.min(Math.trunc(qty), 50) });
  }
  // combine duplicates
  const byId = new Map<string, number>();
  for (const r of out) byId.set(r.id, (byId.get(r.id) || 0) + r.qty);
  return Array.from(byId.entries()).map(([id, qty]) => ({ id, qty: Math.min(qty, 50) }));
}

export async function POST(request: Request) {
  try {
    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const body = await request.json().catch(() => ({}));

    const restaurantId = String(body?.restaurantId || '').trim();
    const orderType = normalizeOrderType(body?.orderType) || 'delivery';

    // Per request: WhatsApp ordering is ONLY for delivery.
    if (orderType !== 'delivery') {
      return json(400, { error: 'WhatsApp ordering is available for delivery orders only' });
    }

    const customerName = String(body?.customerName || '').trim();
    const customerPhone = String(body?.customerPhone || '').trim();
    const deliveryAddress = String(body?.deliveryAddress || '').trim();
    const deliveryNotes = String(body?.deliveryNotes || '').trim();

    const itemsIn = normalizeItems(body?.items);

    if (!restaurantId) return json(400, { error: 'restaurantId is required' });
    if (itemsIn.length === 0) return json(400, { error: 'At least one item is required' });
    if (itemsIn.length > 50) return json(400, { error: 'Too many distinct items' });

    if (!customerName && !customerPhone && !deliveryAddress) {
      return json(400, { error: 'Provide at least one of customer name, phone, or delivery address' });
    }

    // Ensure restaurant exists
    const { data: restaurant, error: rErr } = await admin
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .maybeSingle();

    if (rErr) return json(500, { error: rErr.message });
    if (!restaurant?.id) return json(404, { error: 'Restaurant not found' });

    // Pull authoritative prices/names from DB
    const itemIds = itemsIn.map((i) => i.id);
    const { data: menuItems, error: mErr } = await admin
      .from('menu_items')
      .select('id,name,price')
      .eq('restaurant_id', restaurantId)
      .in('id', itemIds);

    if (mErr) return json(500, { error: mErr.message });

    const byId = new Map<string, { id: string; name: string; price: number }>();
    for (const row of menuItems || []) {
      const price = Number((row as any).price);
      byId.set(String((row as any).id), {
        id: String((row as any).id),
        name: String((row as any).name || ''),
        price: Number.isFinite(price) ? price : 0,
      });
    }

    const lineItems: Array<{ id: string; name: string; qty: number; price: number; lineTotal: number }> = [];
    let total = 0;

    for (const input of itemsIn) {
      const item = byId.get(input.id);
      if (!item) return json(400, { error: 'One or more items are invalid' });
      const qty = Math.min(Math.max(1, input.qty), 50);
      const lineTotal = item.price * qty;
      total += lineTotal;
      lineItems.push({ id: item.id, name: item.name, qty, price: item.price, lineTotal });
    }

    const { data: created, error: cErr } = await admin
      .from('restaurant_orders')
      .insert({
        restaurant_id: restaurantId,
        status: 'placed',
        order_type: 'delivery',
        table_number: null,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        delivery_address: deliveryAddress || null,
        delivery_notes: deliveryNotes || null,
        items: lineItems,
        total,
        placed_via: 'menu',
      })
      .select('id, created_at')
      .single();

    if (cErr) return json(500, { error: cErr.message });

    // Best-effort notification for kitchen team (requires migration 12).
    try {
      await admin.from('restaurant_order_notifications').insert({
        restaurant_id: restaurantId,
        order_id: created.id,
        kind: 'status',
        target_role: 'kitchen',
        target_user_id: null,
        message: `New order placed: ${String(created.id).slice(0, 8)}`,
        created_by_user_id: null,
      });
    } catch {
      // ignore notification errors
    }

    return json(200, {
      ok: true,
      order: {
        id: created.id,
        createdAt: created.created_at,
      },
    });
  } catch (e: any) {
    return json(500, { error: String(e?.message || 'Failed to create order') });
  }
}
