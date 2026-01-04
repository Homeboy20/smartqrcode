import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { reencryptAllPaymentSettingsSecrets } from '@/lib/paymentSettingsStore';

export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const result = await reencryptAllPaymentSettingsSecrets();

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error migrating payment settings encryption:', error);
    if (error instanceof Error) {
      if (error.message.includes('token') || error.message.includes('authentication')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Admin access required')) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
