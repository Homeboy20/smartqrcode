import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAccess } from '@/lib/supabase/auth';

export interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verify Firebase ID token from Authorization header
 * Returns userId if valid, throws error if invalid
 */
export async function verifyAuth(request: NextRequest): Promise<string> {
  const result = await verifyUserAccess(request);
  return result.userId;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Authentication required') {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Create error response
 */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}
