import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFlutterwaveSignature } from '@/lib/webhook-verification';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { createErrorResponse, handleApiError, logError } from '@/lib/api-response';
import { getCredential } from '@/lib/credentials';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave';
import { getLocalPrice, SUBSCRIPTION_PRICING, type CurrencyCode } from '@/lib/currency';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPaidTrialConfig(): { days: number; multiplier: number } {
  const daysRaw = Number(process.env.PAID_TRIAL_DAYS ?? 7);
  const multiplierRaw = Number(process.env.PAID_TRIAL_MULTIPLIER ?? 0.3);

  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(31, Math.floor(daysRaw))) : 7;
  const multiplier = Number.isFinite(multiplierRaw)
    ? Math.max(0.05, Math.min(1, multiplierRaw))
    : 0.3;

  return { days, multiplier };
}

function isSuccessfulStatus(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'successful' || s === 'succeeded' || s === 'success';
}

function normalizePlanId(planId: unknown): 'pro' | 'business' | null {
  const s = String(planId || '').toLowerCase();
  if (s === 'pro') return 'pro';
  if (s === 'business') return 'business';
  return null;
}

function normalizeBillingInterval(value: unknown): 'monthly' | 'yearly' | 'trial' {
  const s = String(value || '').toLowerCase().trim();
  if (s === 'yearly') return 'yearly';
  if (s === 'trial') return 'trial';
  return 'monthly';
}

