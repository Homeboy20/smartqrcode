import { NextRequest } from 'next/server';

export type DecodedIdToken = unknown;

/**
 * Get the authenticated user from the request
 * @param request The Next.js request object
 * @returns The decoded user token or null if not authenticated
 */
export async function getUserFromRequest(_request: NextRequest): Promise<DecodedIdToken | null> {
  // Disabled: legacy Firebase Admin auth; all new flows use Supabase SSR/cookie auth.
  return null;
}

/**
 * Extract token from Authorization header
 * @param authHeader The Authorization header value
 * @returns The token or null if not found/valid
 */
export function getTokenFromHeader(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    console.log('API Auth: Bearer token is empty');
    return null;
  }

  return token;
}

/**
 * Extract token from cookies
 * @param request The Next.js request object
 * @returns The token or null if not found
 */
export function getTokenFromCookie(request: NextRequest): string | null {
  try {
    const sessionCookie = request.cookies.get('session');
    const authCookie = request.cookies.get('firebase-auth-token');
    
    if (sessionCookie?.value) {
      return sessionCookie.value;
    }
    
    if (authCookie?.value) {
      return authCookie.value;
    }
    
    return null;
  } catch (error) {
    console.error('API Auth: Error extracting token from cookies:', error);
    return null;
  }
}

/**
 * Check if a user has a specific role
 * @param user The decoded user token
 * @param role The role to check for
 * @returns True if the user has the role, false otherwise
 */
export async function hasRole(_user: DecodedIdToken, _role: string): Promise<boolean> {
  return false;
}