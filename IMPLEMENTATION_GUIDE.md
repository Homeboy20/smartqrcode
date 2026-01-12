# SECURITY FIXES IMPLEMENTATION GUIDE

## Overview
This document provides step-by-step instructions for implementing the critical security fixes identified in the audit.

---

## Phase 1: Critical Security Fixes (Week 1)

### 1. Deploy New Utility Libraries

**Files Created:**
- `src/lib/validation.ts` - Input validation utilities
- `src/lib/api-response.ts` - Standardized error responses
- `src/lib/webhook-verification.ts` - Webhook signature verification
- `src/lib/rate-limit.ts` - Rate limiting utilities

**Action:** These files are already created and ready to use.

---

### 2. Fix Admin Setup Endpoint (CRITICAL)

**File Modified:** `src/app/api/setup/admin-supabase/route.ts`

**Changes:**
✅ Added rate limiting (5 attempts per hour per IP)
✅ Added input validation (UUID, email)
✅ Replaced raw error messages with secure responses
✅ Added structured logging

**Testing:**
```bash
# Test rate limiting
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/setup/admin-supabase \
    -H "Content-Type: application/json" \
    -d '{"userId":"invalid","email":"test@test.com","setupSecret":"wrong"}'
done
# 6th request should return 429 Too Many Requests

# Test with valid secret (update YOUR_SECRET_HERE)
curl -X POST http://localhost:3000/api/setup/admin-supabase \
  -H "Content-Type: application/json" \
  -d '{"userId":"valid-uuid-here","email":"admin@example.com","setupSecret":"YOUR_SECRET_HERE"}'
```

---

### 3. Fix JWT Vulnerability in Checkout (CRITICAL)

**File Modified:** `src/app/api/checkout/create-session/route.ts`

**Changes:**
✅ Removed insecure JWT fallback (`decodeJwtWithoutVerify`)
✅ Now requires proper token verification or guest checkout with email
✅ Added security comment explaining the fix

**Testing:**
```bash
# Test authenticated checkout
curl -X POST http://localhost:3000/api/checkout/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -d '{
    "planId":"pro",
    "successUrl":"http://localhost:3000/success",
    "cancelUrl":"http://localhost:3000/cancel"
  }'

# Test guest checkout (requires email)
curl -X POST http://localhost:3000/api/checkout/create-session \
  -H "Content-Type: application/json" \
  -d '{
    "planId":"pro",
    "email":"guest@example.com",
    "successUrl":"http://localhost:3000/success",
    "cancelUrl":"http://localhost:3000/cancel"
  }'

# Test with forged JWT (should fail)
curl -X POST http://localhost:3000/api/checkout/create-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhdHRhY2tlciJ9." \
  -d '{"planId":"pro","successUrl":"http://localhost:3000/success","cancelUrl":"http://localhost:3000/cancel"}'
# Should return 401 Unauthorized
```

---

### 4. Add Stripe Webhook with Signature Verification (CRITICAL)

**File Created:** `src/app/api/webhooks/stripe/route.ts`

**Changes:**
✅ Full webhook implementation with signature verification
✅ Rate limiting
✅ Handles: checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed
✅ Secure error handling

**Setup:**
1. Get your Stripe webhook secret:
   ```bash
   # Development (using Stripe CLI)
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # Copy the webhook signing secret (whsec_...)
   
   # Production (Stripe Dashboard)
   # 1. Go to Developers → Webhooks
   # 2. Add endpoint: https://yoursite.com/api/webhooks/stripe
   # 3. Select events: checkout.session.completed, customer.subscription.*
   # 4. Copy webhook signing secret
   ```

2. Add to environment variables:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. Test with Stripe CLI:
   ```bash
   stripe trigger checkout.session.completed
   ```

---

### 5. Update Paystack Webhook (CRITICAL)

**File Modified:** `src/app/api/webhooks/paystack/route.ts`

**Changes:**
✅ Added rate limiting
✅ Replaced console.error with secure logging
✅ Standardized error responses
✅ Improved signature verification

