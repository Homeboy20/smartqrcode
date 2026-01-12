import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFlutterwaveSignature } from '@/lib/webhook-verification';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { createErrorResponse, handleApiError, logError } from '@/lib/api-response';
import { getCredential } from '@/lib/credentials';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // Our integration attaches metadata in `meta`
    const meta = data?.meta || {};
    const userId = meta?.userId || meta?.user_id || null;
    const planId = normalizePlanId(meta?.planId || meta?.plan || null);

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

    if (!userId || !planId) {
      // We can't grant value without our metadata.
      logError(
        'flutterwave-webhook',
        new Error('Missing userId or planId in Flutterwave webhook metadata'),
        { reference, chargeId }
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const transactionId = String(chargeId || reference || '').trim();
    if (!transactionId) {
      logError('flutterwave-webhook', new Error('Missing transaction identifier'), { reference });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Idempotency: if we already recorded this transaction, acknowledge.
    const { data: existingTxn } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingTxn) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const now = new Date().toISOString();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // Update or create subscription for the user.
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
        .eq('id', existingSub.id);
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

    // Update user's subscription tier
    await supabaseAdmin
      .from('users')
      .update({ subscription_tier: planId, updated_at: now })
      .eq('id', userId);

    // Record transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      user_email: meta?.userEmail || meta?.user_email || data?.customer?.email || null,
      amount: Number(data?.amount || 0),
      currency: String(data?.currency || '').toUpperCase() || 'USD',
      status: 'completed',
      payment_gateway: 'flutterwave',
      payment_method: String(meta?.paymentMethod || data?.payment_method?.type || 'card'),
      plan: planId,
      transaction_id: transactionId,
      metadata: {
        reference,
        eventType,
        rawStatus: status,
        flutterwave: {
          chargeId,
        },
      },
      paid_at: now,
      created_at: now,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return handleApiError('flutterwave-webhook', error, { clientIP });
  }
}
