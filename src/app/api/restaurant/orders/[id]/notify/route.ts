import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRestaurantAccess } from '@/lib/restaurant/access';
import { requireFeatureAccess } from '@/lib/subscription/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function canNotify(role: string | null, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role === 'manager' || role === 'kitchen';
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getRestaurantAccess(request);
    if (!canNotify(access.staffRole, access.isOwner)) {
      return json(403, { error: 'Not allowed to notify team' });
    }

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const gate = await requireFeatureAccess(
      admin,
      access.userId,
      'restaurantTeam',
      'Team notifications require the Business plan (or Business paid trial).'
    );
    if (!gate.ok) return json(gate.status, { error: gate.error });

    const orderId = String(params?.id || '').trim();
    if (!orderId) return json(400, { error: 'Order id is required' });

    const { data: order, error: orderErr } = await admin
      .from('restaurant_orders')
      .select('id, order_type, assigned_to_user_id, status')
      .eq('id', orderId)
      .eq('restaurant_id', access.restaurantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (orderErr) return json(500, { error: orderErr.message });
    if (!order) return json(404, { error: 'Order not found' });

    const body = await request.json().catch(() => ({}));
    const message = String(body?.message || '').trim();

    const targetUserId = body?.targetUserId ? String(body.targetUserId).trim() : null;
    const targetRole = body?.targetRole ? String(body.targetRole).trim() : null;

    // Default targeting: assigned user, else role based on order type.
    const defaultTargetRole = order.order_type === 'delivery' ? 'delivery' : 'waiter';
    const finalTargetUserId = targetUserId || order.assigned_to_user_id || null;
    const finalTargetRole = finalTargetUserId ? null : targetRole || defaultTargetRole;

    const payload = {
      restaurant_id: access.restaurantId,
      order_id: order.id,
      kind: 'manual',
      target_role: finalTargetRole,
      target_user_id: finalTargetUserId,
      message: message || `Order ${String(order.id).slice(0, 8)} • ${order.status}`,
      created_by_user_id: access.userId,
    };

    const { data: inserted, error: insErr } = await admin
      .from('restaurant_order_notifications')
      .insert(payload)
      .select('id, created_at')
      .single();

    if (insErr) return json(500, { error: insErr.message });

    return json(200, { ok: true, notification: inserted });
  } catch (e: any) {
    const message = String(e?.message || 'Unauthorized');
    if (/unauthorized|invalid or expired token|no authentication token/i.test(message)) {
      return json(401, { error: message });
    }
    return json(500, { error: message });
  }
}