**Testing:**
```bash
# Use Paystack's webhook tester in dashboard
# Or test locally with proper signature:
SIGNATURE=$(echo -n '{"event":"charge.success","data":{"reference":"test"}}' | openssl dgst -sha512 -hmac "YOUR_SECRET_KEY" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIGNATURE" \
  -d '{"event":"charge.success","data":{"reference":"test","metadata":{"userId":"user-id","planId":"pro"}}}'
```

---

## Phase 2: Input Validation (Week 2)

### 6. Add Validation to All API Routes

**Example - Update User Endpoint:**

```typescript
// Before:
const userId = params.userId; // ❌ Dangerous

// After:
import { validateUUID, ValidationError } from '@/lib/validation';
import { createErrorResponse, handleApiError } from '@/lib/api-response';

try {
  const userId = validateUUID(params.userId, 'userId');
  // ... rest of code
} catch (error) {
  if (error instanceof ValidationError) {
    return createErrorResponse('VALIDATION_ERROR', error.message, 400);
  }
  return handleApiError('update-user', error);
}
```

**Routes to Update:**
- [ ] `/api/admin/users/[userId]/route.ts`
- [ ] `/api/admin/qrcodes/[id]/route.ts`
- [ ] `/api/admin/subscriptions/[id]/route.ts`
- [ ] `/api/admin/transactions/[id]/route.ts`
- [ ] `/api/codes/route.ts`
- [ ] All other routes with user input

---

## Phase 3: Webhook Implementation (Week 2-3)

### 7. Create Flutterwave Webhook

**File to Create:** `src/app/api/webhooks/flutterwave/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyFlutterwaveSignature } from '@/lib/webhook-verification';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { createErrorResponse, handleApiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);
  
  try {
    const rateLimit = checkRateLimit(clientIP, RATE_LIMITS.WEBHOOK);
    if (!rateLimit.allowed) {
      return createErrorResponse('RATE_LIMIT_EXCEEDED', undefined, 429);
    }

    const signature = request.headers.get('verif-hash');
    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    
    if (!verifyFlutterwaveSignature(signature, webhookSecret!)) {
      return createErrorResponse('AUTHORIZATION_ERROR', 'Invalid signature', 400);
    }

    const event = await request.json();
    
    // Handle Flutterwave events
    switch (event.event) {
      case 'charge.completed':
        // Process successful payment
        break;
      case 'subscription.active':
        // Activate subscription
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError('flutterwave-webhook', error, { clientIP });
  }
}
```

---

### 8. Create PayPal Webhook

**File to Create:** `src/app/api/webhooks/paypal/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhook } from '@/lib/webhook-verification';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { createErrorResponse, handleApiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);
  
  try {
    const rateLimit = checkRateLimit(clientIP, RATE_LIMITS.WEBHOOK);
    if (!rateLimit.allowed) {
      return createErrorResponse('RATE_LIMIT_EXCEEDED', undefined, 429);
    }

    const headers = Object.fromEntries(request.headers.entries());
    const body = await request.text();

    const isValid = await verifyPayPalWebhook(
      process.env.PAYPAL_WEBHOOK_ID!,
      headers,
      body,
      process.env.PAYPAL_CLIENT_ID!,
      process.env.PAYPAL_CLIENT_SECRET!
    );

    if (!isValid) {
      return createErrorResponse('AUTHORIZATION_ERROR', 'Invalid signature', 400);
    }

    const event = JSON.parse(body);
    
    // Handle PayPal events
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        // Activate subscription
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        // Cancel subscription
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError('paypal-webhook', error, { clientIP });
  }
}
```

---

## Phase 4: Authentication Consolidation (Week 3-4)

### 9. Consolidate to Single Auth System

**Problem:** Dual Firebase + Supabase admin checks

**Solution:** Use Supabase only for authorization

