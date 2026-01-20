// Flutterwave API Integration
// Documentation: https://developer.flutterwave.com/reference

import { getProviderRuntimeConfig } from '@/lib/paymentSettingsStore';

// Flutterwave's public API is versioned under /v3.
// Using /v4 causes production failures like: "Cannot POST /v4/customers".
const FLUTTERWAVE_V4_BASE_URL = 'https://api.flutterwave.com/v3';

const DEFAULT_FLW_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Types for Flutterwave V4 API
export interface FlutterwaveCustomer {
  id?: string;
  email: string;
  name?: {
    first: string;
    middle?: string;
    last?: string;
  };
  phone?: {
    country_code: string;
    number: string;
  };
  address?: {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postal_code?: string;
    state?: string;
  };
  meta?: Record<string, any>;
}

export interface FlutterwavePayment {
  tx_ref: string;
  amount: string;
  currency: string;
  redirect_url: string;
  payment_options?: string;
  customer: {
    email: string;
    name: string;
  };
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: Record<string, any>;
}

// Get Flutterwave credentials
async function getFlutterwaveCredentials() {
  const runtime = await getProviderRuntimeConfig('flutterwave');
  
  // Check for decryption errors first
  if ('decryptError' in runtime && (runtime as any).decryptError) {
    throw new Error(
      `Flutterwave credentials could not be decrypted: ${(runtime as any).decryptError}. ` +
      'Please check that CREDENTIALS_ENCRYPTION_KEY(S) is set correctly on the server.'
    );
  }
  
  const clientId = runtime.credentials.clientId || '';
  const clientSecret = runtime.credentials.clientSecret || '';
  const encryptionKey = runtime.credentials.encryptionKey || '';
  
  if (!clientId || !clientSecret) {
    throw new Error('Flutterwave credentials not configured');
  }
  
  return { clientId, clientSecret, encryptionKey };
}

