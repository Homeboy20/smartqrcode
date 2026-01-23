import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRestaurantAccess } from '@/lib/restaurant/access';
import { requireFeatureAccess } from '@/lib/subscription/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  try {
    const access = await getRestaurantAccess(request);
    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const gate = await requireFeatureAccess(
      admin,
      access.userId,
      'restaurantTeam',
      'Team notifications require the Business plan (or Business paid trial).'
    );
    if (!gate.ok) return json(gate.status, { error: gate.error });

    const url = new URL(request.url);
    const since = url.searchParams.get('since');
    const limitRaw = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(100, Number(limitRaw || 50) || 50));

    let q = admin
      .from('restaurant_order_notifications')
      .select('id, restaurant_id, order_id, kind, target_role, target_user_id, message, created_by_user_id, created_at')
      .eq('restaurant_id', access.restaurantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Since this client uses the service role, we must apply the same visibility rules as RLS.
    // - Owner/manager/kitchen can view all notifications for the restaurant
    // - Other staff can view only broadcast + targeted to them (by user or role)
    if (!(access.isOwner || access.staffRole === 'manager' || access.staffRole === 'kitchen')) {
      const role = access.staffRole;
      q = q.or(
        role
          ? `and(target_user_id.is.null,target_role.is.null),target_user_id.eq.${access.userId},and(target_user_id.is.null,target_role.eq.${role})`
          : `and(target_user_id.is.null,target_role.is.null),target_user_id.eq.${access.userId}`
      );
    }

    if (since) {
      const sinceIso = String(since).trim();
      if (sinceIso) {
        q = q.gt('created_at', sinceIso);
      }
    }

    const { data, error } = await q;
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true, notifications: data || [] });
  } catch (e: any) {
    const message = String(e?.message || 'Unauthorized');
    if (/unauthorized|invalid or expired token|no authentication token/i.test(message)) {
      return json(401, { error: message });
    }
    if (/restaurant not found/i.test(message)) {
      return json(404, { error: message });
    }
    return json(500, { error: message });
  }
}
