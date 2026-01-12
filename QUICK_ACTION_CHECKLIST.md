# Quick Action Checklist - Security Fixes

## ✅ Already Completed
- [x] Full security audit (80+ files reviewed)
- [x] Created validation library (`src/lib/validation.ts`)
- [x] Created error handling library (`src/lib/api-response.ts`)
- [x] Created webhook verification (`src/lib/webhook-verification.ts`)
- [x] Created rate limiting (`src/lib/rate-limit.ts`)
- [x] Fixed admin setup endpoint (rate limiting + validation)
- [x] Fixed JWT fallback vulnerability
- [x] Created Stripe webhook with verification
- [x] Updated Paystack webhook with security fixes
- [x] Documentation created (AUDIT_FINDINGS.md, IMPLEMENTATION_GUIDE.md, AUDIT_SUMMARY.md)

---

## 🔴 CRITICAL - Do Today

### 1. Environment Setup (15 min)
```bash
# Add to .env or deployment environment:
ADMIN_SETUP_SECRET="$(openssl rand -hex 32)"
CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -hex 32)"
STRIPE_WEBHOOK_SECRET="whsec_..." # From Stripe Dashboard
```

### 2. Test Security Fixes (30 min)
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run these tests
# Test 1: Admin setup rate limiting
for i in {1..6}; do curl -X POST http://localhost:3000/api/setup/admin-supabase -H "Content-Type: application/json" -d '{"setupSecret":"wrong"}'; done
# Expected: 6th request returns 429

# Test 2: JWT vulnerability fixed
curl -X POST http://localhost:3000/api/checkout/create-session \
  -H "Authorization: Bearer fake.jwt.token" \
  -H "Content-Type: application/json" \
  -d '{"planId":"pro","successUrl":"http://localhost:3000/success","cancelUrl":"http://localhost:3000/cancel"}'
# Expected: 401 Unauthorized
```

### 3. Configure Webhooks (20 min)

**Stripe:**
```bash
# Install Stripe CLI for testing
# Mac: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe

# Login and listen
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook secret to .env

# Test
stripe trigger checkout.session.completed
```

**Paystack:**
- Dashboard → Settings → Webhooks
- URL: `https://yoursite.com/api/webhooks/paystack`
- Secret already configured
- Use test button to verify

---

## 🟠 HIGH PRIORITY - This Week

### 4. Add Input Validation (4-6 hours)
Update these files with validation:

```typescript
// Pattern for ALL API routes:
import { validateUUID, validateEmail, ValidationError } from '@/lib/validation';
import { createErrorResponse, handleApiError } from '@/lib/api-response';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = validateUUID(params.id); // Validates and returns string
    // ... rest of code
  } catch (error) {
    return handleApiError('route-name', error);
  }
}
```

**Files to update:**
- [ ] `src/app/api/admin/users/[userId]/route.ts`
- [ ] `src/app/api/admin/qrcodes/[id]/route.ts`
- [ ] `src/app/api/admin/subscriptions/[id]/route.ts`
- [ ] `src/app/api/admin/transactions/[id]/route.ts`
- [ ] `src/app/api/codes/route.ts`
- [ ] `src/app/api/c/[id]/route.ts`
- [ ] All other routes with URL parameters

### 5. Create Missing Webhooks (2-3 hours)

**Flutterwave:** Copy template from IMPLEMENTATION_GUIDE.md section 7
- [ ] Create `src/app/api/webhooks/flutterwave/route.ts`
- [ ] Add webhook secret to .env
- [ ] Test with Flutterwave test button

**PayPal:** Copy template from IMPLEMENTATION_GUIDE.md section 8
- [ ] Create `src/app/api/webhooks/paypal/route.ts`
- [ ] Add webhook ID and credentials to .env
- [ ] Test with PayPal sandbox

---

## 🟡 MEDIUM PRIORITY - Next 2 Weeks

### 6. Consolidate Authentication (8-12 hours)
Currently using both Firebase AND Supabase for admin checks - need to pick ONE.

**Recommended:** Keep Supabase for admin, Firebase only for phone auth

**Steps:**
- [ ] Search codebase for `import { checkAdminAuth } from '@/lib/admin-auth'`
- [ ] Replace with `import { verifyAdminAccess } from '@/lib/supabase/auth'`
- [ ] Update all usages
- [ ] Remove `src/lib/admin-auth.ts` file
- [ ] Test admin access works

### 7. Improve Error Messages (2-3 hours)
- [ ] Replace all `console.error()` with `logError()` from api-response.ts
- [ ] Replace raw error returns with `createErrorResponse()`
- [ ] Test that database errors don't leak to client