// Make authenticated request to Flutterwave V4 API
async function flutterwaveRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  requestOptions?: { timeoutMs?: number }
) {
  const { clientSecret } = await getFlutterwaveCredentials();
  
  const url = `${FLUTTERWAVE_V4_BASE_URL}${endpoint}`;
  
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientSecret}`,
    },
  };
  
  if (body && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  const timeoutMs = requestOptions?.timeoutMs ?? DEFAULT_FLW_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, init, timeoutMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes('aborted')) {
      throw new Error('Flutterwave request timed out');
    }
    throw err;
  }

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  const ok = response.ok && data?.status === 'success';
  if (!ok) {
    const errorMessage =
      data?.message ||
      data?.error ||
      (raw && raw.length ? raw.slice(0, 200) : undefined) ||
      `Flutterwave API error: ${response.status} ${response.statusText}`;

    console.error('Flutterwave API Error:', {
      endpoint,
      status: response.status,
      message: errorMessage,
      data,
    });
    throw new Error(errorMessage);
  }

  return data;
}

export async function listFlutterwaveBanks(countryCode: string) {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    throw new Error('Invalid country code. Use ISO alpha-2, e.g. NG');
  }

  const response = await flutterwaveRequest(`/banks/${encodeURIComponent(cc)}`, 'GET', undefined, {
    timeoutMs: DEFAULT_FLW_TIMEOUT_MS,
  });

  const banks = Array.isArray((response as any)?.data) ? (response as any).data : [];

  return banks
    .map((b: any) => ({
      name: String(b?.name || ''),
      code: b?.code ? String(b.code) : undefined,
    }))
    .filter((b: any) => b.name);
}

// Create a payment link with Flutterwave V4
export async function createFlutterwavePaymentLink({
  amount,
  currency = 'NGN',
  customerEmail,
  customerName,
  description,
  reference,
  callbackUrl,
  redirectUrl,
  paymentMethod,
  metadata = {},
}: {
  amount: number;
  currency?: string;
  customerEmail: string;
  customerName?: string;
  description: string;
  reference: string;
  callbackUrl?: string;
  redirectUrl: string;
  paymentMethod?: 'card' | 'mobile_money';
  metadata?: Record<string, any>;
}) {
  try {
    const payload = {
      tx_ref: reference,
      amount: amount.toString(),
      currency,
      payment_options: getFlutterwavePaymentOptions(paymentMethod),
      redirect_url: redirectUrl,
      customer: {
        email: customerEmail,
        name: customerName || customerEmail.split('@')[0],
      },
      customizations: {
        title: 'ScanMagic Payment',
        description,
        logo: process.env.NEXT_PUBLIC_APP_LOGO_URL || '',
      },
      meta: {
        ...metadata,
        source: 'smartqrcode_app',
        callback_url: callbackUrl,
      },
    };

    const response = await flutterwaveRequest('/payments', 'POST', payload);

    return {
      paymentLink: response.data.link,
      reference: payload.tx_ref,
      flwRef: response.data.id,
    };
  } catch (error) {
    console.error('Error creating Flutterwave payment link:', error);
    throw error;
  }
}

// Verify a Flutterwave transaction using V4 API
export async function verifyFlutterwaveTransaction(transactionId: string) {
  try {
    const response = await flutterwaveRequest(`/transactions/${transactionId}/verify`);

    const transactionData = response.data;

    return {
      success: transactionData.status === 'successful',
      amount: transactionData.amount,
      currency: transactionData.currency,
      customerEmail: transactionData.customer.email,
      reference: transactionData.tx_ref,
      flwRef: transactionData.id,
      transactionId: transactionData.id,
      paymentType: transactionData.payment_type,
      metadata: transactionData.meta,
      createdAt: transactionData.created_at,
    };
  } catch (error) {
    console.error('Error verifying Flutterwave transaction:', error);
    throw error;
  }
}

// Add test mode parameter to the interface
export interface FlutterwavePaymentParams {
  amount: number;
  currency?: string;
  customerEmail: string;
  customerName?: string;
  planName: string;
  reference: string;
  redirectUrl: string;
  metadata?: Record<string, any>;
  paymentMethod?: 'card' | 'mobile_money';
  testMode?: boolean; // Add test mode parameter
}

function getFlutterwavePaymentOptions(paymentMethod?: 'card' | 'mobile_money') {
  if (paymentMethod === 'card') return 'card';
  if (paymentMethod === 'mobile_money') {
    // Keep this broad; country-specific refinement happens in getFlutterwavePaymentOptionsForCountry.
    return 'mobilemoney,mpesa,ussd,account,banktransfer';
  }
  return 'card,mobilemoney,mpesa,ussd,account,banktransfer';
}

export function getFlutterwavePaymentOptionsForCheckoutMethod(method?: 'card' | 'mobile_money') {
  return getFlutterwavePaymentOptions(method);
}

export function getFlutterwavePaymentOptionsForCountry(options: {
  countryCode: string;
  method?: 'card' | 'mobile_money';
}) {
  const cc = String(options.countryCode || '').trim().toUpperCase();
  const method = options.method;

  if (method === 'card') return 'card';

  // Flutterwave's payment_options is a comma-separated allow-list. Many local methods are country-specific.
  // We keep a conservative mapping for well-known local options and fall back to a broad set.
  switch (cc) {
    case 'KE':
      // Kenya: M-Pesa and cards.
      return method === 'mobile_money' ? 'mpesa' : 'card,mpesa';
    case 'TZ':
      // Tanzania: mobile money Tanzania.
      return method === 'mobile_money' ? 'mobilemoneytanzania' : 'card,mobilemoneytanzania';
    case 'UG':
      return method === 'mobile_money' ? 'mobilemoneyuganda' : 'card,mobilemoneyuganda';
    case 'RW':
      return method === 'mobile_money' ? 'mobilemoneyrwanda' : 'card,mobilemoneyrwanda';
    case 'GH':
      return method === 'mobile_money' ? 'mobilemoneyghana' : 'card,mobilemoneyghana';
    case 'NG':
      // Nigeria: keep broad; users may choose card, USSD, bank transfer.
      return method === 'mobile_money' ? 'ussd,banktransfer,account' : 'card,ussd,banktransfer,account';
    default:
      return getFlutterwavePaymentOptions(method);
  }
}

export function getFlutterwavePaymentOptionsMatrix() {
  return {
    card: getFlutterwavePaymentOptions('card'),
    mobile_money: getFlutterwavePaymentOptions('mobile_money'),
    any: getFlutterwavePaymentOptions(undefined),
  };
}

// Create subscription payment using V4 API
export async function createFlutterwaveSubscriptionPayment(params: FlutterwavePaymentParams) {
  const { 
    amount, 
    currency = 'NGN', 
    customerEmail, 
    customerName = '', 
    planName, 
    reference, 
    redirectUrl, 
    metadata = {},
    paymentMethod,
    testMode = false 
  } = params;
  
  try {
    const payload = {
      tx_ref: reference,
      amount: amount.toString(),
      currency,
      redirect_url: redirectUrl,
      payment_options: getFlutterwavePaymentOptions(paymentMethod),
      customer: {
        email: customerEmail,
        name: customerName || customerEmail.split('@')[0],
      },
      customizations: {
        title: planName,
        description: `Subscription payment for ${planName}`,
        logo: process.env.NEXT_PUBLIC_APP_LOGO_URL || 'https://scanmagic.online/favicon.ico',
      },
      meta: {
        ...metadata,
        planName,
        source: 'smartqrcode_subscription',
        testMode,
      },
    };

    const response = await flutterwaveRequest('/payments', 'POST', payload);

    return {
      reference,
      paymentLink: response.data?.link,
      flwRef: response.data?.id,
    };
  } catch (error) {
    console.error('Error creating Flutterwave subscription payment:', error);
    throw error;
  }
}

// Cancel a subscription (implemented as disabling recurring billing)
export async function cancelFlutterwaveSubscription(customerId: string, subscriptionId: string) {
  // Since Flutterwave doesn't have native subscription support like Stripe,
  // this would typically involve disabling the recurring flag in your database
  // and preventing future charges for this subscription.
  
  console.log(`Canceling Flutterwave subscription ${subscriptionId} for customer ${customerId}`);
  
  // Here you would typically update your database to mark this subscription as canceled
  
  return {
    success: true,
    subscriptionId,
    message: 'Subscription canceled successfully',
  };
}

// Get Flutterwave client ID for client-side rendering
export async function getFlutterwaveClientId() {
  const { clientId } = await getFlutterwaveCredentials();
  return clientId;
}

// Get Flutterwave encryption key for client-side encryption
export async function getFlutterwaveEncryptionKey() {
  const { encryptionKey } = await getFlutterwaveCredentials();
  return encryptionKey;
}

// List all transactions (V4 API)
export async function listFlutterwaveTransactions(params?: {
  from?: string;
  to?: string;
  page?: number;
  customer_email?: string;
}) {
  try {
    let endpoint = '/transactions';
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.from) queryParams.append('from', params.from);
      if (params.to) queryParams.append('to', params.to);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.customer_email) queryParams.append('customer_email', params.customer_email);
      
      if (queryParams.toString()) {
        endpoint += `?${queryParams.toString()}`;
      }
    }
    
    const response = await flutterwaveRequest(endpoint);
    return response.data;
  } catch (error) {
    console.error('Error listing Flutterwave transactions:', error);
    throw error;
  }
}

// Get transaction fee (V4 API)
export async function getFlutterwaveTransactionFee(params: {
  amount: number;
  currency: string;
  payment_type?: string;
}) {
  try {
    const queryParams = new URLSearchParams({
      amount: params.amount.toString(),
      currency: params.currency,
    });
    
    if (params.payment_type) {
      queryParams.append('payment_type', params.payment_type);
    }
    
    const response = await flutterwaveRequest(`/transactions/fee?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error getting Flutterwave transaction fee:', error);
    throw error;
  }
}

