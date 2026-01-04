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

    // Fetch all transactions from Supabase
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ transactions: transactions || [] }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
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
      amount, 
      currency, 
      status, 
      paymentGateway, 
      paymentMethod,
      plan,
      transactionId,
      metadata 
    } = body;

    if (!userId || !amount || !status || !paymentGateway) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, amount, status, paymentGateway' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Create new transaction
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        user_email: userEmail || null,
        amount,
        currency: currency || 'USD',
        status,
        payment_gateway: paymentGateway,
        payment_method: paymentMethod || 'card',
        plan: plan || null,
        transaction_id: transactionId || `txn_${Date.now()}`,
        metadata: metadata || {},
        paid_at: (status === 'completed' || status === 'success') ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      { 
        success: true,
        transaction: data
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
