import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - Get user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id,email,display_name,photo_url,role,subscription_tier,created_at,updated_at,last_login')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = {
      id: data.id,
      email: data.email,
      displayName: (data as any).display_name ?? null,
      photoURL: (data as any).photo_url ?? null,
      role: (data as any).role ?? 'user',
      subscriptionTier: (data as any).subscription_tier ?? 'free',
      createdAt: (data as any).created_at ?? null,
      updatedAt: (data as any).updated_at ?? null,
      lastLogin: (data as any).last_login ?? null,
    };

    // Return both shapes for backward compatibility
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Error getting user:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}

// PATCH - Update user (including role)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const role = body?.role;
    const subscriptionTier = body?.subscriptionTier;
    const displayName = body?.displayName;
    const email = body?.email;

    // Update auth email if requested.
    if (typeof email === 'string' && email.trim()) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
        email: email.trim(),
      });
      if (authUpdateError) {
        throw new Error(authUpdateError.message);
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (role !== undefined) updates.role = role;
    if (subscriptionTier !== undefined) updates.subscription_tier = subscriptionTier;
    if (displayName !== undefined) updates.display_name = displayName;
    if (email !== undefined) updates.email = email;

    const { data: updatedRow, error: updateError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          ...updates,
        },
        { onConflict: 'id' }
      )
      .select('id,email,display_name,photo_url,role,subscription_tier,created_at,updated_at,last_login')
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'User updated successfully',
        user: {
          id: updatedRow.id,
          email: updatedRow.email,
          displayName: (updatedRow as any).display_name ?? null,
          photoURL: (updatedRow as any).photo_url ?? null,
          role: (updatedRow as any).role ?? 'user',
          subscriptionTier: (updatedRow as any).subscription_tier ?? 'free',
          createdAt: (updatedRow as any).created_at ?? null,
          updatedAt: (updatedRow as any).updated_at ?? null,
          lastLogin: (updatedRow as any).last_login ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Delete from Auth first
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw new Error(authDeleteError.message);
    }

    // Then delete from public.users
    const { error: dbDeleteError } = await supabase.from('users').delete().eq('id', userId);
    if (dbDeleteError) {
      throw new Error(dbDeleteError.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'User deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
