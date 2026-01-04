# Paystack Payment Integration Guide

## Overview
Complete Paystack payment integration for subscription management based on [Paystack Documentation](https://paystack.com/docs/).

## Features Implemented

### ✅ Core Features
- **Transaction Initialization** - Create payment sessions
- **Subscription Management** - Recurring billing with plans
- **Customer Management** - Store and reuse customer data
- **Webhook Processing** - Real-time payment notifications
- **Transaction Verification** - Secure payment confirmation
- **Guest Checkout** - Accept payments without user accounts

### ✅ Supported Events
- `charge.success` - Payment successful
- `subscription.create` - New subscription created
- `subscription.disable` - Subscription cancelled
- `subscription.not_renew` - Subscription renewal failed

## Configuration

### 1. Environment Variables

Add to your `.env.local`:

```env
# Paystack API Keys
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx

# Paystack Plan Codes (create these in Paystack Dashboard)
PAYSTACK_PLAN_CODE_PRO=PLN_xxxxxxxxxxxxx
PAYSTACK_PLAN_CODE_BUSINESS=PLN_xxxxxxxxxxxxx
```

### 2. Database Setup

The `users` table already has these Paystack columns:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_authorization_code TEXT;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_authorization_code TEXT;
```

### 3. Create Subscription Plans

1. Go to [Paystack Dashboard](https://dashboard.paystack.com/) → Plans
2. Create two plans:
   - **Pro Plan**: ₦29,990.00 (monthly)
   - **Business Plan**: ₦99,990.00 (monthly)
3. Copy the plan codes (PLN_xxxxx) to your environment variables

### 4. Configure Webhooks

1. Go to Settings → Webhooks in Paystack Dashboard
2. Add webhook URL: `https://your-domain.com/api/webhooks/paystack`
3. Select these events:
   - `charge.success`
   - `subscription.create`
   - `subscription.disable`
   - `subscription.not_renew`

## API Endpoints

### Create Checkout Session

**POST** `/api/checkout/create-session`

Creates a Paystack payment session for subscription checkout.

**Request Body:**
```json
{
  "planId": "pro",           // or "business"
  "provider": "paystack",     // payment provider
  "email": "user@example.com",
  "successUrl": "https://your-domain.com/success",
  "cancelUrl": "https://your-domain.com/cancel",
  "paymentMethod": "card"     // optional: card, bank, ussd
}
```

**Response:**
```json
{
  "provider": "paystack",
  "reference": "pro_user123_1704208800000",
  "url": "https://checkout.paystack.com/xxxxx",
  "testMode": true
}
```

**Usage Example:**
```typescript
const response = await fetch('/api/checkout/create-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}` // optional for logged-in users
  },
  body: JSON.stringify({
    planId: 'pro',
    provider: 'paystack',
    email: 'customer@example.com',
    successUrl: window.location.origin + '/success',
    cancelUrl: window.location.origin + '/pricing',
    paymentMethod: 'card'
  })
});

const { url } = await response.json();
window.location.href = url; // Redirect to Paystack checkout
```

### Webhook Handler

**POST** `/api/webhooks/paystack`

Receives and processes Paystack webhook events.

**Headers Required:**
- `x-paystack-signature` - Webhook signature for verification

**Event Handling:**
- ✅ `charge.success` - Creates/updates subscription
- ✅ `subscription.create` - Activates subscription
- ✅ `subscription.disable` - Cancels subscription
- ✅ `subscription.not_renew` - Marks subscription as past_due

## Frontend Integration

### Simple Checkout Flow

```typescript
// pages/pricing.tsx or component
import { useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export function PricingCard({ plan }: { plan: 'pro' | 'business' }) {
  const { session } = useSupabaseAuth();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            'Authorization': `Bearer ${session.access_token}`
          })
        },
        body: JSON.stringify({
          planId: plan,
          provider: 'paystack',
          email: session?.user?.email || prompt('Enter your email:'),
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Paystack checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCheckout}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Processing...' : 'Subscribe Now'}
    </button>
  );
}
```

### Modal Checkout (Already Implemented)

The app already has a modal checkout at `/pricing` page with:
- Mobile money options
- Card payment
- Bank transfer
- USSD payment
- Email-only signup (no account required)

## Testing

### Test Cards

Paystack provides test cards for different scenarios:

| Card Number         | CVV | Expiry | PIN  | Scenario           |
|--------------------|-----|--------|------|-------------------|
| 5060666666666666666| 123 | 12/26  | 1234 | Successful charge |
| 4084084084084081   | 123 | 12/26  | 1234 | Requires OTP      |
| 408408408408408    | 123 | 12/26  | -    | Declined          |

Use any valid expiry date in the future and any 3-digit CVV.

### Test Webhook Locally

1. Install ngrok: `npm install -g ngrok`
2. Expose local server: `ngrok http 3000`
3. Update Paystack webhook URL to: `https://your-ngrok-url.ngrok.io/api/webhooks/paystack`
4. Test payments and check webhook logs

