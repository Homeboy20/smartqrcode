/**
 * Webhook signature verification utilities
 * Implements secure webhook validation for all payment providers
 */

import crypto from 'crypto';

/**
 * Verify Stripe webhook signature
 * @param signature - The stripe-signature header
 * @param rawBody - The raw request body (unparsed)
 * @param webhookSecret - Your Stripe webhook secret
 * @returns true if valid, false otherwise
 */
export function verifyStripeSignature(
  signature: string | null,
  rawBody: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret) {
    return false;
  }

  try {
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !sig) {
      return false;
    }

    // Check if timestamp is recent (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - parseInt(timestamp) > 300) {
      console.warn('Stripe webhook timestamp too old');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch (error) {
    console.error('Stripe signature verification error:', error);
    return false;
  }
}

/**
 * Verify Paystack webhook signature
 * @param signature - The x-paystack-signature header
 * @param rawBody - The raw request body
 * @param webhookSecret - Your Paystack secret key
 * @returns true if valid, false otherwise
 */
export function verifyPaystackSignature(
  signature: string | null,
  rawBody: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret) {
    return false;
  }

  try {
    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch (error) {
    console.error('Paystack signature verification error:', error);
    return false;
  }
}

/**
 * Verify Flutterwave webhook signature
 * Supports current Flutterwave docs: `flutterwave-signature` header contains
 * a base64-encoded HMAC-SHA256 of the raw request body signed with your secret hash.
 *
 * For backwards compatibility, also accepts legacy schemes where the signature
 * may be a static hash value (e.g. `verif-hash`).
 *
 * @param signature - The flutterwave-signature (preferred) or verif-hash header
 * @param rawBodyOrSecret - Either raw request body (preferred overload) or secret hash (legacy overload)
 * @param webhookSecret - Your Flutterwave secret hash (preferred overload)
 * @returns true if valid, false otherwise
 */
export function verifyFlutterwaveSignature(signature: string | null, webhookSecret: string): boolean;
export function verifyFlutterwaveSignature(
  signature: string | null,
  rawBody: string,
  webhookSecret: string
): boolean;
export function verifyFlutterwaveSignature(
  signature: string | null,
  rawBodyOrSecret: string,
  maybeSecret?: string
): boolean {
  const rawBody = maybeSecret ? rawBodyOrSecret : null;
  const webhookSecret = maybeSecret ? maybeSecret : rawBodyOrSecret;

  if (!signature || !webhookSecret) return false;

  try {
    // Preferred: HMAC-SHA256(base64) of rawBody signed with secret hash.
    if (rawBody !== null) {
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('base64');

      // Constant-time comparison
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }

    // Legacy: static hash comparison
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(webhookSecret));
  } catch (error) {
    console.error('Flutterwave signature verification error:', error);
    return false;
  }
}

/**
 * Verify PayPal webhook signature
 * Note: PayPal requires a more complex verification process
 * @param webhookId - Your PayPal webhook ID
 * @param headers - All webhook headers
 * @param rawBody - The raw request body
 * @param clientId - Your PayPal client ID
 * @param clientSecret - Your PayPal client secret
 * @returns Promise<boolean>
 */
export async function verifyPayPalWebhook(
  webhookId: string,
  headers: Record<string, string>,
  rawBody: string,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  if (!webhookId || !clientId || !clientSecret) {
    return false;
  }

  try {
    // PayPal verification requires calling their API
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const verificationBody = {
      auth_algo: headers['paypal-auth-algo'] || headers['PAYPAL-AUTH-ALGO'],
      cert_url: headers['paypal-cert-url'] || headers['PAYPAL-CERT-URL'],
      transmission_id: headers['paypal-transmission-id'] || headers['PAYPAL-TRANSMISSION-ID'],
      transmission_sig: headers['paypal-transmission-sig'] || headers['PAYPAL-TRANSMISSION-SIG'],
      transmission_time: headers['paypal-transmission-time'] || headers['PAYPAL-TRANSMISSION-TIME'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    };

    const sandboxMode = process.env.NODE_ENV !== 'production';
    const apiUrl = sandboxMode
      ? 'https://api.sandbox.paypal.com/v1/notifications/verify-webhook-signature'
      : 'https://api.paypal.com/v1/notifications/verify-webhook-signature';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(verificationBody),
    });

    if (!response.ok) {
      console.error('PayPal verification API error:', response.status);
      return false;
    }

    const result = await response.json();
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal signature verification error:', error);
    return false;
  }
}

/**
 * Generic webhook verification dispatcher
 */
export async function verifyWebhookSignature(
  provider: 'stripe' | 'paystack' | 'flutterwave' | 'paypal',
  headers: Record<string, string | null>,
  rawBody: string,
  secrets: Record<string, string>
): Promise<boolean> {
  switch (provider) {
    case 'stripe':
      return verifyStripeSignature(
        headers['stripe-signature'],
        rawBody,
        secrets.webhookSecret
      );

    case 'paystack':
      return verifyPaystackSignature(
        headers['x-paystack-signature'],
        rawBody,
        secrets.secretKey
      );

    case 'flutterwave':
      return verifyFlutterwaveSignature(
        headers['flutterwave-signature'] || headers['verif-hash'],
        rawBody,
        secrets.webhookSecret
      );

    case 'paypal':
      return await verifyPayPalWebhook(
        secrets.webhookId,
        headers as Record<string, string>,
        rawBody,
        secrets.clientId,
        secrets.clientSecret
      );

    default:
      console.error(`Unknown payment provider: ${provider}`);
      return false;
  }
}

/**
 * Rate limiting for webhook endpoints
 */
const webhookAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkWebhookRateLimit(ip: string, maxAttempts = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const record = webhookAttempts.get(ip);

  if (!record || now > record.resetTime) {
    webhookAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clean up old rate limit records (call periodically)
 */
export function cleanupWebhookRateLimits() {
  const now = Date.now();
  for (const [ip, record] of webhookAttempts.entries()) {
    if (now > record.resetTime) {
      webhookAttempts.delete(ip);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupWebhookRateLimits, 5 * 60 * 1000);
}
