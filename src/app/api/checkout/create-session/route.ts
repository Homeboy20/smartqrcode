import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { initializeSubscriptionPayment, createPaystackCustomer } from '@/lib/paystack';
import { 
  createFlutterwaveSubscriptionPayment,
  getOrCreateFlutterwaveCustomer,
  type FlutterwaveCustomer 
} from '@/lib/flutterwave';
import { subscriptionPricing } from '@/lib/subscriptions';
import { getProviderRuntimeConfig } from '@/lib/paymentSettingsStore';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const supabaseAdmin = getSupabaseAdmin();
    
    // Try to get user from token if provided
    let verifiedUser = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('Attempting to verify token...');
      verifiedUser = await getUserFromToken(token);
      if (verifiedUser) {
        console.log('User verified:', verifiedUser.id);
      }
    }

    // If no token or invalid token, allow guest checkout with email
    const body = await request.json();
    if (!verifiedUser && !body.email) {
      return NextResponse.json({ 
        error: 'Authentication required or email must be provided' 
      }, { status: 401 });
    }

    return await processCheckout(verifiedUser, body, supabaseAdmin);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: errorMessage, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function processCheckout(user: any, body: any, supabaseAdmin: SupabaseClient) {
  const { planId, provider = 'paystack', successUrl, cancelUrl, email, paymentMethod } = body;

  if (!planId || !successUrl || !cancelUrl) {
    return NextResponse.json({ error: 'Missing required fields: planId, successUrl, and cancelUrl are required' }, { status: 400 });
  }

  const supportedProviders = ['paystack', 'flutterwave'];
  if (!supportedProviders.includes(provider)) {
    return NextResponse.json({ error: `Unsupported provider. Allowed: ${supportedProviders.join(', ')}` }, { status: 400 });
  }

  const amount = subscriptionPricing[planId as keyof typeof subscriptionPricing] || 0;

  if (amount === 0) {
    return NextResponse.json({ error: 'Invalid plan ID or free plan selected' }, { status: 400 });
  }

  // Use email from user if authenticated, otherwise from body
  const userEmail = user?.email || email;
  const userId = user?.id || `guest_${Date.now()}`;
  
  if (!userEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (provider === 'paystack') {
    const paystackRuntime = await getProviderRuntimeConfig('paystack');
    const paystackPlanCodes: Record<string, string> = {
      pro: paystackRuntime.credentials.planCodePro || process.env.PAYSTACK_PLAN_CODE_PRO || '',
      business: paystackRuntime.credentials.planCodeBusiness || process.env.PAYSTACK_PLAN_CODE_BUSINESS || '',
    };

    if (!paystackPlanCodes[planId]) {
      return NextResponse.json({ error: 'Invalid plan ID for Paystack. Available plans: pro, business' }, { status: 400 });
    }

    // Only look up customer code if user is authenticated
    let paystackCustomerCode;
    if (user?.id) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('paystack_customer_code')
        .eq('id', user.id)
        .single();

      paystackCustomerCode = userData?.paystack_customer_code;

      if (!paystackCustomerCode) {
        const paystackCustomer = await createPaystackCustomer({
          email: userEmail,
          firstName: user.user_metadata?.full_name?.split(' ')[0] || undefined,
          lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined,
          metadata: {
            userId: user.id,
          },
        });

        paystackCustomerCode = paystackCustomer.customer_code;

        await supabaseAdmin
          .from('users')
          .update({ paystack_customer_code: paystackCustomerCode })
          .eq('id', user.id);
      }
    }

    const reference = `${planId}_${userId}_${Date.now()}`;

    const payment = await initializeSubscriptionPayment({
      email: userEmail,
      amount,
      currency: 'NGN',
      plan: paystackPlanCodes[planId],
      reference,
      callbackUrl: `${successUrl}?reference=${reference}`,
      metadata: {
        userId,
        planId,
        userEmail,
        provider,
        paymentMethod: paymentMethod || 'card',
      },
    });

    return NextResponse.json(
      {
        provider: 'paystack',
        reference,
        url: payment.authorization_url,
        testMode: process.env.NODE_ENV !== 'production',
      },
      { status: 200 },
    );
  }

  // Flutterwave flow with V4 customer management
  const reference = `${planId}_${userId}_${Date.now()}`;
  const planName = `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`;

  try {
    // Create or get Flutterwave customer
    const customerName = user?.user_metadata?.full_name || userEmail.split('@')[0];
    const nameParts = customerName.split(' ');
    
    const flwCustomer: FlutterwaveCustomer = {
      email: userEmail,
      name: {
        first: nameParts[0] || '',
        last: nameParts.slice(1).join(' ') || nameParts[0] || '',
      },
      meta: {
        userId,
        planId,
        source: 'smartqrcode',
      },
    };

    // Get or create customer in Flutterwave
    const customer = await getOrCreateFlutterwaveCustomer(flwCustomer);
    
    console.log('Flutterwave customer:', customer.id);

    // Create payment with customer reference
    const payment = await createFlutterwaveSubscriptionPayment({
      amount,
      currency: 'NGN',
      customerEmail: userEmail,
      customerName: customerName,
      planName,
      reference,
      redirectUrl: `${successUrl}?reference=${reference}`,
      metadata: {
        userId,
        planId,
        userEmail,
        provider,
        paymentMethod: paymentMethod || 'card',
        flwCustomerId: customer.id,
      },
      testMode: process.env.NODE_ENV !== 'production',
    });

    return NextResponse.json(
      {
        provider: 'flutterwave',
        reference,
        url: payment.paymentLink,
        flwRef: payment.flwRef,
        testMode: process.env.NODE_ENV !== 'production',
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to initialize Flutterwave payment';
    console.error('Flutterwave init failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getUserFromToken(token: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration for token verification');
      return null;
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseServiceKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.user || data;
    }

    const errorText = await response.text();
    console.error('Token verification failed:', errorText);

    // Fallback: decode JWT payload to salvage user id/email even if session lookup fails
    const decoded = decodeJwtWithoutVerify(token);
    if (decoded?.sub) {
      console.warn('Using decoded JWT payload as fallback');
      return {
        id: decoded.sub,
        email: decoded.email || decoded.user_email || '',
        user_metadata: decoded.user_metadata || {},
      } as { id: string; email?: string; user_metadata?: Record<string, unknown> };
    }

    return null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

function decodeJwtWithoutVerify(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const decodedJson = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decodedJson);
  } catch (error) {
    console.error('Failed to decode JWT payload:', error);
    return null;
  }
}

