import { getProviderRuntimeConfig } from '@/lib/paymentSettingsStore';
import { toMinorUnits, type CurrencyCode } from '@/lib/currency';

// Paystack API base URLs
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Paystack API client
class PaystackClient {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}) {
    const url = `${PAYSTACK_BASE_URL}${endpoint}`;

    const controller = new AbortController();
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 15_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? controller.signal,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const text = await response.text();
      const data = (() => {
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return null;
        }
      })();

      // Paystack returns { status: boolean, message: string, data: any }
      const paystackMessage = (data as any)?.message;
      const paystackStatus = (data as any)?.status;

      if (!response.ok || paystackStatus === false) {
        const status = response.status;
        const details = paystackMessage || (text ? text.slice(0, 500) : '');
        throw new Error(details || `Paystack API request failed (HTTP ${status})`);
      }

      if (!data) {
        throw new Error('Paystack API returned an empty response');
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async initializeTransaction(params: {
    email: string;
    amount: number; // In kobo (smallest currency unit)
    currency?: CurrencyCode;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    plan?: string;
  }) {
    return this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async verifyTransaction(reference: string) {
    return this.request(`/transaction/verify/${reference}`);
  }

  async createPlan(params: {
    name: string;
    amount: number; // In kobo
    interval: 'daily' | 'weekly' | 'monthly' | 'annually';
    description?: string;
    currency?: CurrencyCode;
  }) {
    return this.request('/plan', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createSubscription(params: {
    customer: string; // Customer code or email
    plan: string; // Plan code
    authorization: string; // Authorization code from previous transaction
    start_date?: string;
  }) {
    return this.request('/subscription', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async disableSubscription(params: {
    code: string; // Subscription code
    token: string; // Email token
  }) {
    return this.request('/subscription/disable', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async enableSubscription(params: {
    code: string; // Subscription code
    token: string; // Email token
  }) {
    return this.request('/subscription/enable', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCustomer(params: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }) {
    return this.request('/customer', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getCustomer(emailOrCode: string) {
    return this.request(`/customer/${emailOrCode}`);
  }
}

// Initialize Paystack client
let paystackClient: PaystackClient | null = null;
let paystackClientSecretKey: string | null = null;

export async function getPaystackClient() {
  const runtime = await getProviderRuntimeConfig('paystack');
  
  // Check for decryption errors first
  if ('decryptError' in runtime && (runtime as any).decryptError) {
    throw new Error(
      `Paystack credentials could not be decrypted: ${(runtime as any).decryptError}. ` +
      'Please check that CREDENTIALS_ENCRYPTION_KEY(S) is set correctly on the server.'
    );
  }
  
  const secretKey = runtime.credentials.secretKey || '';
  
  if (!secretKey) {
    throw new Error('Paystack API key not configured');
  }
  
  if (!paystackClient || paystackClientSecretKey !== secretKey) {
    paystackClient = new PaystackClient(secretKey);
    paystackClientSecretKey = secretKey;
  }
  
  return paystackClient;
}

// Get public key for client-side use
export async function getPaystackPublicKey() {
  const runtime = await getProviderRuntimeConfig('paystack');
  return runtime.credentials.publicKey || null;
}

// Initialize transaction for subscription
export async function initializeSubscriptionPayment({
  email,
  amount, // In major currency unit (e.g., 9.99 USD)
  currency = 'NGN',
  plan,
  reference,
  callbackUrl,
  metadata = {},
}: {
  email: string;
  amount: number;
  currency?: CurrencyCode;
  plan: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, any>;
}) {
  try {
    const client = await getPaystackClient();

    // Paystack expects the smallest currency unit.
    const amountInKobo = toMinorUnits(amount, currency);
    
    const response = await client.initializeTransaction({
      email,
      amount: amountInKobo,
      currency,
      reference,
      callback_url: callbackUrl,
      plan,
      metadata: {
        ...metadata,
        custom_fields: [
          {
            display_name: 'Plan',
            variable_name: 'plan',
            value: metadata.planId || plan,
          }
        ]
      },
    });

    return {
      authorization_url: response.data.authorization_url,
      access_code: response.data.access_code,
      reference: response.data.reference,
    };
  } catch (error) {
    console.error('Error initializing Paystack payment:', error);
    const message = String((error as any)?.message || 'Failed to initialize payment');
    throw new Error(message);
  }
}

// Verify transaction
export async function verifyPaystackTransaction(reference: string) {
  try {
    const client = await getPaystackClient();
    const response = await client.verifyTransaction(reference);
    return response.data;
  } catch (error) {
    console.error('Error verifying Paystack transaction:', error);
    const message = String((error as any)?.message || 'Failed to verify transaction');
    throw new Error(message);
  }
}

// Create a customer
export async function createPaystackCustomer({
  email,
  firstName,
  lastName,
  metadata = {},
}: {
  email: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const client = await getPaystackClient();
    
    const response = await client.createCustomer({
      email,
      first_name: firstName,
      last_name: lastName,
      metadata,
    });

    return response.data;
  } catch (error) {
    console.error('Error creating Paystack customer:', error);
    const message = String((error as any)?.message || 'Failed to create customer');
    throw new Error(message);
  }
}

// Create subscription (requires authorization code from previous transaction)
export async function createPaystackSubscription({
  customerEmail,
  planCode,
  authorizationCode,
}: {
  customerEmail: string;
  planCode: string;
  authorizationCode: string;
}) {
  try {
    const client = await getPaystackClient();
    
    const response = await client.createSubscription({
      customer: customerEmail,
      plan: planCode,
      authorization: authorizationCode,
    });

    return response.data;
  } catch (error) {
    console.error('Error creating Paystack subscription:', error);
    const message = String((error as any)?.message || 'Failed to create subscription');
    throw new Error(message);
  }
}

// Cancel subscription
export async function cancelPaystackSubscription({
  subscriptionCode,
  emailToken,
}: {
  subscriptionCode: string;
  emailToken: string;
}) {
  try {
    const client = await getPaystackClient();
    
    const response = await client.disableSubscription({
      code: subscriptionCode,
      token: emailToken,
    });

    return response.data;
  } catch (error) {
    console.error('Error canceling Paystack subscription:', error);
    const message = String((error as any)?.message || 'Failed to cancel subscription');
    throw new Error(message);
  }
}

// Verify webhook signature
export function verifyPaystackWebhook(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto');
  const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  return hash === signature;
}
