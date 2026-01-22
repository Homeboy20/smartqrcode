import { createServerClient } from '@/lib/supabase/server';
import { verifyUserAccess } from '@/lib/supabase/auth';

export type RestaurantStaffRole = 'manager' | 'kitchen' | 'waiter' | 'delivery';

export type RestaurantAccess = {
  userId: string;
  restaurantId: string;
  isOwner: boolean;
  staffRole: RestaurantStaffRole | null;
  canManageStaff: boolean;
};

export async function getRestaurantAccess(request: Request): Promise<RestaurantAccess> {
  const { userId } = await verifyUserAccess(request);

  const admin = createServerClient();
  if (!admin) {
    throw new Error('Database not configured');
  }

  // Owner access (restaurants.user_id)
  const { data: ownedRestaurant, error: ownedErr } = await admin
    .from('restaurants')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (ownedErr) {
    throw new Error(ownedErr.message);
  }

  if (ownedRestaurant?.id) {
    return {
      userId,
      restaurantId: ownedRestaurant.id,
      isOwner: true,
      staffRole: null,
      canManageStaff: true,
    };
  }

  // Staff access (restaurant_staff)
  const { data: staffRow, error: staffErr } = await admin
    .from('restaurant_staff')
    .select('restaurant_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffErr) {
    throw new Error(staffErr.message);
  }

  if (!staffRow?.restaurant_id) {
    throw new Error('Restaurant not found for user');
  }

  const staffRole = (staffRow.role || null) as RestaurantStaffRole | null;

  return {
    userId,
    restaurantId: staffRow.restaurant_id,
    isOwner: false,
    staffRole,
    canManageStaff: staffRole === 'manager',
  };
}
