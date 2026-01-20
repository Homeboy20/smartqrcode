import paypal from '@paypal/checkout-server-sdk';
import { getCredential } from '@/lib/credentials';

// Define PayPal types
type PayPalEnvironment = any;
type PayPalHttpClient = any;

// Initialize PayPal environment with async credentials
let paypalClient: PayPalHttpClient | null = null;

// Create PayPal environment
async function getEnvironment(): Promise<PayPalEnvironment> {
  const clientId = await getCredential('PAYPAL_CLIENT_ID');
  const clientSecret = await getCredential('PAYPAL_CLIENT_SECRET');
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Make sure credentials are available
  if (!clientId || !clientSecret) {
    console.warn('Missing PayPal credentials (PAYPAL_CLIENT_ID and/or PAYPAL_CLIENT_SECRET)');
    throw new Error('PayPal credentials not configured');
  }
  
  return isProduction
    ? new (paypal as any).core.LiveEnvironment(clientId, clientSecret)
    : new (paypal as any).core.SandboxEnvironment(clientId, clientSecret);
}

// Create PayPal client
async function getClient(): Promise<PayPalHttpClient> {
  if (!paypalClient) {
    const environment = await getEnvironment();
    paypalClient = new (paypal as any).core.PayPalHttpClient(environment);
  }
  return paypalClient;
}

// Get PayPal client ID for client-side rendering
export async function getPayPalClientId() {
  return await getCredential('PAYPAL_CLIENT_ID');
}

// Create order for a one-time payment
export async function createPayPalOrder({
  value,
  currencyCode = 'USD',
  reference,
  description,
  returnUrl,
  cancelUrl,
}: {
  value: number;
  currencyCode?: string;
  reference: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  try {
    // Get PayPal client
    const client = await getClient();
    
    // Create order request
    const request = new (paypal as any).orders.OrdersCreateRequest();
    request.prefer('return=representation');
    
    // Set request body
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currencyCode,
            value: value.toString(),
          },
          description,
          reference_id: reference,
        },
      ],
      application_context: {
        brand_name: 'ScanMagic',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    });
    
    // Send API request to create order
    const response = await client.execute(request);
    
    // Get order ID and approval URL
    const orderId = response.result.id;
    const approvalUrl = response.result.links.find((link: { rel: string }) => link.rel === 'approve')?.href;
    
    return {
      orderId,
      approvalUrl,
    };
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw new Error('Failed to create PayPal order');
  }
}

// Capture payment for an approved order
export async function capturePayPalOrder(orderId: string) {
  try {
    // Get PayPal client
    const client = await getClient();
    
    // Create capture request
    const request = new (paypal as any).orders.OrdersCaptureRequest(orderId);
    request.prefer('return=representation');
    
    // Send API request to capture payment
    const response = await client.execute(request);
    
    // Check if capture was successful
    const captureStatus = response.result.status;
    const captureId = response.result.purchase_units[0].payments.captures[0].id;
    
    return {
      success: captureStatus === 'COMPLETED',
      orderId,
      captureId,
      details: response.result,
    };
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    throw new Error('Failed to capture PayPal payment');
  }
}

// Add test mode parameter to the interface
export interface PayPalSubscriptionParams {
  planId: string;
  returnUrl: string;
  cancelUrl: string;
  customerId?: string;
  testMode?: boolean; // Add test mode parameter
}

// Update the function implementation to handle test mode
export async function createPayPalSubscription(params: PayPalSubscriptionParams) {
  // PayPal subscriptions are not currently integrated in this project.
  // Keep this DB-only: credentials (when needed) must be read from `payment_settings`.
  void params;
  throw new Error('PayPal subscriptions are not integrated yet');
}

// Cancel a PayPal subscription
export async function cancelPayPalSubscription(subscriptionId: string, reason: string = 'Canceled by user') {
  try {
    // Get PayPal client
    const client = await getClient();
    
    // Create cancel request
    const request = new (paypal as any).subscriptions.SubscriptionsCancelRequest(subscriptionId);
    
    // Set request body with reason
    request.requestBody({
      reason,
    });
    
    // Send API request to cancel subscription
    await client.execute(request);
    
    return {
      success: true,
      subscriptionId,
    };
  } catch (error) {
    console.error('Error canceling PayPal subscription:', error);
    throw new Error('Failed to cancel PayPal subscription');
  }
} 