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

    // Fetch analytics data from Supabase
    const [
      { data: users, count: totalUsers },
      { data: qrCodes, count: totalQrCodes },
      { data: subscriptions },
      { data: transactions }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact' }),
      supabase.from('qrcodes').select('*', { count: 'exact' }),
      supabase.from('subscriptions').select('*'),
      supabase.from('transactions').select('*')
    ]);

    // Calculate total scans
    const totalScans = (qrCodes || []).reduce((total, qr) => {
      return total + (qr.scans || 0);
    }, 0);

    // Count active subscriptions
    const activeSubscriptions = (subscriptions || []).filter(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    ).length;

    // Calculate total revenue from completed transactions
    const totalRevenue = (transactions || [])
      .filter(txn => txn.status === 'completed' || txn.status === 'success')
      .reduce((total, txn) => total + (txn.amount || 0), 0);

    // Get user growth data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usersByDay: { [key: string]: number } = {};
    (users || []).forEach(user => {
      const createdAt = new Date(user.created_at);
      if (createdAt >= thirtyDaysAgo) {
        const dateKey = createdAt.toISOString().split('T')[0];
        usersByDay[dateKey] = (usersByDay[dateKey] || 0) + 1;
      }
    });

    // Get QR code scans data (last 30 days)
    const scansByDay: { [key: string]: number } = {};
    (qrCodes || []).forEach(qr => {
      if (qr.updated_at) {
        const lastScan = new Date(qr.updated_at);
        if (lastScan >= thirtyDaysAgo) {
          const dateKey = lastScan.toISOString().split('T')[0];
          scansByDay[dateKey] = (scansByDay[dateKey] || 0) + (qr.scans || 0);
        }
      }
    });

    // Get platform distribution (mock data for now)
    const platformDistribution = {
      labels: ['iOS', 'Android', 'Windows', 'Mac', 'Other'],
      data: [35, 30, 15, 12, 8]
    };

    // Get subscription revenue by plan
    const revenueByPlan: { [key: string]: number } = {};
    (subscriptions || []).forEach(sub => {
      const plan = sub.plan || 'free';
      const amount = sub.amount || 0;
      revenueByPlan[plan] = (revenueByPlan[plan] || 0) + amount;
    });

    // Get recent users (last 10)
    const recentUsers = (users || [])
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
      .map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.name || '',
        createdAt: user.created_at
      }));

    // Get recent transactions (last 10)
    const recentTransactions = (transactions || [])
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 10)
      .map(txn => ({
        id: txn.id,
        amount: txn.amount,
        currency: txn.currency || 'USD',
        status: txn.status,
        createdAt: txn.created_at
      }));

    return NextResponse.json({
      summary: {
        totalUsers: totalUsers || 0,
        totalQrCodes: totalQrCodes || 0,
        totalScans,
        activeSubscriptions,
        totalRevenue: `$${totalRevenue.toFixed(2)}`
      },
      userGrowth: {
        labels: Object.keys(usersByDay).sort(),
        data: Object.keys(usersByDay).sort().map(key => usersByDay[key])
      },
      qrCodeScans: {
        labels: Object.keys(scansByDay).sort(),
        data: Object.keys(scansByDay).sort().map(key => scansByDay[key])
      },
      platformDistribution,
      subscriptionRevenue: {
        labels: Object.keys(revenueByPlan),
        data: Object.values(revenueByPlan)
      },
      recentUsers,
      recentTransactions
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
