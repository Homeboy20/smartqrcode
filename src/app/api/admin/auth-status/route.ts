import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseAuth } from '@/lib/supabase/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authentication token provided' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const result = await verifySupabaseAuth(token);

    return NextResponse.json(
      {
        userId: result.userId,
        email: result.email,
        isAdmin: result.isAdmin,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to verify admin status';
    const status = message.includes('token') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
