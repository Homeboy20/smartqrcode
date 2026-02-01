import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  try {
    await verifyAdminAccess(request);

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const { data: staffRows, error: staffError } = await admin
      .from('restaurant_staff')
      .select('id, user_id, restaurant_id, role, created_at')
      .order('created_at', { ascending: false });

    if (staffError) return json(500, { error: staffError.message });

    const userIds = Array.from(new Set((staffRows || []).map((s: any) => s.user_id).filter(Boolean)));
    const restaurantIds = Array.from(new Set((staffRows || []).map((s: any) => s.restaurant_id).filter(Boolean)));

    const { data: users, error: usersError } = userIds.length
      ? await admin
          .from('users')
          .select('id, email, display_name, photo_url')
          .in('id', userIds)
      : { data: [], error: null as any };

    if (usersError) return json(500, { error: usersError.message });

    const { data: restaurants, error: restaurantsError } = restaurantIds.length
      ? await admin
          .from('restaurants')
          .select('id, name, slug')
          .in('id', restaurantIds)
      : { data: [], error: null as any };

    if (restaurantsError) return json(500, { error: restaurantsError.message });

    const userById = new Map<string, any>();
    (users || []).forEach((u: any) => userById.set(u.id, u));

    const restaurantById = new Map<string, any>();
    (restaurants || []).forEach((r: any) => restaurantById.set(r.id, r));

    const staff = (staffRows || []).map((row: any) => {
      const user = userById.get(row.user_id) || null;
      const restaurant = restaurantById.get(row.restaurant_id) || null;
      return {
        id: row.id,
        userId: row.user_id,
        role: row.role,
        restaurantId: row.restaurant_id,
        restaurantName: restaurant?.name || null,
        restaurantSlug: restaurant?.slug || null,
        createdAt: row.created_at,
        email: user?.email || null,
        displayName: user?.display_name || null,
        photoUrl: user?.photo_url || null,
      };
    });

    return json(200, { staff });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to load staff');
    if (/admin access required/i.test(message)) {
      return json(403, { error: 'Admin access required' });
    }
    if (/no authentication token|invalid or expired token/i.test(message)) {
      return json(401, { error: message });
    }
    return json(500, { error: message });
  }
}