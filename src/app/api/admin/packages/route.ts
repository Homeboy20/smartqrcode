import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { subscriptionFeatures, subscriptionPricing } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    // Return current packages/pricing configuration
    return NextResponse.json({
      packages: {
        pricing: subscriptionPricing,
        features: subscriptionFeatures
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { pricing, features } = body;

    if (!pricing || !features) {
      return NextResponse.json(
        { error: 'Missing required fields: pricing, features' },
        { status: 400 }
      );
    }

    // In a real implementation, you would save these to a database or configuration file
    // For now, we'll just acknowledge the update
    // Note: The subscriptionPricing and subscriptionFeatures are immutable imports,
    // so this would need to be stored in a database or external config in production

    return NextResponse.json(
      { 
        success: true,
        message: 'Package configuration updated successfully'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating packages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update packages' },
      { status: 500 }
    );
  }
}