**Files to Update:**
1. Remove `src/lib/admin-auth.ts` (Firebase admin checks)
2. Keep `src/lib/api-auth.ts` but update to use Supabase
3. Update all admin routes to use `verifyAdminAccess` from `src/lib/supabase/auth.ts`

**Migration Steps:**
```typescript
// Old (Firebase):
import { checkAdminAuth } from '@/lib/admin-auth';
const admin = await checkAdminAuth(request);

// New (Supabase):
import { verifyAdminAccess } from '@/lib/supabase/auth';
await verifyAdminAccess(request); // Throws on failure
```

**Routes to Update:**
- Search for all usages of `admin-auth.ts`
- Replace with Supabase auth checks

---

## Phase 5: Logging & Monitoring (Week 4)

### 10. Implement Structured Logging

**Option A: Simple (Development)**
Use the built-in `logError` from `api-response.ts`

**Option B: Production (Recommended)**
Install a logging service:

```bash
npm install pino pino-pretty
```

Create `src/lib/logger.ts`:
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;
```

**Usage:**
```typescript
import logger from '@/lib/logger';

logger.info({ userId, action: 'checkout' }, 'Processing payment');
logger.error({ error, userId }, 'Payment failed');
```

---

## Testing Checklist

### Security Tests
- [ ] Rate limiting works on admin setup
- [ ] Invalid JWT is rejected in checkout
- [ ] Webhook signature verification blocks forged requests
- [ ] SQL injection attempts are blocked (test with `'; DROP TABLE users;--`)
- [ ] XSS attempts are sanitized (test with `<script>alert('xss')</script>`)

### Functional Tests
- [ ] Admin can be created with valid secret
- [ ] Authenticated users can checkout
- [ ] Guest users can checkout with email
- [ ] Webhooks create subscriptions correctly
- [ ] Failed payments are handled properly
- [ ] Subscription cancellation works

### Integration Tests
- [ ] Test full payment flow with Stripe test mode
- [ ] Test full payment flow with Paystack test mode
- [ ] Verify subscription is activated in database
- [ ] Verify user tier is upgraded
- [ ] Verify transaction is recorded

---

## Environment Variables Required

Add these to your `.env` or deployment environment:

```env
# Security
ADMIN_SETUP_SECRET=your-strong-random-secret-here
CREDENTIALS_ENCRYPTION_KEY=your-32-byte-hex-key-here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Payment Webhooks
STRIPE_WEBHOOK_SECRET=whsec_...
PAYSTACK_SECRET_KEY=sk_live_...
FLUTTERWAVE_WEBHOOK_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

---

## Deployment Steps

1. **Backup Database:**
   ```bash
   # Export current data
   npx supabase db dump > backup-$(date +%Y%m%d).sql
   ```

2. **Deploy to Staging:**
   - Deploy all new files
   - Test each critical fix
   - Monitor logs for errors

3. **Configure Webhooks:**
   - Update webhook URLs in Stripe dashboard
   - Update webhook URLs in Paystack dashboard
   - Test with provider's webhook testing tools

4. **Deploy to Production:**
   - Deploy during low-traffic period
   - Monitor error rates
   - Have rollback plan ready

5. **Post-Deployment:**
   - Test all payment flows
   - Verify admin access works
   - Check webhook delivery logs

---

## Monitoring & Alerts

**Key Metrics to Track:**
- Failed authentication attempts
- Webhook signature failures
- Rate limit hits
- Payment processing errors
- Database connection errors

**Recommended Tools:**
- **Sentry** for error tracking
- **LogRocket** for session replay
- **Stripe/Paystack Dashboards** for payment monitoring
- **Supabase Logs** for database queries

---

## Support & Questions

If you encounter issues:
1. Check the audit findings: `AUDIT_FINDINGS.md`
2. Review error logs in console
3. Test with provided curl commands
4. Verify environment variables are set

---

## Next Steps

After implementing these fixes:
1. Run security audit again to verify fixes
2. Implement remaining medium-priority issues
3. Update documentation
4. Train team on new security practices
5. Schedule regular security reviews
