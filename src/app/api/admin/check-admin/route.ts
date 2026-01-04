import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase/admin';

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

    const token = authHeader.split('Bearer ')[1];
    
    const authInstance = auth();
    const dbInstance = db();
    
    if (!authInstance || !dbInstance) {
      return NextResponse.json({ isAdmin: false, error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Verify the token
    const decodedToken = await authInstance.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Check user role in Firestore
    const userDoc = await dbInstance.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ isAdmin: false, userId: uid });
    }

    const userData = userDoc.data();
    const isAdmin = userData?.role === 'admin';

    return NextResponse.json({ 
      isAdmin, 
      userId: uid,
      role: userData?.role || 'user'
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { isAdmin: false, error: 'Failed to verify admin status' },
      { status: 500 }
    );
  }
}
