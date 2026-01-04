import { getCredential } from '@/lib/credentials';
import { getProviderRuntimeConfig } from '@/lib/paymentSettingsStore';

// Paystack API base URLs
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Paystack API client
class PaystackClient {
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${PAYSTACK_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Paystack API request failed');
    }

    return data;
  }

  async initializeTransaction(params: {
    email: string;
    amount: number; // In kobo (smallest currency unit)
    currency?: string;
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
    currency?: string;
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

export async function getPaystackClient() {
  const runtime = await getProviderRuntimeConfig('paystack');
  const secretKey =
    runtime.credentials.secretKey ||
    (await getCredential('PAYSTACK_SECRET_KEY')) ||
    (await getCredential('PAYSTACK_SECRET_KEY'.toUpperCase()));
  
  if (!secretKey) {
    console.warn('Missing PAYSTACK_SECRET_KEY');
    throw new Error('Paystack API key not configured');
  }
  
  if (!paystackClient) {
    paystackClient = new PaystackClient(secretKey);
  }
  
  return paystackClient;
}

// Get public key for client-side use
export async function getPaystackPublicKey() {
  const runtime = await getProviderRuntimeConfig('paystack');
  return (
    runtime.credentials.publicKey ||
    (await getCredential('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY')) ||
    (await getCredential('PAYSTACK_PUBLIC_KEY'))
  );
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
  currency?: string;
  plan: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, any>;
}) {
  try {
    const client = await getPaystackClient();
    
    // Convert amount to kobo (smallest unit)
    // For NGN: 1 NGN = 100 kobo
    // For USD: 1 USD = 100 cents
    const amountInKobo = Math.round(amount * 100);
    
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
    throw new Error('Failed to initialize payment');
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
    throw new Error('Failed to verify transaction');
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
    throw new Error('Failed to create customer');
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
    throw new Error('Failed to create subscription');
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
    throw new Error('Failed to cancel subscription');
  }
}

// Verify webhook signature
export function verifyPaystackWebhook(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto');
  const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  return hash === signature;
}
