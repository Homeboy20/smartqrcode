import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Create admin client to check auth.users table
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if phone number exists in auth.users
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error checking phone number:', error);
      return NextResponse.json(
        { error: 'Failed to check phone number' },
        { status: 500 }
      );
    }

    // Check if any user has this phone number
    const phoneExists = users?.users?.some(
      (user) => user.phone === phoneNumber
    );

    return NextResponse.json({ exists: !!phoneExists });
  } catch (error) {
    console.error('Phone check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
