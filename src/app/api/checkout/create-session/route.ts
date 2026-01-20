import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { 
  detectCountryFromHeaders, 
  getCurrencyForCountry, 
  getRecommendedProvider,
  type CurrencyCode 
} from '@/lib/currency';
import { createUniversalCheckoutSession } from '@/lib/checkout/universalCheckout';

function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const supabaseAdmin = getSupabaseAdmin();

    // Parse body early so we can respect an explicit billing/checkout country.
    const body = await request.json();

    // Detect user's country and currency (allow explicit override)
    const explicitCountry = normalizeCountryCode(body?.countryCode);
    const countryCode = explicitCountry || detectCountryFromHeaders(request.headers);
    const currencyConfig = getCurrencyForCountry(countryCode);
    console.log(
      `Detected country: ${countryCode}${explicitCountry ? ' (explicit)' : ''}, currency: ${currencyConfig.code}`
    );
    
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
    if (!verifiedUser && !body.email) {
      return NextResponse.json({ 
        error: 'Authentication required or email must be provided' 
      }, { status: 401 });
    }

    return await processCheckout(verifiedUser, body, supabaseAdmin, currencyConfig.code, countryCode);
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

async function processCheckout(
  user: any, 
  body: any, 
  supabaseAdmin: SupabaseClient, 
  currency: CurrencyCode, 
  countryCode: string
) {
  const { planId, successUrl, cancelUrl, email, paymentMethod, idempotencyKey, billingInterval } = body;

  if (!planId || !successUrl || !cancelUrl) {
    return NextResponse.json({ error: 'Missing required fields: planId, successUrl, and cancelUrl are required' }, { status: 400 });
  }

  if (planId !== 'pro' && planId !== 'business') {
    return NextResponse.json({ error: 'Invalid plan ID or free plan selected' }, { status: 400 });
  }

  // Auto-select provider based on currency if not specified
  const provider = body.provider || getRecommendedProvider(currency);

  console.log(`Processing checkout: ${planId} plan, ${currency}, provider: ${provider}`);

  // Use email from user if authenticated, otherwise from body
  const userEmail = user?.email || email;
  
  if (!userEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const session = await createUniversalCheckoutSession({
      planId,
      billingInterval:
        String(billingInterval || '').toLowerCase().trim() === 'yearly'
          ? 'yearly'
          : String(billingInterval || '').toLowerCase().trim() === 'trial'
            ? 'trial'
            : 'monthly',
      currency,
      countryCode,
      successUrl,
      cancelUrl,
      email: userEmail,
      paymentMethod,
      provider,
      idempotencyKey,
      user,
      supabaseAdmin,
    });

    return NextResponse.json(session, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    const status =
      message.startsWith('Unsupported provider') ||
      message.startsWith('Invalid plan') ||
      message.startsWith('Selected provider does not support')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
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

    // ❌ SECURITY FIX: Removed insecure JWT fallback
    // Previously this decoded JWT without verification, allowing attackers to forge tokens
    // If token verification fails, authentication is required
    return null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

function decodeJwtWithoutVerify(token: string) {
  // ❌ DEPRECATED: This function is no longer used for security reasons
  // JWT must always be verified before trusting its contents
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

