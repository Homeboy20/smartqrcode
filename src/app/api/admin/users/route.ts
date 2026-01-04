import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id,email,display_name,photo_url,role,subscription_tier,created_at,updated_at,last_login')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const users = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name ?? null,
      photoURL: row.photo_url ?? null,
      role: row.role ?? 'user',
      subscriptionTier: row.subscription_tier ?? 'free',
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      lastLogin: row.last_login ?? null,
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    );
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { email, password, displayName, role = 'user', subscriptionTier = 'free' } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Create user in Supabase Auth
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || '',
      },
    });

    if (createError || !created?.user) {
      throw new Error(createError?.message || 'Failed to create user');
    }

    // Ensure public.users row exists and carries role/tier
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: created.user.id,
          email,
          display_name: displayName || null,
          role,
          subscription_tier: subscriptionTier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: created.user.id,
          email,
          displayName: displayName || null,
          role,
          subscriptionTier,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
