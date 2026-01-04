import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
      .order('start_date', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ subscriptions: subscriptions || [] }, { status: 200 });
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
