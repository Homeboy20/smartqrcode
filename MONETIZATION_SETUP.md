# 💰 Monetization Setup Guide - Make Money from Your App!

## Overview
Your QR Code & Barcode Generator is ready to make money! The app has a complete **freemium model** with:
- **Free Mode**: Visitors try basic features without signup (drives traffic)
- **Premium Features**: Paid subscriptions unlock advanced features
- **4 Payment Gateways**: Paystack, Flutterwave, Stripe, PayPal

## 🚀 Quick Start (5 Steps to Launch)

### Step 1: Create the Database Table
Run this SQL in your Supabase SQL Editor:

```sql
-- Create app_settings table for free mode toggle
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

-- Insert default free mode settings
INSERT INTO public.app_settings (key, value)
VALUES (
  'free_mode',
  '{
    "enabled": true,
    "features": {
      "qrCodeGeneration": true,
      "barcodeGeneration": true,
      "basicTemplates": true,
      "basicFormats": true
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
```

### Step 2: Set Your Admin Account
Run this in Supabase SQL Editor (replace YOUR_EMAIL):

```sql
-- Make yourself admin
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'YOUR_EMAIL_HERE@example.com';
```

### Step 3: Configure Payment Providers
1. Go to `/admin/payment-settings` in your app
2. Choose your payment provider(s):
   - **Paystack** (Nigeria, Ghana, South Africa)
   - **Flutterwave** (Africa-wide)
   - **Stripe** (Global)
   - **PayPal** (Global)

3. For each provider, enter:
   - API Keys (from provider dashboard)
   - Webhook URLs (shown in the interface - copy them!)

4. Configure webhooks in provider dashboards:
   - Paystack: `https://yourdomain.com/api/webhooks/paystack`
   - Flutterwave: `https://yourdomain.com/api/webhooks/flutterwave`
   - Stripe: `https://yourdomain.com/api/webhooks/stripe`
   - PayPal: `https://yourdomain.com/api/webhooks/paypal`

### Step 4: Enable Free Mode
1. Go to `/admin/app-settings`
2. Toggle **"Enable Free Mode"** ON
3. Choose which features are free:
   - ✅ QR Code Generation (recommended)
   - ✅ Barcode Generation (recommended)
   - ✅ Basic Templates (recommended)
   - ✅ Basic Formats (PNG) (recommended)
4. Save settings

### Step 5: Set Your Pricing
1. Go to `/pricing` page
2. Edit pricing tiers (src/app/pricing/page.tsx):
   - **Free**: Basic features (visitors can try)
   - **Pro**: $9.99/month - Premium templates, SVG/PDF export
   - **Business**: $29.99/month - Bulk generation, API access

## 💳 Payment Gateway Setup Details

### Paystack (Best for Africa)
1. Sign up: https://paystack.com
2. Get keys from Dashboard → Settings → API Keys & Webhooks
3. Test Mode keys for development
4. Live Mode keys for production
5. Set webhook URL in Paystack dashboard
6. Copy webhook secret

**Features**: Card payments, Mobile money, Bank transfers

### Flutterwave (Africa-wide)
1. Sign up: https://flutterwave.com
2. Get keys from Settings → API
3. Test keys for sandbox
4. Live keys for production
5. Configure webhook URL
6. Copy webhook hash

**Features**: Card, Mobile money, USSD, Bank transfer

### Stripe (Global - Best for US/Europe)
1. Sign up: https://stripe.com
2. Get keys from Developers → API Keys
3. Publishable key + Secret key
4. Configure webhook endpoint
5. Copy webhook signing secret

**Features**: Cards, Apple Pay, Google Pay, Local methods

### PayPal (Global)
1. Sign up: https://developer.paypal.com
2. Create app in Dashboard
3. Get Client ID + Secret
4. Sandbox for testing
5. Live credentials for production
6. Configure IPN/Webhook URL

**Features**: PayPal balance, Cards, Local payment methods

## 🎯 Freemium Strategy (How to Make Money)

### Free Mode Benefits:
- **SEO**: More visitors, better Google ranking
- **Viral Growth**: Users share free tool
- **Trust Building**: Try before buy
- **Lead Generation**: Capture emails
- **Conversion Funnel**: Free → Pro → Business

### Premium Feature Ideas:
✅ Already locked behind paywall:
- Premium Templates (minimalist, business, colorful)
- SVG/PDF Export (vector formats)
- Bulk Generation (upload CSV)
- Sequence Generation (batch creation)
- Custom branding
- Analytics & tracking
- QR code editing
- Download history

### Conversion Tactics:
1. **Free Mode Banner**: "Try Now - No Signup!" (homepage)
2. **Login Prompts**: "Login to unlock premium templates"
3. **Feature Locks**: Visible premium features with "PRO" badges
4. **Social Proof**: "500K+ QR codes generated" (stats)
5. **Limited Free Usage**: Optional - Add daily limits
6. **Email Capture**: "Save your codes" (requires signup)

## 📊 Pricing Recommendations

### Basic (Free Forever)
- ✅ 10 QR codes per day
- ✅ PNG export
- ✅ Basic templates
- ✅ Standard customization

