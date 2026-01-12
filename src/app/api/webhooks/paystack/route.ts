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
        
        // Extract metadata
        const userId = data.metadata?.userId;
        const planId = data.metadata?.planId;
        
        if (!userId || !planId) {
          logError('paystack-webhook', new Error('Missing userId or planId in metadata'), { reference: data.reference });
          return createErrorResponse('VALIDATION_ERROR', 'Missing metadata', 400);
        }

        // Check if this is a subscription payment
        if (data.plan) {
          const now = new Date().toISOString();
          
          // Calculate subscription end date (30 days for monthly)
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);
          
          // Create or update subscription record in Supabase
          const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('paystack_subscription_code', data.plan.subscription_code)
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
              .eq('paystack_subscription_code', data.plan.subscription_code);
          } else {
            // Create new subscription
            await supabaseAdmin
              .from('subscriptions')
              .insert({
                user_id: userId,
                plan: planId,
                status: 'active',
                paystack_subscription_code: data.plan.subscription_code || data.reference,
                paystack_customer_code: data.customer.customer_code,
                paystack_authorization_code: data.authorization.authorization_code,
                current_period_start: now,
                current_period_end: endDate.toISOString(),
                cancel_at_period_end: false,
                created_at: now,
                updated_at: now
              });

            // Update user's subscription tier
            await supabaseAdmin
              .from('users')
              .update({ 
                subscription_tier: planId,
                updated_at: now
              })
              .eq('id', userId);
          }

          console.log('Subscription processed successfully for user:', userId);
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