---

## 🔵 LOW PRIORITY - Nice to Have

### 8. Enable Middleware (1-2 hours)
Currently disabled in `src/middleware.ts`

```typescript
// Add these features:
- Rate limiting on auth endpoints
- Security headers (CSP, HSTS)
- Request logging
- Bot protection
```

### 9. Add Health Check (30 min)
Create `src/app/api/health/route.ts`:
```typescript
export async function GET() {
  const checks = {
    database: await testSupabase(),
    firebase: await testFirebase(),
    timestamp: new Date().toISOString()
  };
  return NextResponse.json(checks);
}
```

### 10. Update Dependencies (30 min)
```bash
npm audit
npm update
npm audit fix
```

---

## Testing Commands Reference

### Test Rate Limiting
```bash
# Should block after 5 attempts
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/setup/admin-supabase \
    -H "Content-Type: application/json" \
    -d '{"setupSecret":"wrong"}'
done
```

### Test Input Validation
```bash
# Should return 400 with validation error
curl -X GET http://localhost:3000/api/admin/users/invalid-uuid
curl -X GET http://localhost:3000/api/admin/users/%27%3BDROP%20TABLE%20users%3B--
```

### Test Webhook Verification
```bash
# Stripe (with invalid signature)
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "stripe-signature: invalid" \
  -d '{"type":"checkout.session.completed"}'
# Expected: 400

# Paystack (with invalid signature)
curl -X POST http://localhost:3000/api/webhooks/paystack \
  -H "x-paystack-signature: invalid" \
  -d '{"event":"charge.success"}'
# Expected: 400
```

---

## Deployment Checklist

Before deploying to production:
- [ ] All environment variables set
- [ ] Webhooks configured in payment dashboards
- [ ] Security tests pass locally
- [ ] Database backup created
- [ ] Rollback plan ready
- [ ] Monitoring/alerts configured
- [ ] Team notified of changes

**Deploy Process:**
1. Deploy to staging first
2. Run full test suite
3. Monitor for 24 hours
4. Deploy to production during low-traffic period
5. Monitor error rates
6. Verify webhooks are being received

---

## If Something Goes Wrong

### Rollback Steps:
1. Revert to previous deployment
2. Check error logs
3. Review recent changes
4. Test locally
5. Fix issue
6. Redeploy

### Key Files to Revert If Needed:
- `src/app/api/setup/admin-supabase/route.ts`
- `src/app/api/checkout/create-session/route.ts`
- `src/app/api/webhooks/*`

### Emergency Contacts:
- Payment Provider Support: Check dashboards for support links
- Supabase Support: https://supabase.com/support
- Firebase Support: https://firebase.google.com/support

---

## Progress Tracking

| Task | Priority | Estimated Time | Status |
|------|----------|---------------|---------|
| Environment setup | 🔴 Critical | 15 min | ⬜ Not Started |
| Test security fixes | 🔴 Critical | 30 min | ⬜ Not Started |
| Configure webhooks | 🔴 Critical | 20 min | ⬜ Not Started |
| Add input validation | 🟠 High | 4-6 hours | ⬜ Not Started |
| Create Flutterwave webhook | 🟠 High | 1-2 hours | ⬜ Not Started |
| Create PayPal webhook | 🟠 High | 1-2 hours | ⬜ Not Started |
| Consolidate auth | 🟡 Medium | 8-12 hours | ⬜ Not Started |
| Improve error messages | 🟡 Medium | 2-3 hours | ⬜ Not Started |
| Enable middleware | 🔵 Low | 1-2 hours | ⬜ Not Started |
| Add health check | 🔵 Low | 30 min | ⬜ Not Started |
| Update dependencies | 🔵 Low | 30 min | ⬜ Not Started |

**Total Time Estimate:** ~25-35 hours

---

## Quick Reference

**Documentation:**
- Full details: [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md)
- How-to guide: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- Overview: [AUDIT_SUMMARY.md](./AUDIT_SUMMARY.md)

**New Utilities:**
- Input validation: `src/lib/validation.ts`
- Error handling: `src/lib/api-response.ts`
- Webhook security: `src/lib/webhook-verification.ts`
- Rate limiting: `src/lib/rate-limit.ts`

**Fixed Files:**
- ✅ `src/app/api/setup/admin-supabase/route.ts`
- ✅ `src/app/api/checkout/create-session/route.ts`
- ✅ `src/app/api/webhooks/stripe/route.ts` (NEW)
- ✅ `src/app/api/webhooks/paystack/route.ts`

---

**Last Updated:** ${new Date().toISOString()}
