import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase/admin';

// GET - Get user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const dbInstance = db();
    if (!dbInstance) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get user document from Firestore
    const userDoc = await dbInstance.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      // Return default user data if document doesn't exist
      return NextResponse.json({ 
        id: userId,
        role: 'user',
        exists: false 
      });
    }

    const userData = userDoc.data();
    return NextResponse.json({ 
      id: userId,
      ...userData,
      exists: true 
    });
  } catch (error) {
    console.error('Error getting user:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}

// PATCH - Update user (including role)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { role, ...otherUpdates } = body;

    const dbInstance = db();
    const authInstance = auth();
    
    if (!dbInstance) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      ...otherUpdates,
      updatedAt: new Date().toISOString(),
    };

    // Only include role if explicitly provided
    if (role !== undefined) {
      updateData.role = role;
    }

    // Update or create the user document
    const userRef = dbInstance.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update(updateData);
    } else {
      // Create new document with default fields
      await userRef.set({
        ...updateData,
        createdAt: new Date().toISOString(),
        role: role || 'user',
      });
    }

    // If we have auth instance, set custom claims for role
    if (authInstance && role) {
      try {
        await authInstance.setCustomUserClaims(userId, { role });
      } catch (claimError) {
        console.warn('Could not set custom claims:', claimError);
        // Continue anyway - Firestore role is more important
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User updated successfully',
      role: role || updateData.role
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const dbInstance = db();
    const authInstance = auth();
    
    if (!dbInstance) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Delete user document from Firestore
    await dbInstance.collection('users').doc(userId).delete();

    // Also delete from Firebase Auth if available
    if (authInstance) {
      try {
        await authInstance.deleteUser(userId);
      } catch (authError) {
        console.warn('Could not delete user from Auth:', authError);
        // Continue anyway - Firestore deletion is more important
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