// ============================================
// CUSTOMER MANAGEMENT (V4 API)
// ============================================

// List customers with pagination
export async function listFlutterwaveCustomers(params?: {
  page?: number;
  size?: number; // 10-50
}) {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('page', (params?.page || 1).toString());
    queryParams.append('size', Math.min(params?.size || 10, 50).toString());
    
    const response = await flutterwaveRequest(`/customers?${queryParams.toString()}`);
    return {
      customers: response.data,
      meta: response.meta,
    };
  } catch (error) {
    console.error('Error listing Flutterwave customers:', error);
    throw error;
  }
}

// Create a new customer
export async function createFlutterwaveCustomer(customer: FlutterwaveCustomer) {
  try {
    const payload: any = {
      email: customer.email,
    };

    if (customer.name) {
      payload.name = customer.name;
    }

    if (customer.phone) {
      payload.phone = customer.phone;
    }

    if (customer.address) {
      payload.address = customer.address;
    }

    if (customer.meta) {
      payload.meta = customer.meta;
    }

    const response = await flutterwaveRequest('/customers', 'POST', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating Flutterwave customer:', error);
    throw error;
  }
}

// Get a single customer by ID
export async function getFlutterwaveCustomer(customerId: string) {
  try {
    const response = await flutterwaveRequest(`/customers/${customerId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting Flutterwave customer:', error);
    throw error;
  }
}

// Update an existing customer
export async function updateFlutterwaveCustomer(
  customerId: string,
  updates: Partial<FlutterwaveCustomer>
) {
  try {
    const payload: any = {};

    if (updates.email) payload.email = updates.email;
    if (updates.name) payload.name = updates.name;
    if (updates.phone) payload.phone = updates.phone;
    if (updates.address) payload.address = updates.address;
    if (updates.meta) payload.meta = updates.meta;

    const response = await flutterwaveRequest(`/customers/${customerId}`, 'PUT', payload);
    return response.data;
  } catch (error) {
    console.error('Error updating Flutterwave customer:', error);
    throw error;
  }
}

// Search customers by email, name, or phone
export async function searchFlutterwaveCustomers(searchParams: {
  email?: string;
  name?: string;
  phone?: string;
}) {
  try {
    const response = await flutterwaveRequest('/customers/search', 'POST', searchParams);
    return response.data;
  } catch (error) {
    console.error('Error searching Flutterwave customers:', error);
    throw error;
  }
}

// Get or create customer (helper function)
export async function getOrCreateFlutterwaveCustomer(customer: FlutterwaveCustomer) {
  try {
    // Try to search for existing customer by email
    const searchResults = await searchFlutterwaveCustomers({ email: customer.email });
    
    if (searchResults && searchResults.length > 0) {
      return searchResults[0]; // Return first match
    }
    
    // Customer doesn't exist, create new one
    return await createFlutterwaveCustomer(customer);
  } catch (error) {
    console.error('Error getting or creating Flutterwave customer:', error);
    // If search fails, try to create directly
    try {
      return await createFlutterwaveCustomer(customer);
    } catch (createError) {
      console.error('Error creating customer after search failed:', createError);
      throw createError;
    }
  }
} 