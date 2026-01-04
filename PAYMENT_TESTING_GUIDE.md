# 🧪 Payment Testing Guide - ScanMagic

Complete guide to test Paystack payments and subscriptions before production deployment.

---

## 📋 Prerequisites Checklist

- [x] Paystack account created
- [ ] Database schema applied in Supabase
- [ ] Paystack test API keys configured
- [ ] Paystack test subscription plans created

---

## 1️⃣ Set Up Supabase Database

### Run the SQL Schema

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `ufdwqpxqgqhvqoovdssf`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `SUPABASE_PAYMENT_SCHEMA.sql`
6. Click **Run** to execute

This will create:
- `subscriptions` table
- `payments` table  
- RLS policies
- Helper functions

---

## 2️⃣ Get Paystack Test Keys

### Access Paystack Dashboard

1. Go to [dashboard.paystack.com](https://dashboard.paystack.com)
2. **Toggle Test Mode ON** (top navigation)
3. Navigate to **Settings → API Keys & Webhooks**

### Copy Your Test Keys

You'll see:
- **Public Key**: `pk_test_XXXXX` (safe for client-side)
- **Secret Key**: `sk_test_XXXXX` (server-side only)

---

## 3️⃣ Create Test Subscription Plans in Paystack

### Create Pro Plan

1. In Paystack Dashboard (Test Mode), go to **Plans**
2. Click **Create Plan**
3. Fill in:
   - **Plan Name**: `ScanMagic Pro`
   - **Plan Description**: `Professional QR code generation`
   - **Amount**: `3500` (₦3,500 or adjust for your currency)
   - **Interval**: `Monthly`
   - **Currency**: `NGN` (or your preferred currency: USD, GHS, ZAR, etc.)
4. Click **Create Plan**
5. **Copy the Plan Code** (e.g., `PLN_xxxxxxxxxxxxx`)

### Create Business Plan

1. Click **Create Plan** again
2. Fill in:
   - **Plan Name**: `ScanMagic Business`
   - **Plan Description**: `Advanced QR codes for businesses`
   - **Amount**: `9900` (₦9,900 or adjust for your currency)
   - **Interval**: `Monthly`
   - **Currency**: `NGN`
3. Click **Create Plan**
4. **Copy the Plan Code**

---

## 4️⃣ Update Environment Variables

Edit `.env.local` and update these values:

```env
# Paystack Configuration (TEST MODE)
PAYSTACK_SECRET_KEY=sk_test_PASTE_YOUR_SECRET_KEY_HERE
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_PASTE_YOUR_PUBLIC_KEY_HERE
PAYSTACK_PLAN_CODE_PRO=PLN_PASTE_PRO_PLAN_CODE
PAYSTACK_PLAN_CODE_BUSINESS=PLN_PASTE_BUSINESS_PLAN_CODE
```

**Restart your dev server** after updating environment variables.

---

## 5️⃣ Set Up Webhook URL

### For Local Testing

1. In Paystack Dashboard (Test Mode), go to **Settings → API Keys & Webhooks**
2. Under **Webhooks**, click **Go live** (even in test mode)
3. For local testing, you'll need to use a tunneling service like:
   - [ngrok](https://ngrok.com/) (recommended)
   - [localtunnel](https://localtunnel.github.io/www/)
   - [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

### Using ngrok for Local Webhooks

1. **Install ngrok**:
   ```powershell
   # Using Chocolatey
   choco install ngrok
   
   # OR download from: https://ngrok.com/download
   ```

2. **Start your dev server**:
   ```powershell
   npm run dev
   ```

3. **In another terminal, start ngrok**:
   ```powershell
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Add webhook in Paystack**:
   - URL: `https://abc123.ngrok.io/api/webhooks/paystack`
   - Events: Select all (or at minimum: `charge.success`, `subscription.create`, `subscription.disable`)

---

## 6️⃣ Test the Payment Flow

### Test Scenario 1: Successful Subscription

1. **Start your local server**:
   ```powershell
   npm run dev
   ```

2. **If testing webhooks, start ngrok**:
   ```powershell
   ngrok http 3000
   ```

3. **Open your app**: http://localhost:3000

4. **Create a test account** (or log in)

5. **Go to Pricing page**: http://localhost:3000/pricing

6. **Click "Upgrade" on Pro or Business plan**

7. **On the Paystack payment page, use test card**:
   - **Card Number**: `5060 6666 6666 6666 603` (Verve)
   - **CVV**: `123`
   - **Expiry**: Any future date (e.g., `12/25`)
   - **PIN**: `1234`
   - **OTP**: `123456`

8. **Complete payment**

9. **Check Supabase**:
   - Go to **Table Editor → subscriptions**
   - You should see a new subscription with `status: 'active'`

10. **Check your app**:
    - Go to your account/dashboard
    - Your subscription tier should be updated

### Test Scenario 2: Card Declined

Use this test card to simulate a declined payment:
- **Card Number**: `5060 6666 6666 6666 600`
- You should see an error message

---

## 7️⃣ Paystack Test Cards

| Scenario | Card Number | CVV | PIN | OTP | Description |
|----------|-------------|-----|-----|-----|-------------|
| ✅ Success (Verve) | `5060 6666 6666 6666 603` | `123` | `1234` | `123456` | Successful payment |
| ✅ Success (Mastercard) | `5399 8383 8383 8381` | `100` | `1234` | `123456` | Successful payment |
| ✅ Success (Visa) | `4084 0840 8408 4081` | `408` | - | - | Successful payment |
| ❌ Declined | `5060 6666 6666 6666 600` | `123` | `1234` | - | Declined |
| ⏳ Timeout | `5060 6666 6666 6666 601` | `123` | `1234` | - | Gateway timeout |

**For all cards**: Use any future expiry date (e.g., `12/25`)

---

## 8️⃣ Test Webhook Events

Paystack automatically sends webhook events to your configured URL. Monitor your dev server console for webhook logs.

### Key Webhook Events:

| Event | Description | Action |
|-------|-------------|--------|
| `charge.success` | Payment successful | Creates/updates subscription |
| `subscription.create` | Subscription created | Logs subscription creation |
| `subscription.disable` | Subscription canceled | Updates status to canceled |
| `subscription.not_renew` | Auto-renewal disabled | Marks to cancel at period end |
| `charge.failed` | Payment failed | Updates status to past_due |

---

## 9️⃣ Monitor Payments in Paystack Dashboard

### View Test Transactions

1. Go to [dashboard.paystack.com](https://dashboard.paystack.com) (Test Mode)
2. Click **Transactions** to see all test payments
3. Click **Subscriptions** to see active test subscriptions
4. Click **Customers** to see customer records

### Check Webhook Deliveries

1. Go to **Settings → API Keys & Webhooks**
2. Scroll to **Webhook Event Logs**
3. Click on any event to see delivery attempts and responses

---

## 🔟 Debugging Tips

### Issue: Webhooks not receiving events

**Solution**:
1. Make sure ngrok is running: `ngrok http 3000`
2. Update webhook URL in Paystack Dashboard with current ngrok URL
3. Check that webhook URL is `https://YOUR_NGROK_URL/api/webhooks/paystack`
4. Verify webhook events are enabled in Paystack Dashboard

### Issue: "Paystack not configured" error

**Solution**:
1. Verify `PAYSTACK_SECRET_KEY` is set in `.env.local`
2. Make sure you're using **test** keys (`sk_test_...`)
3. Restart your dev server after updating `.env.local`

### Issue: Subscription not showing in Supabase

**Solution**:
1. Check webhook logs in Paystack Dashboard
2. Check your dev server console for errors
3. Verify SQL schema was applied correctly
4. Check Supabase Table Editor → subscriptions table
5. Make sure webhook signature verification is passing

### Issue: "Invalid plan code" error

**Solution**:
1. Make sure you created plans in **Test Mode**
2. Copy the Plan Codes (start with `PLN_`)
3. Update `.env.local` with correct codes
4. Restart dev server

---

## 1️⃣1️⃣ Testing Checklist

Before going to production, test these scenarios:

- [ ] ✅ Successful subscription purchase (Pro plan)
- [ ] ✅ Successful subscription purchase (Business plan)
- [ ] ❌ Payment decline (card ending in 600)
- [ ] 📊 Subscription shows in Supabase database
- [ ] 📊 User's `subscription_tier` updated in users table
- [ ] 🔔 Webhook events received (check Paystack logs)
- [ ] 🔔 `charge.success` event processed
- [ ] 🔔 `subscription.disable` event processed
- [ ] 💳 Paystack Customer Code saved to user record
- [ ] 🚪 User can access premium features after upgrade
- [ ] 🔄 Subscription cancellation works

---

## 1️⃣2️⃣ Currency Support

Paystack supports multiple currencies. Update the `currency` parameter in the checkout API:

| Country | Currency Code | Symbol |
|---------|---------------|--------|
| Nigeria | `NGN` | ₦ |
| Ghana | `GHS` | ₵ |
| South Africa | `ZAR` | R |
| Kenya | `KES` | KSh |
| United States | `USD` | $ |

Update in [src/app/api/checkout/create-session/route.ts](src/app/api/checkout/create-session/route.ts):
```typescript
currency: 'NGN', // Change to your preferred currency
```

---

## 1️⃣3️⃣ Next Steps - Production Setup

Once local testing is complete:

1. **Switch to Live Mode** in Paystack Dashboard

2. **Get Live API Keys**:
   - Go to **Settings → API Keys & Webhooks**
   - Toggle to **Live Mode**
   - Copy your live keys

3. **Create Live Plans**:
   - Create Pro and Business plans in Live Mode
   - Copy the live plan codes

4. **Update Production Environment Variables**:
   ```env
   PAYSTACK_SECRET_KEY=sk_live_XXXXX
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_XXXXX
   PAYSTACK_PLAN_CODE_PRO=PLN_live_XXXXX
   PAYSTACK_PLAN_CODE_BUSINESS=PLN_live_XXXXX
   ```

5. **Set Up Production Webhook**:
   - URL: `https://scanmagic.online/api/webhooks/paystack`
   - Enable all subscription and charge events

6. **Complete Paystack Business Verification**:
   - Required for live transactions
   - Submit business documents in Dashboard

---

## 🆘 Need Help?

- [Paystack Documentation](https://paystack.com/docs/)
- [Paystack Test Cards](https://paystack.com/docs/payments/test-payments/)
- [Paystack Webhooks Guide](https://paystack.com/docs/payments/webhooks/)
- [Paystack Subscriptions](https://paystack.com/docs/payments/subscriptions/)

---

**Happy Testing! 🎉**
