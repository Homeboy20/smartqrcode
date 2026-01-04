import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';

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
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authentication token provided');
  }

  const token = authHeader.split('Bearer ')[1];
  
  const authInstance = auth();
  if (!authInstance) {
    throw new Error('Firebase Admin not configured');
  }

  try {
    const decodedToken = await authInstance.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
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
