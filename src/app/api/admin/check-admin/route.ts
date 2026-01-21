import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseAuth } from '@/lib/supabase/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Check if current user is admin
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ isAdmin: false, error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ isAdmin: false, error: 'Invalid token provided' }, { status: 401 });
    }

    const result = await verifySupabaseAuth(token);
    const isAdmin = result.isAdmin;

    return NextResponse.json({ 
      isAdmin, 
      userId: result.userId,
      role: isAdmin ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { isAdmin: false, error: 'Failed to verify admin status' },
      { status: 500 }
    );
  }
}
