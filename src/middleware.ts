// Middleware is effectively disabled by using an empty matcher.
// We still export a no-op middleware function so Next.js can generate
// the expected middleware manifest in dev/prod builds.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};