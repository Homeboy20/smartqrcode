import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
  });
}
