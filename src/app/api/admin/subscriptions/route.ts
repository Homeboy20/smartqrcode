import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type BillingInterval = 'monthly' | 'yearly' | 'unknown';

function parseDate(value: any): Date | null {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

function computeBillingIntervalFromDates(start: any, end: any): BillingInterval {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return 'unknown';
  const days = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(days) || days <= 0) return 'unknown';
  // Heuristic: yearly subscriptions are ~365 days, monthly ~30 days.
  return days >= 300 ? 'yearly' : 'monthly';
}

function mapSubscriptionRow(row: any) {
  const start = row?.current_period_start ?? row?.start_date ?? row?.startDate ?? row?.startDate;
  const end = row?.current_period_end ?? row?.end_date ?? row?.endDate ?? row?.endDate;

  const billingInterval: BillingInterval =
    (row?.billing_interval as BillingInterval) ||
    (row?.billingInterval as BillingInterval) ||
    computeBillingIntervalFromDates(start, end);

  const cancelAtPeriodEnd = row?.cancel_at_period_end;

  return {
    id: String(row?.id || ''),
    userId: String(row?.user_id || row?.userId || ''),
    userEmail: row?.user_email || row?.userEmail || null,
    plan: String(row?.plan || ''),
    status: (row?.status || 'inactive') as any,
    startDate: start || null,
    endDate: end || null,
    autoRenew:
      typeof cancelAtPeriodEnd === 'boolean'
        ? !cancelAtPeriodEnd
        : Boolean(row?.auto_renew ?? row?.autoRenew ?? true),
    amount: Number(row?.amount ?? 0),
    currency: String(row?.currency || 'USD'),
    paymentMethod: String(row?.payment_method || row?.paymentMethod || ''),
    lastPaymentDate: row?.last_payment_date ?? row?.lastPaymentDate ?? null,
    nextBillingDate:
      row?.current_period_end ?? row?.next_billing_date ?? row?.nextBillingDate ?? null,
    billingInterval,
  };
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Fetch all subscriptions from Supabase
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = (subscriptions || []).map(mapSubscriptionRow);
    return NextResponse.json({ subscriptions: mapped }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyAdminAccess(request);

    const body = await request.json();
    const { 
      userId, 
      userEmail,
      plan, 
      status, 
      startDate, 
      endDate, 
      autoRenew, 
      amount, 
      currency, 
      paymentMethod 
    } = body;

    if (!userId || !plan || !status || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, plan, status, amount' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Create new subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        user_email: userEmail || null,
        plan,
        status,
        start_date: startDate || new Date().toISOString(),
        end_date: endDate || null,
        auto_renew: autoRenew !== undefined ? autoRenew : true,
        amount,
        currency: currency || 'USD',
        payment_method: paymentMethod || 'card'
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { 
        success: true,
        subscription: data
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
