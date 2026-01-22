import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRestaurantAccess, type RestaurantStaffRole } from '@/lib/restaurant/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

const ALL_STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const;

type OrderStatus = (typeof ALL_STATUSES)[number];

type Role = RestaurantStaffRole;

function normalizeStatus(value: any): OrderStatus | null {
  return (ALL_STATUSES as readonly string[]).includes(String(value)) ? (String(value) as OrderStatus) : null;
}

function canSetStatus(role: Role | null, isOwner: boolean, next: OrderStatus): boolean {
  if (isOwner) return true;
  if (role === 'manager') return true;

  if (role === 'kitchen') {
    return next === 'accepted' || next === 'preparing' || next === 'ready' || next === 'cancelled';
  }

  if (role === 'waiter') {
    return next === 'served' || next === 'completed' || next === 'cancelled';
  }

  if (role === 'delivery') {
    return next === 'served' || next === 'completed' || next === 'cancelled';
  }

  return false;
}

function canAssign(role: Role | null, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role === 'manager' || role === 'kitchen';
}

function normalizeUuid(value: any): string | null {
  const v = String(value || '').trim();
  if (!v) return null;
  // Very lightweight UUID format check
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) return null;
  return v;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getRestaurantAccess(request);
    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const id = String(params?.id || '').trim();
    if (!id) return json(400, { error: 'Order id is required' });

    const { data: existingOrder, error: existingErr } = await admin
      .from('restaurant_orders')
      .select('id, status, order_type, assigned_to_user_id')
      .eq('id', id)
      .eq('restaurant_id', access.restaurantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingErr) return json(500, { error: existingErr.message });
    if (!existingOrder) return json(404, { error: 'Order not found' });

    const body = await request.json().catch(() => ({}));
    const nextStatus = normalizeStatus(body?.status);

    const assignedToUserIdRaw = body?.assignedToUserId;
    const assignedToUserId = assignedToUserIdRaw === null ? null : normalizeUuid(assignedToUserIdRaw);

    if (!nextStatus && assignedToUserIdRaw === undefined) {
      return json(400, { error: 'Provide status and/or assignedToUserId' });
    }

    if (nextStatus && !canSetStatus(access.staffRole, access.isOwner, nextStatus)) {
      return json(403, { error: 'Not allowed to set this status' });
    }

    if (assignedToUserIdRaw !== undefined) {
      if (!canAssign(access.staffRole, access.isOwner)) {
        return json(403, { error: 'Not allowed to assign orders' });
      }

      // Allow clearing assignment via null.
      if (assignedToUserId !== null) {
        // Validate assignee is staff within the same restaurant and has an assignable role.
        const { data: staffRow, error: staffErr } = await admin
          .from('restaurant_staff')
          .select('user_id, role')
          .eq('restaurant_id', access.restaurantId)
          .eq('user_id', assignedToUserId)
          .maybeSingle();

        if (staffErr) return json(500, { error: staffErr.message });
        if (!staffRow?.user_id) return json(400, { error: 'Assignee is not staff for this restaurant' });
        if (staffRow.role !== 'waiter' && staffRow.role !== 'delivery') {
          return json(400, { error: 'Assignee must be waiter or delivery' });
        }
      }
    }

    const update: Record<string, any> = {};
    if (nextStatus) update.status = nextStatus;
    if (assignedToUserIdRaw !== undefined) {
      update.assigned_to_user_id = assignedToUserId;
      update.assigned_by_user_id = access.userId;
      update.assigned_at = assignedToUserId ? new Date().toISOString() : null;
    }

    const { data: updated, error } = await admin
      .from('restaurant_orders')
      .update(update)
      .eq('id', id)
      .eq('restaurant_id', access.restaurantId)
      .is('deleted_at', null)
      .select('id, status, assigned_to_user_id, assigned_by_user_id, assigned_at, updated_at')
      .maybeSingle();

    if (error) return json(500, { error: error.message });
    if (!updated) return json(404, { error: 'Order not found' });

    // Fire-and-forget notification inserts (best-effort).
    try {
      const notifications: any[] = [];

      if (assignedToUserIdRaw !== undefined && assignedToUserId) {
        // Only emit when assignment changes.
        if (existingOrder.assigned_to_user_id !== assignedToUserId) {
          notifications.push({
            restaurant_id: access.restaurantId,
            order_id: updated.id,
            kind: 'assignment',
            target_user_id: assignedToUserId,
            target_role: null,
            message: `You were assigned order ${String(updated.id).slice(0, 8)}`,
            created_by_user_id: access.userId,
          });
        }
      }

      if (nextStatus === 'ready' && existingOrder.status !== 'ready') {
        const orderType = String(existingOrder.order_type || 'delivery');
        const targetRole = orderType === 'delivery' ? 'delivery' : 'waiter';
        const targetUserId = updated.assigned_to_user_id || null;

        notifications.push({
          restaurant_id: access.restaurantId,
          order_id: updated.id,
          kind: 'ready',
          target_user_id: targetUserId,
          target_role: targetUserId ? null : targetRole,
          message: `Order ${String(updated.id).slice(0, 8)} is READY`,
          created_by_user_id: access.userId,
        });
      }

      if (notifications.length) {
        await admin.from('restaurant_order_notifications').insert(notifications);
      }
    } catch {
      // ignore notification errors
    }

    return json(200, { ok: true, order: updated });
  } catch (e: any) {
    const message = String(e?.message || 'Unauthorized');
    if (/unauthorized|invalid or expired token|no authentication token/i.test(message)) {
      return json(401, { error: message });
    }
    return json(500, { error: message });
  }
}
