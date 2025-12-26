import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST - Create initial admin user with secret key protection
// This endpoint is protected by ADMIN_SETUP_SECRET environment variable
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, setupSecret } = body;

    // Check if setup secret is configured
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Admin setup is not configured. Set ADMIN_SETUP_SECRET environment variable.' },
        { status: 503 }
      );
    }

    // Validate the setup secret
    if (!setupSecret || setupSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid setup secret' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create Supabase server client
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured. Check Supabase environment variables.' },
        { status: 500 }
      );
    }

    // Check if any admin already exists
    const { data: existingAdmins, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (fetchError) {
      console.error('Error checking existing admins:', fetchError);
      return NextResponse.json(
        { error: 'Database error: ' + fetchError.message },
        { status: 500 }
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json(
        { error: 'An admin user already exists. Use the admin panel to create more admins.' },
        { status: 409 }
      );
    }

    // Create/update user as admin using upsert
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email || null,
        role: 'admin',
        is_initial_admin: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('Error creating admin:', upsertError);
      return NextResponse.json(
        { error: 'Failed to create admin user: ' + upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully. Please sign out and sign back in.',
      userId,
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}
