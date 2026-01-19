import { NextRequest, NextResponse } from 'next/server';

import { verifyUserAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';

import { verifyPaystackTransaction } from '@/lib/paystack';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave';
import { getLocalPrice, type CurrencyCode } from '@/lib/currency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConfirmBody =
  | { provider: 'paystack'; reference: string }
  | { provider: 'flutterwave'; reference: string; transactionId: string };

function normalizeCurrencyCode(value: unknown): CurrencyCode | null {
  const s = String(value || '').toUpperCase().trim();
  if (/^[A-Z]{3}$/.test(s)) return s as CurrencyCode;
  return null;
}

function normalizePlanId(planId: unknown): 'pro' | 'business' | null {
  const s = String(planId || '').toLowerCase().trim();
  if (s === 'pro') return 'pro';
  if (s === 'business') return 'business';
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await verifyUserAccess(request);

    const body = (await request.json().catch(() => null)) as ConfirmBody | null;
    const provider = (body as any)?.provider;

    const supabaseAdmin = createServerClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase server client is not configured' },
        { status: 500 }
      );
    }

    if (provider === 'paystack') {
      const reference = String((body as any)?.reference || '').trim();
      if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 });

      const verified = await verifyPaystackTransaction(reference);
      const status = String((verified as any)?.status || '').toLowerCase();
      if (status !== 'success') {
        return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
      }

      const meta = ((verified as any)?.metadata || {}) as any;
      if (String(meta?.userId || '').trim() !== userId) {
        return NextResponse.json({ error: 'Metadata user mismatch' }, { status: 403 });
      }

      const planId = normalizePlanId(meta?.planId);
      if (!planId) return NextResponse.json({ error: 'Missing plan metadata' }, { status: 400 });

      const now = new Date().toISOString();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const subscriptionCode =
        String((verified as any)?.subscription?.subscription_code || '') ||
        String((verified as any)?.subscription_code || '') ||
        reference;

      const customerCode = String((verified as any)?.customer?.customer_code || '');
      const authorizationCode = String((verified as any)?.authorization?.authorization_code || '');

      // Best-effort payment record.
      try {
        await supabaseAdmin
          .from('payments')
          .upsert(
            {
              user_id: userId,
              amount: Number((verified as any)?.amount) ? Number((verified as any)?.amount) / 100 : undefined,
              currency: String((verified as any)?.currency || 'NGN'),
              status: 'succeeded',
              paystack_reference: reference,
              paystack_transaction_id: String((verified as any)?.id || ''),
              description: `Subscription payment (${planId})`,
              created_at: now,
            } as any,
            { onConflict: 'paystack_reference' }
          );
      } catch {
        // ignore if table isn't provisioned
      }

      await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan: planId,
            status: 'active',
            paystack_subscription_code: subscriptionCode,
            paystack_customer_code: customerCode || null,
            paystack_authorization_code: authorizationCode || null,
            current_period_start: now,
            current_period_end: endDate.toISOString(),
            cancel_at_period_end: false,
            updated_at: now,
          } as any,
          { onConflict: 'paystack_subscription_code' }
        );

      await supabaseAdmin
        .from('users')
        .update({ subscription_tier: planId, updated_at: now })
        .eq('id', userId);

      await supabaseAdmin
        .from('transactions')
        .update({
          status: 'completed',
          user_email: email,
          metadata: {
            stage: 'confirmed_inline',
            provider: 'paystack',
            reference,
            verifiedAt: now,
          },
        } as any)
        .eq('transaction_id', reference);

      return NextResponse.json({ ok: true, provider: 'paystack', reference, planId, subscriptionCode });
    }

    if (provider === 'flutterwave') {
      const reference = String((body as any)?.reference || '').trim();
      const transactionId = String((body as any)?.transactionId || '').trim();
      if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
      if (!transactionId) return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 });

      const verified = await verifyFlutterwaveTransaction(transactionId);
      if (!verified?.success) {
        return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
      }

      const meta = (verified.metadata || {}) as any;
      if (String(meta?.userId || '').trim() !== userId) {
        return NextResponse.json({ error: 'Metadata user mismatch' }, { status: 403 });
      }

      const planId = normalizePlanId(meta?.planId);
      if (!planId) return NextResponse.json({ error: 'Missing plan metadata' }, { status: 400 });

      // Sanity check amount (best-effort).
      try {
        const currency = normalizeCurrencyCode(meta?.currency || verified.currency) || 'USD';
        const expected = getLocalPrice(planId, currency);
        const receivedAmount = Number(verified.amount || 0);
        if (expected > 0 && Math.abs(receivedAmount - expected) > 0.01) {
          return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
        }
      } catch {
        // ignore
      }

      const now = new Date().toISOString();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSub) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            plan: planId,
            current_period_end: endDate.toISOString(),
            updated_at: now,
          })
          .eq('id', (existingSub as any).id);
      } else {
        await supabaseAdmin.from('subscriptions').insert({
          user_id: userId,
          plan: planId,
          status: 'active',
          current_period_start: now,
          current_period_end: endDate.toISOString(),
          cancel_at_period_end: false,
          created_at: now,
          updated_at: now,
        });
      }

      await supabaseAdmin
        .from('users')
        .update({ subscription_tier: planId, updated_at: now })
        .eq('id', userId);

      await supabaseAdmin
        .from('transactions')
        .update({
          status: 'completed',
          user_email: email,
          metadata: {
            stage: 'confirmed_inline',
            provider: 'flutterwave',
            reference,
            flwRef: transactionId,
            verifiedAt: now,
          },
        } as any)
        .eq('transaction_id', reference);

      return NextResponse.json({ ok: true, provider: 'flutterwave', reference, planId, transactionId });
    }

    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to confirm payment');
    const status = message.toLowerCase().includes('authentication') || message.toLowerCase().includes('token') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
