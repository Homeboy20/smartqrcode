import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRestaurantAccess, type RestaurantStaffRole } from '@/lib/restaurant/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function normalizeRole(value: any): RestaurantStaffRole | null {
  if (value === 'manager' || value === 'kitchen' || value === 'waiter' || value === 'delivery') return value;
  return null;
}

export async function GET(request: Request) {
  try {
    const access = await getRestaurantAccess(request);

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const url = new URL(request.url);
    const assignableOnly = url.searchParams.get('assignable') === '1';

    const staffQuery = admin
      .from('restaurant_staff')
      .select('id, user_id, role, created_at')
      .eq('restaurant_id', access.restaurantId)
      .order('created_at', { ascending: false });

    let staff: any[] | null = null;
    let staffErr: any = null;

    // Managers/owners can see all staff, or only assignable staff when requested.
    if (access.canManageStaff) {
      const q = assignableOnly ? staffQuery.in('role', ['waiter', 'delivery']) : staffQuery;
      ({ data: staff, error: staffErr } = await q);
    } else if (access.staffRole === 'kitchen') {
      // Kitchen can see assignable staff list to assign orders.
      ({ data: staff, error: staffErr } = await staffQuery.in('role', ['waiter', 'delivery']));
    } else {
      // Default: only see own row.
      ({ data: staff, error: staffErr } = await staffQuery.eq('user_id', access.userId));
    }

    if (staffErr) return json(500, { error: staffErr.message });

    const userIds = Array.from(new Set((staff || []).map((s: any) => s.user_id).filter(Boolean)));

    const { data: users, error: usersErr } = userIds.length
      ? await admin
          .from('users')
          .select('id, email, display_name, photo_url')
          .in('id', userIds)
      : { data: [], error: null as any };

    if (usersErr) return json(500, { error: usersErr.message });

    const userById = new Map<string, any>();
    (users || []).forEach((u: any) => userById.set(u.id, u));

    const mapped = (staff || []).map((s: any) => {
      const u = userById.get(s.user_id) || null;
      return {
        id: s.id,
        userId: s.user_id,
        role: s.role,
        createdAt: s.created_at,
        email: u?.email || null,
        displayName: u?.display_name || null,
        photoUrl: u?.photo_url || null,
      };
    });

    return json(200, {
      restaurantId: access.restaurantId,
      isOwner: access.isOwner,
      myRole: access.staffRole,
      canManageStaff: access.canManageStaff,
      assignableOnly,
      staff: mapped,
    });
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

export async function POST(request: Request) {
  try {
    const access = await getRestaurantAccess(request);
    if (!access.canManageStaff) {
      return json(403, { error: 'Manager access required' });
    }

    const admin = createServerClient();
    if (!admin) return json(500, { error: 'Database not configured' });

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const displayName = String(body?.displayName || '').trim();
    const role = normalizeRole(body?.role);
    const password = typeof body?.password === 'string' ? body.password : '';
    const passwordTrimmed = password.trim();

    if (!email || !email.includes('@')) {
      return json(400, { error: 'Valid email is required' });
    }
    if (!role) {
      return json(400, { error: 'Valid role is required (manager|kitchen|waiter|delivery)' });
    }

    if (passwordTrimmed && passwordTrimmed.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters' });
    }

    // Only the owner can create/promote managers.
    if (role === 'manager' && !access.isOwner) {
      return json(403, { error: 'Only the restaurant owner can create managers' });
    }

    // Find existing user by email in public.users
    const { data: existingUser, error: existingErr } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingErr) return json(500, { error: existingErr.message });

    let userId: string | null = existingUser?.id || null;
    let invited = false;
    let createdWithPassword = false;

    if (!userId) {
      if (passwordTrimmed) {
        // Create a password-based user so they can sign in via /login immediately.
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: passwordTrimmed,
          email_confirm: true,
          user_metadata: {
            display_name: displayName || '',
          },
        });

        if (createErr || !created?.user?.id) {
          return json(500, { error: createErr?.message || 'Failed to create user' });
        }

        userId = created.user.id;
        createdWithPassword = true;
      } else {
        // Invite user (email link). They can set a password later.
        const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            display_name: displayName || '',
          },
        });

        if (inviteErr || !inviteData?.user?.id) {
          return json(500, { error: inviteErr?.message || 'Failed to invite user' });
        }

        userId = inviteData.user.id;
        invited = true;
      }
    }

    const { data: staffRow, error: staffErr } = await admin
      .from('restaurant_staff')
      .insert({
        restaurant_id: access.restaurantId,
        user_id: userId,
        role,
      })
      .select('id, user_id, role, created_at')
      .single();

    if (staffErr) {
      const msg = staffErr.message || 'Failed to create staff';
      if (/duplicate key|unique/i.test(msg)) {
        return json(409, { error: 'User is already staff for this restaurant' });
      }
      return json(500, { error: msg });
    }

    return json(200, {
      ok: true,
      invited,
      createdWithPassword,
      staff: {
        id: staffRow.id,
        userId: staffRow.user_id,
        role: staffRow.role,
        createdAt: staffRow.created_at,
        email,
      },
    });
  } catch (e: any) {
    const message = String(e?.message || 'Unauthorized');
    if (/unauthorized|invalid or expired token|no authentication token/i.test(message)) {
      return json(401, { error: message });
    }
    return json(500, { error: message });
  }
}
