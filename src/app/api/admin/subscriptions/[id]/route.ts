import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAccess(request);

    const { id } = await params;

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAccess(request);

    const { id } = await params;

    const body = await request.json();
    const { plan, status, endDate, autoRenew, amount, currency, paymentMethod } = body;

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    if (endDate !== undefined) updateData.end_date = endDate;
    if (autoRenew !== undefined) updateData.auto_renew = autoRenew;
    if (amount !== undefined) updateData.amount = amount;
    if (currency !== undefined) updateData.currency = currency;
    if (paymentMethod !== undefined) updateData.payment_method = paymentMethod;

    const { error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { success: true, message: 'Subscription updated successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAccess(request);

    const { id } = await params;

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { success: true, message: 'Subscription deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
