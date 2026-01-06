import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/ensure-user
 * Creates a user record in the public.users table if it doesn't exist.
 * This is called by the client when an authenticated user doesn't have a users table entry.
 */
export async function POST() {
  try {
    const supabase = createServerClient();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Try to fetch existing user record
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: 'User record already exists',
        userId: user.id,
      });
    }

    // Create user record
    const { error: insertError } = await supabase
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
        { error: 'Failed to create user record: ' + insertError.message },
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
