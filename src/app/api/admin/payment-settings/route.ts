import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import {
  getAllPaymentSettingsForAdmin,
  saveProviderSettings,
  type PaymentProvider,
} from '@/lib/paymentSettingsStore';

// GET - Fetch all payment provider settings
export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const settings = await getAllPaymentSettingsForAdmin();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in GET payment settings:', error);
    if (error instanceof Error) {
      if (error.message.includes('token') || error.message.includes('authentication')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Admin access required')) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch payment settings' },
      { status: 500 }
    );
  }
}

// POST - Save payment provider settings
export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { provider, isActive, credentials } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    const validProviders: PaymentProvider[] = ['stripe', 'paypal', 'flutterwave', 'paystack'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    await saveProviderSettings({
      provider,
      isActive: Boolean(isActive),
      credentials: (credentials ?? null) as Record<string, unknown> | null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST payment settings:', error);
    return NextResponse.json(
      { error: 'Failed to save payment settings' },
      { status: 500 }
    );
  }
}
