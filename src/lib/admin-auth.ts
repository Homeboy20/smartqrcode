import { NextRequest } from 'next/server';

export type DecodedIdToken = unknown;

/**
 * Utility to check if a request is from an admin user
 * @param request NextRequest object
 * @returns DecodedIdToken if admin, null otherwise
 */
export async function checkAdminAuth(_request: NextRequest): Promise<DecodedIdToken | null> {
  // Disabled: legacy Firebase Admin auth; all admin flows use Supabase now.
  return null;
}

/**
 * Alternative admin check that gets the token from a cookie
 * @param request NextRequest object
 * @returns DecodedIdToken if admin, null otherwise
 */
export async function checkAdminAuthFromCookie(_request: NextRequest): Promise<DecodedIdToken | null> {
  return null;
}