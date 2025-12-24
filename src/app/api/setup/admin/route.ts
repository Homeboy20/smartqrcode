import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';

// POST - Create initial admin user with secret key protection
// This endpoint is protected by ADMIN_SETUP_SECRET environment variable
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, setupSecret } = body;

    // Check if setup secret is configured
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Admin setup is not configured. Set ADMIN_SETUP_SECRET environment variable.' },
        { status: 503 }
      );
    }

    // Validate the setup secret
    if (!setupSecret || setupSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid setup secret' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const dbInstance = db();
    if (!dbInstance) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if any admin already exists
    const existingAdmins = await dbInstance
      .collection('users')
      .where('role', '==', 'admin')
      .limit(1)
      .get();

    if (!existingAdmins.empty) {
      return NextResponse.json(
        { error: 'An admin user already exists. Use the admin panel to create more admins.' },
        { status: 409 }
      );
    }

    // Create/update user as admin
    const userRef = dbInstance.collection('users').doc(userId);
    await userRef.set({
      role: 'admin',
      email: email || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isInitialAdmin: true,
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully. Please sign out and sign back in.',
      userId,
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}
