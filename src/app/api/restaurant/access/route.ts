import { NextResponse } from 'next/server';
import { getRestaurantAccess } from '@/lib/restaurant/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await getRestaurantAccess(request);
    return NextResponse.json({ access }, { status: 200 });
  } catch (e: any) {
    const message = String(e?.message || 'Unauthorized');
    const status = /unauthorized|invalid or expired token|no authentication token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