function computePeriodEnd(interval: 'monthly' | 'yearly' | 'trial'): Date {
  const endDate = new Date();
  if (interval === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else if (interval === 'trial') {
    const { days } = getPaidTrialConfig();
    endDate.setDate(endDate.getDate() + days);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
}

function isUuid(value: unknown): boolean {
  const s = String(value || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function normalizeCurrencyCode(value: unknown): CurrencyCode | null {
  const s = String(value || '').toUpperCase().trim();
  // Allow broader currency support; pricing logic can still choose to fall back.
  if (/^[A-Z]{3}$/.test(s)) return s as CurrencyCode;
  return null;
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  try {
    const rateLimit = checkRateLimit(clientIP, RATE_LIMITS.WEBHOOK);
    if (!rateLimit.allowed) {
      return createErrorResponse('RATE_LIMIT_EXCEEDED', undefined, 429);
    }

    // Flutterwave docs: `flutterwave-signature` (preferred). Some older integrations use `verif-hash`.
    const signature =
      request.headers.get('flutterwave-signature') || request.headers.get('verif-hash');

    if (!signature) {
      logError('flutterwave-webhook', new Error('Missing Flutterwave signature header'), {
        clientIP,
      });
      return createErrorResponse('VALIDATION_ERROR', 'Missing signature', 400);
    }

    const secretHash =
      (await getCredential('FLW_SECRET_HASH')) ||
      (await getCredential('FLUTTERWAVE_WEBHOOK_SECRET_HASH')) ||
      (await getCredential('FLUTTERWAVE_SECRET_HASH')) ||
      '';

    if (!secretHash) {
      logError('flutterwave-webhook', new Error('Missing Flutterwave webhook secret hash'), {
        clientIP,
      });
      return createErrorResponse('INTERNAL_ERROR', 'Webhook secret not configured', 500);
    }

    const rawBody = await request.text();

    const isValid = verifyFlutterwaveSignature(signature, rawBody, secretHash);
    if (!isValid) {
      logError('flutterwave-webhook', new Error('Invalid webhook signature'), { clientIP });
      return createErrorResponse('AUTHORIZATION_ERROR', 'Invalid signature', 400);
    }

    const event = JSON.parse(rawBody);
    const eventType = (event?.type || event?.event || '').toString();

    // Payload shape per docs: { type, data, id, timestamp }
    const data = event?.data || {};

    // Common identifiers
    const chargeId = data?.id || null;
    const reference = data?.tx_ref || data?.reference || data?.txRef || null;
    const status = data?.status;

    console.log('Received Flutterwave webhook event:', eventType, {
      reference,
      chargeId,
      status,
    });

    // Only act on successful charge completion events.
    // We keep this permissive because Flutterwave event types can evolve.
    const looksLikeChargeCompletion =
      eventType === 'charge.completed' || eventType === 'charge.completed ' || eventType.startsWith('charge.');

    if (!looksLikeChargeCompletion) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!isSuccessfulStatus(status)) {
      // If payment is not successful, do nothing but acknowledge.
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Stronger guarantee: verify transaction with Flutterwave before granting access.
    // If we can't verify, acknowledge but do not grant value.
    if (!chargeId) {
      logError('flutterwave-webhook', new Error('Missing Flutterwave transaction id (data.id)'), {
        reference,
        eventType,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    let verified: Awaited<ReturnType<typeof verifyFlutterwaveTransaction>> | null = null;
    try {
      verified = await verifyFlutterwaveTransaction(String(chargeId));
    } catch (err) {
      logError('flutterwave-webhook', err, { reference, chargeId, eventType });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!verified?.success) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Prefer verified fields over webhook payload.
    const verifiedReference = verified.reference || reference;
    const meta = (verified.metadata || {}) as Record<string, any>;
    const userId = meta?.userId || meta?.user_id || null;
    const planId = normalizePlanId(meta?.planId || meta?.plan || null);
    const billingInterval = normalizeBillingInterval(meta?.billingInterval);

    if (!verifiedReference || String(verifiedReference).trim().length === 0) {
      logError('flutterwave-webhook', new Error('Missing tx_ref in verified transaction'), {
        chargeId,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!isUuid(userId)) {
      // Avoid granting access for unknown/guest ids.
      logError('flutterwave-webhook', new Error('Invalid or missing userId in verified transaction metadata'), {
        reference: verifiedReference,
        chargeId,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!planId) {
      // We can't grant value without our metadata.
      logError(
        'flutterwave-webhook',
        new Error('Missing userId or planId in Flutterwave webhook metadata'),
        { reference, chargeId }
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Use our tx_ref as the primary transaction identifier so we can update the
    // pending row created at checkout-session time.
    const transactionId = String(verifiedReference).trim();

    // Idempotency: if we already recorded this transaction, acknowledge if it's already finalized.
    // If it's a pending row (created at checkout-session time), we will finalize it below.
    const { data: existingTxn } = await supabaseAdmin
      .from('transactions')
      .select('id,status,metadata')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingTxn) {
      const existingStatus = String((existingTxn as any)?.status || '').toLowerCase();
      if (existingStatus === 'completed' || existingStatus === 'success') {
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }

    // Optional sanity check: verify amount matches our configured plan pricing.
    // If the app is using FX conversion (no explicit local price), we avoid enforcing
    // a strict match because rates can drift.
    try {
      const currency =
        normalizeCurrencyCode(meta?.currency || verified.currency || data?.currency) || 'USD';
      const YEARLY_MULTIPLIER = 10;
      const { multiplier: TRIAL_MULTIPLIER } = getPaidTrialConfig();
      const expected = getLocalPrice(planId, currency) *
        (billingInterval === 'yearly' ? YEARLY_MULTIPLIER : billingInterval === 'trial' ? TRIAL_MULTIPLIER : 1);
      const receivedAmount = Number(verified.amount || 0);
      const hasExplicitLocalPrice =
        currency === 'USD' ||
        Boolean((SUBSCRIPTION_PRICING as any)?.[planId]?.localPrices?.[currency]);

      if (hasExplicitLocalPrice && expected > 0 && Math.abs(receivedAmount - expected) > 0.01) {
        logError('flutterwave-webhook', new Error('Amount mismatch for verified transaction'), {
          transactionId,
          expected,
          receivedAmount,
          currency,
        });
        return NextResponse.json({ received: true }, { status: 200 });
      }
    } catch {
      // If pricing lookup fails for a currency, don't block; verification + signature still protect us.
    }

    const now = new Date().toISOString();
    const endDate = computePeriodEnd(billingInterval);
    const statusForSubscription = billingInterval === 'trial' ? 'trialing' : 'active';

    // Update or create subscription for the user.
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: statusForSubscription,
          plan: planId,
          current_period_end: endDate.toISOString(),
          updated_at: now,
        })
        .eq('id', existingSub.id);
    } else {
      await supabaseAdmin.from('subscriptions').insert({
        user_id: userId,
        plan: planId,
        status: statusForSubscription,
        current_period_start: now,
        current_period_end: endDate.toISOString(),
        cancel_at_period_end: false,
        created_at: now,
        updated_at: now,
      });
    }

    // Update user's subscription tier
    await supabaseAdmin
      .from('users')
      .update({ subscription_tier: planId, updated_at: now })
      .eq('id', userId);

    const transactionPayload = {
      user_id: userId,
      user_email: meta?.userEmail || meta?.user_email || data?.customer?.email || null,
      amount: Number(verified?.amount || data?.amount || 0),
      currency: String(verified?.currency || data?.currency || '').toUpperCase() || 'USD',
      status: 'completed',
      payment_gateway: 'flutterwave',
      payment_method: String(meta?.paymentMethod || data?.payment_method?.type || 'card'),
      plan: planId,
      transaction_id: transactionId,
      metadata: {
        ...(existingTxn as any)?.metadata,
        reference: verifiedReference,
        eventType,
        rawStatus: status,
        flutterwave: {
          chargeId,
        },
      },
      paid_at: now,
    };

    // Record transaction: update pending row if it exists, otherwise insert.
    if (existingTxn) {
      await supabaseAdmin.from('transactions').update(transactionPayload).eq('id', (existingTxn as any).id);
    } else {
      await supabaseAdmin.from('transactions').insert({
        ...transactionPayload,
        created_at: now,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return handleApiError('flutterwave-webhook', error, { clientIP });
  }
}