### Pro ($9.99/month or $99/year)
- ✅ Unlimited QR codes
- ✅ SVG & PDF export
- ✅ Premium templates
- ✅ Custom branding
- ✅ Advanced analytics
- ✅ Priority support

### Business ($29.99/month or $299/year)
- ✅ Everything in Pro
- ✅ Bulk generation (CSV upload)
- ✅ API access
- ✅ White-label option
- ✅ Team collaboration
- ✅ Dedicated support

## 🔧 Technical Setup Checklist

### Database
- [ ] Run CREATE_APP_SETTINGS_TABLE.sql
- [ ] Verify table exists: `SELECT * FROM app_settings;`
- [ ] Check default settings inserted

### Admin Access
- [ ] Set your email as admin
- [ ] Test login to `/admin`
- [ ] Access `/admin/app-settings`
- [ ] Access `/admin/payment-settings`

### Payment Integration
- [ ] Choose payment provider(s)
- [ ] Get API keys (test mode first!)
- [ ] Configure webhook URLs
- [ ] Test webhook delivery
- [ ] Switch to live mode when ready

### Free Mode
- [ ] Enable free mode in settings
- [ ] Test homepage as visitor
- [ ] Verify free mode banner shows
- [ ] Test basic feature access (no login)
- [ ] Test premium feature locks

### Subscription Flow
- [ ] Test user registration
- [ ] Test subscription purchase
- [ ] Verify webhook receiving payment
- [ ] Check user subscription status updates
- [ ] Test premium feature access after payment

## 🌍 Deployment

### Environment Variables
Add to your hosting platform:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Payment Providers (choose which ones you use)
PAYSTACK_SECRET_KEY=sk_live_xxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx

# Webhook Secrets
PAYSTACK_WEBHOOK_SECRET=whsec_xxx
FLUTTERWAVE_WEBHOOK_HASH=xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Credential encryption (required if using /admin/payment-settings)
# Used to encrypt/decrypt payment provider secrets stored in Supabase.
CREDENTIALS_ENCRYPTION_KEY=change-me-32-bytes-or-a-long-passphrase
# CREDENTIALS_ENCRYPTION_KEYS=key1,key2
# CREDENTIALS_ENCRYPTION_KEY_OLD=old-key-for-rotation
```

### Production Checklist
- [ ] Update Supabase to production project
- [ ] Switch payment keys to live mode
- [ ] Configure production webhook URLs
- [ ] Set up custom domain
- [ ] Enable SSL/HTTPS
- [ ] Test complete purchase flow
- [ ] Set up monitoring/analytics
- [ ] Configure backup strategy

## 💡 Growth Tips

### Marketing
1. **SEO**: Free tool ranks well on Google
2. **Social Media**: Share generated QR codes (watermarked)
3. **Content Marketing**: "How to create QR codes" blogs
4. **Partnerships**: Integrate with other tools
5. **Affiliate Program**: Users refer for commission

### Conversion Optimization
1. **A/B Testing**: Test different CTAs
2. **Limited Time Offers**: "50% off first month"
3. **Annual Plans**: Offer 2 months free
4. **Testimonials**: Show success stories
5. **Live Chat**: Answer questions instantly

### Retention
1. **Email Sequences**: Onboard new users
2. **Feature Updates**: Keep users engaged
3. **Usage Analytics**: See what features work
4. **Feedback Loop**: Ask for feature requests
5. **Community**: Build user community

## 📈 Revenue Projections

### Conservative (100 users)
- Free users: 80 (generate leads)
- Pro users: 15 × $9.99 = $149.85/month
- Business users: 5 × $29.99 = $149.95/month
- **Total: ~$300/month**

### Moderate (500 users)
- Free users: 400
- Pro users: 75 × $9.99 = $749.25/month
- Business users: 25 × $29.99 = $749.75/month
- **Total: ~$1,500/month**

### Optimistic (2000 users)
- Free users: 1600
- Pro users: 300 × $9.99 = $2,997/month
- Business users: 100 × $29.99 = $2,999/month
- **Total: ~$6,000/month**

## 🆘 Support & Troubleshooting

### Free Mode Not Working
- Check database: `SELECT * FROM app_settings WHERE key = 'free_mode';`
- Verify API route: Visit `/api/app-settings`
- Check browser console for errors
- Clear cache and reload

### Payments Not Processing
- Verify webhook URLs are correct
- Check webhook logs in provider dashboard
- Test with provider's test cards
- Verify API keys are live (not test)

### Users Not Getting Premium Access
- Check subscription status in database
- Verify webhook delivered successfully
- Check user's subscription tier
- Review logs for errors

## 📞 Next Steps

1. **Complete database setup** (Step 1 above)
2. **Set admin account** (Step 2 above)
3. **Choose payment provider** (Step 3 above)
4. **Enable free mode** (Step 4 above)
5. **Launch and promote!** 🚀

---

## 🎉 You're Ready to Make Money!

Your app has:
- ✅ Free mode to attract users
- ✅ Premium features behind paywall
- ✅ 4 payment gateway options
- ✅ Automated subscription management
- ✅ Webhook integration for payments
- ✅ Admin dashboard for control

**Good luck with your monetization!** 💰
