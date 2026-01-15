import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { getProviderRuntimeConfig, type PaymentProvider } from '@/lib/paymentSettingsStore';
import { isMaskedValue } from '@/lib/secure/credentialCrypto';

function mergeWithEnvFallback(provider: PaymentProvider, credentials: Record<string, string>) {
  const merged: Record<string, string> = { ...credentials };

  const setIfMissing = (field: string, envKey: string) => {
    const current = merged[field];
    const isMissing =
      !current ||
      (typeof current === 'string' && current.trim().length === 0) ||
      isMaskedValue(current);
    if (!isMissing) return;

    const envValue = process.env[envKey];
    if (typeof envValue === 'string' && envValue.trim().length > 0) {
      merged[field] = envValue;
    }
  };

  switch (provider) {
    case 'stripe':
      setIfMissing('secretKey', 'STRIPE_SECRET_KEY');
      setIfMissing('webhookSecret', 'STRIPE_WEBHOOK_SECRET');
      break;
    case 'paypal':
      setIfMissing('clientId', 'PAYPAL_CLIENT_ID');
      setIfMissing('clientSecret', 'PAYPAL_CLIENT_SECRET');
      break;
    case 'flutterwave':
      setIfMissing('clientId', 'FLUTTERWAVE_CLIENT_ID');
      setIfMissing('clientSecret', 'FLUTTERWAVE_CLIENT_SECRET');
      setIfMissing('encryptionKey', 'FLUTTERWAVE_ENCRYPTION_KEY');
      break;
    case 'paystack':
      setIfMissing('publicKey', 'PAYSTACK_PUBLIC_KEY');
      setIfMissing('secretKey', 'PAYSTACK_SECRET_KEY');
      break;
  }

  return merged;
}

// POST - Test payment provider connection
export async function POST(request: NextRequest) {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    await verifyAdminAccess(request);

    const body = await request.json().catch(() => ({}));
    const provider = body?.provider as PaymentProvider | undefined;

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    const validProviders: PaymentProvider[] = ['paystack', 'flutterwave', 'stripe', 'paypal'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    const runtime = await getProviderRuntimeConfig(provider);
    if (!runtime.isActive) {
      return NextResponse.json({ error: 'Provider is disabled' }, { status: 400 });
    }

    if ('decryptError' in runtime && (runtime as any).decryptError) {
      // Most commonly this means CREDENTIALS_ENCRYPTION_KEY is missing or changed.
      // Surface the underlying error so admins can fix server config.
      return NextResponse.json(
        {
          error:
            `Stored payment credentials could not be decrypted. ${(runtime as any).decryptError} ` +
            'Ensure CREDENTIALS_ENCRYPTION_KEY is set (and unchanged) on the server.'
        },
        { status: 500 }
      );
    }

    const credentials = mergeWithEnvFallback(provider, runtime.credentials || {});
    if (isDev) {
      console.log(`Testing ${provider} with credential keys:`, Object.keys(credentials || {}));
    }

    let testResult = { success: false, message: '' };

    switch (provider) {
      case 'paystack':
        testResult = await testPaystackConnection(credentials);
        break;
      case 'flutterwave':
        testResult = await testFlutterwaveConnection(credentials);
        break;
      case 'stripe':
        testResult = await testStripeConnection(credentials);
        break;
      case 'paypal':
        testResult = await testPayPalConnection(credentials);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: testResult.message });
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    );
  }
}

async function testPaystackConnection(credentials: { secretKey?: string; publicKey?: string }) {
  if (!credentials.secretKey) {
    return { success: false, message: 'Paystack secret key is required' };
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/verify/test', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    // 401 means invalid API key
    if (response.status === 401) {
      return { success: false, message: 'Invalid Paystack API key' };
    }

    // 404 is expected for test endpoint with non-existent reference
    // This actually means the API key is valid
    if (response.status === 404) {
      return { success: true, message: 'Paystack connection successful' };
    }

    // Any 2xx response means success
    if (response.ok) {
      return { success: true, message: 'Paystack connection successful' };
    }

    return { 
      success: false, 
      message: `Paystack API returned error: ${data.message || `Status ${response.status}`}` 
    };
  } catch (error) {
    console.error('Paystack test error:', error);
    return { 
      success: false, 
      message: 'Failed to connect to Paystack API' 
    };
  }
}

async function testFlutterwaveConnection(credentials: { clientSecret?: string; clientId?: string }) {
  if (!credentials.clientSecret) {
    return { success: false, message: 'Flutterwave Client Secret is required' };
  }

  try {
    // Use v4/customers endpoint for testing connectivity
    const response = await fetch('https://api.flutterwave.com/v4/customers?page=1&limit=1', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.clientSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return { success: false, message: 'Invalid Flutterwave Client Secret - Authentication failed' };
    }

    if (response.status === 403) {
      return { success: false, message: 'Flutterwave Client Secret lacks required permissions' };
    }

    if (!response.ok) {
      return { 
        success: false, 
        message: `Flutterwave API returned error: ${data.message || `Status ${response.status}`}` 
      };
    }

    // For V4 API, a successful connection is indicated by 200 status
    if (response.ok) {
      return { 
        success: true, 
        message: 'Flutterwave V4 API connection successful',
        apiVersion: 'v4'
      };
    }

    return { success: false, message: 'Unexpected response from Flutterwave API' };
  } catch (error) {
    console.error('Flutterwave test error:', error);
    return { 
      success: false, 
      message: `Failed to connect to Flutterwave V4 API: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

async function testStripeConnection(credentials: { secretKey?: string }) {
  if (!credentials.secretKey) {
    return { success: false, message: 'Stripe secret key is required' };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      return { success: false, message: 'Invalid Stripe API key' };
    }

    return { success: true, message: 'Stripe connection successful' };
  } catch (error) {
    return { success: false, message: 'Failed to connect to Stripe API' };
  }
}

async function testPayPalConnection(credentials: { clientId?: string; clientSecret?: string }) {
  if (!credentials.clientId || !credentials.clientSecret) {
    return { success: false, message: 'PayPal client ID and secret are required' };
  }

  try {
    const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (response.status === 401) {
      return { success: false, message: 'Invalid PayPal credentials' };
    }

    return { success: true, message: 'PayPal connection successful' };
  } catch (error) {
    return { success: false, message: 'Failed to connect to PayPal API' };
  }
}
