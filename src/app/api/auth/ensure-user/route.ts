import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/ensure-user
 * Creates a user record in the public.users table if it doesn't exist.
 * This is called by the client when an authenticated user doesn't have a users table entry.
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice('bearer '.length).trim() : '';

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated (missing Bearer token)' },
        { status: 401 }
      );
    }

    // Validate the JWT and get the user.
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'Not authenticated (invalid or expired token)' },
        { status: 401 }
      );
    }

    const user = userData.user;

    // Prefer service role for DB operations; fall back to user-scoped anon client (requires RLS rules).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

    // Try to fetch existing user record
    const { data: existingUser, error: existingError } = await dbClient
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing user record:', existingError);
      return NextResponse.json(
        { error: 'Failed to check existing user record: ' + existingError.message },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: 'User record already exists',
        userId: user.id,
      });
    }

    // Create user record
    const { error: insertError } = await dbClient
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        role: 'user',
        subscription_tier: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error creating user record:', insertError);
      return NextResponse.json(
        {
          error:
            'Failed to create user record: ' +
            insertError.message +
            (serviceRoleKey
              ? ''
              : ' (Server is missing SUPABASE_SERVICE_ROLE_KEY and RLS may be blocking inserts)')
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User record created successfully',
      userId: user.id,
    });
  } catch (error) {
    console.error('Error in ensure-user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
