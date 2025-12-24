import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase/admin';

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const dbInstance = db();
    const authInstance = auth();
    
    if (!dbInstance) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get users from Firestore
    const usersSnapshot = await dbInstance.collection('users').get();
    const users: Record<string, unknown>[] = [];

    usersSnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Optionally enhance with Firebase Auth data
    if (authInstance && users.length > 0) {
      for (const user of users) {
        try {
          const authUser = await authInstance.getUser(user.id as string);
          user.email = authUser.email;
          user.displayName = authUser.displayName;
          user.photoURL = authUser.photoURL;
          user.emailVerified = authUser.emailVerified;
          user.disabled = authUser.disabled;
          user.lastSignInTime = authUser.metadata.lastSignInTime;
          user.creationTime = authUser.metadata.creationTime;
        } catch {
          // User might not exist in Auth, skip
        }
      }
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    );
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName, role = 'user' } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const dbInstance = db();
    const authInstance = auth();
    
    if (!authInstance || !dbInstance) {
      return NextResponse.json(
        { error: 'Firebase Admin not configured' },
        { status: 500 }
      );
    }

    // Create user in Firebase Auth
    const userRecord = await authInstance.createUser({
      email,
      password,
      displayName,
    });

    // Set custom claims for role
    await authInstance.setCustomUserClaims(userRecord.uid, { role });

    // Create user document in Firestore
    await dbInstance.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
