import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPaystackSignature } from '@/lib/webhook-verification';
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

function getPaidTrialConfig(): { days: number } {
  const daysRaw = Number(process.env.PAID_TRIAL_DAYS ?? 7);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(31, Math.floor(daysRaw))) : 7;
  return { days };
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

async function verifyTransactionWithPaystack(secretKey: string, reference: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    const text = await res.text();
    const parsed = (() => {
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    })();

    if (!res.ok || parsed?.status === false) {
      const message = parsed?.message || (text ? text.slice(0, 500) : `HTTP ${res.status}`);
      throw new Error(message || 'Paystack verification failed');
    }

    return parsed?.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  try {
    // Rate limiting
    const rateLimit = checkRateLimit(clientIP, RATE_LIMITS.WEBHOOK);
    if (!rateLimit.allowed) {
      return createErrorResponse('RATE_LIMIT_EXCEEDED', undefined, 429);
    }

    // Get the webhook signature from headers
    const signature = request.headers.get('x-paystack-signature');
    
    if (!signature) {
      logError('paystack-webhook', new Error('Missing x-paystack-signature header'), { clientIP });
      return createErrorResponse('VALIDATION_ERROR', 'Missing signature', 400);
    }

    // Get webhook secret from credentials
    const webhookSecret = await getCredential('PAYSTACK_SECRET_KEY');
    
    if (!webhookSecret) {
      logError('paystack-webhook', new Error('Missing PAYSTACK_SECRET_KEY'), { clientIP });
      return createErrorResponse('INTERNAL_ERROR', 'Webhook secret not configured', 500);
    }

    // Get raw body for verification
    const body = await request.text();

    // Verify webhook signature
    const isValid = verifyPaystackSignature(signature, body, webhookSecret);
    
    if (!isValid) {
      logError('paystack-webhook', new Error('Invalid webhook signature'), { clientIP });
      return createErrorResponse('AUTHORIZATION_ERROR', 'Invalid signature', 400);
    }

    // Parse the event
    const event = JSON.parse(body);
    
    console.log('Received Paystack webhook event:', event.event);

    // Handle the event based on type
    switch (event.event) {
      case 'charge.success': {
        const data = event.data;
        
        console.log('Charge successful:', data.reference);

        const reference = String(data?.reference || '').trim();
        if (!reference) {
          logError('paystack-webhook', new Error('Missing reference in charge.success payload'), { clientIP });
          return createErrorResponse('VALIDATION_ERROR', 'Missing reference', 400);
        }

        // Verify transaction server-side (defense-in-depth).
        const verified = await verifyTransactionWithPaystack(webhookSecret, reference);
        if (!verified || String(verified?.reference || '') !== reference || verified?.status !== 'success') {
          logError('paystack-webhook', new Error('Paystack verification mismatch'), {
            reference,
            verifiedStatus: verified?.status,
          });
          return createErrorResponse('AUTHORIZATION_ERROR', 'Transaction verification failed', 400);
        }
        
        // Extract metadata
        const meta = (verified?.metadata ?? data.metadata ?? {}) as any;
        const userId = meta?.userId;
        const planId = meta?.planId;
        const billingInterval = normalizeBillingInterval(meta?.billingInterval);
        
        if (!userId || !planId) {
          logError('paystack-webhook', new Error('Missing userId or planId in metadata'), { reference });
          return createErrorResponse('VALIDATION_ERROR', 'Missing metadata', 400);
        }

        // Subscription payment (Paystack plan-based)
        if (data.plan || verified?.plan) {
          const now = new Date().toISOString();

          const endDate = computePeriodEnd(billingInterval);

          // Derive a stable subscription code for idempotency.
          const subscriptionCode =
            String((data as any)?.subscription?.subscription_code || '') ||
            String((data as any)?.subscription_code || '') ||
            String((data as any)?.plan?.subscription_code || '') ||
            String((verified as any)?.plan?.subscription_code || '') ||
            reference;

          const customerCode = String((data as any)?.customer?.customer_code || (verified as any)?.customer?.customer_code || '');
          const authorizationCode = String((data as any)?.authorization?.authorization_code || (verified as any)?.authorization?.authorization_code || '');

          // Best-effort payment record (idempotent via unique paystack_reference).
          try {
            await supabaseAdmin
              .from('payments')
              .upsert(
                {
                  user_id: userId,
                  amount: Number((verified as any)?.amount) ? Number((verified as any)?.amount) / 100 : undefined,
                  currency: String((verified as any)?.currency || (data as any)?.currency || 'NGN'),
                  status: 'succeeded',
                  paystack_reference: reference,
                  paystack_transaction_id: String((verified as any)?.id || ''),
                  description: `Subscription payment (${planId})`,
                  created_at: now,
                } as any,
                { onConflict: 'paystack_reference' }
              );
          } catch {
            // Ignore if the payments table isn't provisioned.
          }
          
          // Upsert subscription record in Supabase (idempotent via unique paystack_subscription_code).
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

          // Update user's subscription tier
          await supabaseAdmin
            .from('users')
            .update({
              subscription_tier: planId,
              updated_at: now,
            })
            .eq('id', userId);

          console.log('Subscription processed successfully for user:', userId);
        } else if (billingInterval === 'trial') {
          // Paid trial: one-time charge (no plan) but we still grant limited-time access.
          const now = new Date().toISOString();
          const endDate = computePeriodEnd('trial');

          const subscriptionCode = `trial_${reference}`;

          try {
            await supabaseAdmin
              .from('payments')
              .upsert(
                {
                  user_id: userId,
                  amount: Number((verified as any)?.amount) ? Number((verified as any)?.amount) / 100 : undefined,
                  currency: String((verified as any)?.currency || (data as any)?.currency || 'NGN'),
                  status: 'succeeded',
                  paystack_reference: reference,
                  paystack_transaction_id: String((verified as any)?.id || ''),
                  description: `Paid trial (${planId})`,
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
                status: 'trialing',
                paystack_subscription_code: subscriptionCode,
                current_period_start: now,
                current_period_end: endDate.toISOString(),
                cancel_at_period_end: true,
                updated_at: now,
              } as any,
              { onConflict: 'paystack_subscription_code' }
            );

          await supabaseAdmin
            .from('users')
            .update({
              subscription_tier: planId,
              updated_at: now,
            })
            .eq('id', userId);

          console.log('Paid trial processed successfully for user:', userId);
        }
        
        break;
      }

      case 'subscription.create': {
        const data = event.data;
        
        console.log('Subscription created:', data.subscription_code);
        
        // This event fires when subscription is created but before first charge
        // We'll handle the actual activation in charge.success
        
        break;
      }

      case 'subscription.disable': {
        const data = event.data;
        
        console.log('Subscription disabled:', data.subscription_code);
        
        // Find subscription in database
        const { data: existingSub, error: findError } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('paystack_subscription_code', data.subscription_code)
          .single();

        if (findError || !existingSub) {
          logError('paystack-webhook', new Error('Subscription not found'), { subscriptionCode: data.subscription_code });
          return createErrorResponse('NOT_FOUND', 'Subscription not found', 404);
        }

        // Update subscription status
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('paystack_subscription_code', data.subscription_code);

        // Downgrade user to free tier
        await supabaseAdmin
          .from('users')
          .update({ 
            subscription_tier: 'free',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.user_id);

        console.log('Subscription canceled successfully');
        break;
      }

      case 'subscription.not_renew': {
        const data = event.data;
        
        console.log('Subscription will not renew:', data.subscription_code);
        
        // Mark subscription to cancel at period end
        await supabaseAdmin
          .from('subscriptions')
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString()
          })
          .eq('paystack_subscription_code', data.subscription_code);

        break;
      }

      case 'invoice.failed':
      case 'charge.failed': {
        const data = event.data;
        
        console.log('Payment failed:', data.reference);
        
        // Find subscription and mark as past_due
        if (data.plan?.subscription_code) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString()
            })
            .eq('paystack_subscription_code', data.plan.subscription_code);
        }
        
        break;
      }

      default:
        console.log('Unhandled event type:', event.event);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    return handleApiError('paystack-webhook', error, { clientIP });
  }
}
