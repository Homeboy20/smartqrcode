import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyStripeSignature } from '@/lib/webhook-verification';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { createErrorResponse, handleApiError, logError } from '@/lib/api-response';
import { getCredential } from '@/lib/credentials';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This is important for webhook verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  try {
    // Basic request hygiene
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid content type', 415);
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      return createErrorResponse('VALIDATION_ERROR', 'Payload too large', 413);
    }

    // Rate limiting (best-effort). Webhook IPs vary, but this still blocks obvious abuse.
    const rateLimit = checkRateLimit(clientIP, RATE_LIMITS.WEBHOOK);
    if (!rateLimit.allowed) {
      return createErrorResponse('RATE_LIMIT_EXCEEDED', undefined, 429);
    }

    // Get the webhook signature from headers
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logError('stripe-webhook', new Error('Missing stripe-signature header'), { clientIP });
      return createErrorResponse('VALIDATION_ERROR', 'Missing signature', 400);
    }

    // Get webhook secret from credentials
    const webhookSecret = await getCredential('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      logError('stripe-webhook', new Error('Missing STRIPE_WEBHOOK_SECRET'), { clientIP });
      return createErrorResponse('INTERNAL_ERROR', 'Webhook secret not configured', 500);
    }

    // Get raw body for verification
    const body = await request.text();

    // Verify webhook signature
    const isValid = verifyStripeSignature(signature, body, webhookSecret);

    if (!isValid) {
      logError('stripe-webhook', new Error('Invalid webhook signature'), { clientIP });
      return createErrorResponse('AUTHORIZATION_ERROR', 'Invalid signature', 400);
    }

    // Parse the event
    let event: any;
    try {
      event = body ? JSON.parse(body) : null;
    } catch {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid JSON', 400);
    }

    const eventType = String(event?.type || '');
    if (!eventType) {
      return createErrorResponse('VALIDATION_ERROR', 'Missing event type', 400);
    }

    // Avoid logging full payloads (can contain PII/metadata)
    console.log('Received Stripe webhook event:', eventType);

    // Handle the event based on type
    switch (eventType) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        console.log('Checkout session completed:', session.id);
        
        // Extract metadata
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        
        if (!userId || !planId) {
          logError('stripe-webhook', new Error('Missing userId or planId in metadata'), { sessionId: session.id });
          return createErrorResponse('VALIDATION_ERROR', 'Missing metadata', 400);
        }

        const now = new Date().toISOString();
        
        // Calculate subscription end date (30 days for monthly)
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        
        // Create or update subscription record in Supabase
        const { data: existingSub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('stripe_subscription_id', session.subscription as string)
          .single();

        if (existingSub) {
          // Update existing subscription
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: endDate.toISOString(),
              updated_at: now
            })
            .eq('stripe_subscription_id', session.subscription as string);
        } else {
          // Create new subscription
          await supabaseAdmin
            .from('subscriptions')
            .insert({
              user_id: userId,
              plan: planId,
              status: 'active',
              stripe_subscription_id: session.subscription as string,
              stripe_customer_id: session.customer as string,
              current_period_start: now,
              current_period_end: endDate.toISOString(),
              created_at: now,
              updated_at: now,
            });
        }

        // Update user's subscription tier
        await supabaseAdmin
          .from('users')
          .update({
            subscription_tier: planId,
            updated_at: now
          })
          .eq('id', userId);

        // Create transaction record (idempotent best-effort)
        const paymentIntentId = String(session.payment_intent || '').trim();
        if (!paymentIntentId) {
          logError('stripe-webhook', new Error('Missing payment_intent'), { sessionId: session.id });
          return createErrorResponse('VALIDATION_ERROR', 'Missing payment_intent', 400);
        }

        const { data: existingTxn } = await supabaseAdmin
          .from('transactions')
          .select('id,status')
          .eq('transaction_id', paymentIntentId)
          .maybeSingle();

        if (!existingTxn) {
          await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            user_email: session.customer_email || null,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'completed',
            payment_gateway: 'stripe',
            payment_method: 'card',
            plan: planId,
            transaction_id: paymentIntentId,
            metadata: {
              eventId: event?.id || null,
              sessionId: session.id,
              customerId: session.customer,
              subscriptionId: session.subscription,
            },
            paid_at: now,
            created_at: now,
          });
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        console.log('Subscription updated:', subscription.id);
        
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        console.log('Subscription deleted:', subscription.id);
        
        // Mark subscription as canceled
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (sub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id);

          // Downgrade user to free tier
          await supabaseAdmin
            .from('users')
            .update({
              subscription_tier: 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.user_id);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        console.log('Payment failed for invoice:', invoice.id);
        
        // You might want to send an email notification here
        // or mark the subscription as past_due
        
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return handleApiError('stripe-webhook', error, { clientIP });
  }
}