## Currency Conversion

Paystack uses **kobo** as the smallest currency unit for Nigerian Naira (NGN):
- 1 NGN = 100 kobo
- Amount ₦29.99 = 2999 kobo

The library automatically converts:
```typescript
const amountInKobo = Math.round(amount * 100);
```

## Error Handling

All Paystack operations include comprehensive error handling:

```typescript
try {
  const payment = await initializeSubscriptionPayment({...});
  // Success
} catch (error) {
  if (error.message.includes('PAYSTACK_SECRET_KEY')) {
    // API key not configured
  } else if (error.message.includes('Invalid plan')) {
    // Plan code not found
  } else {
    // Other Paystack API errors
  }
}
```

## Security

### Webhook Verification

All webhooks are verified using HMAC SHA512:
```typescript
const signature = request.headers.get('x-paystack-signature');
const isValid = verifyPaystackWebhook(body, signature, secretKey);
```

### API Key Security

- Secret keys stored in environment variables
- Never expose secret keys to frontend
- Public keys only used for client-side operations
- All credentials encrypted in database

## Admin Panel

### Payment Settings

1. Navigate to `/admin/payment-settings`
2. Configure Paystack:
   - Public Key
   - Secret Key
   - Plan Code Pro
   - Plan Code Business
3. Toggle provider status
4. Test connection

### Subscription Management

View and manage subscriptions at `/admin/subscriptions`:
- Active subscriptions
- Payment history
- Customer details
- Subscription status
- Cancel/reactivate subscriptions

## Best Practices

1. **Always verify transactions** - Never trust client-side data
2. **Use webhooks** - Primary source of truth for payment status
3. **Handle retries** - Paystack retries failed webhooks
4. **Test thoroughly** - Use test mode before going live
5. **Monitor logs** - Check webhook delivery in Paystack Dashboard
6. **Currency consistency** - Keep all amounts in same currency
7. **Customer records** - Store customer codes for recurring billing

## Troubleshooting

### Payment Not Showing Up

1. Check webhook logs in Paystack Dashboard
2. Verify webhook URL is correct
3. Check server logs: `npm run dev`
4. Ensure signature verification passes

### Subscription Not Created

1. Verify plan codes in environment variables
2. Check Paystack Dashboard for plan status
3. Ensure customer has authorization code
4. Review transaction logs

### Test Mode vs Live Mode

- Test keys: `sk_test_` and `pk_test_`
- Live keys: `sk_live_` and `pk_live_`
- Create separate plans for test and live modes
- Never mix test and live credentials

## Additional Resources

- [Paystack Documentation](https://paystack.com/docs/)
- [Paystack API Reference](https://paystack.com/docs/api/)
- [Test Cards](https://paystack.com/docs/payments/test-payments/)
- [Webhook Events](https://paystack.com/docs/payments/webhooks/)
- [Plan Management](https://paystack.com/docs/payments/subscriptions/)

## Support

For issues with the integration:
1. Check server logs
2. Review Paystack Dashboard
3. Test with Paystack test cards
4. Verify environment variables
5. Check webhook signatures
