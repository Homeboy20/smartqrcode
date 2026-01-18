# 🚀 QUICK START - Launch Your Monetized App in 15 Minutes

## The Main Issue Right Now
The database table `app_settings` doesn't exist yet. That's why you're seeing errors. Let's fix that!

## ⚡ Do These 5 Steps (In Order!)

### ✅ STEP 1: Create Database Table (2 minutes)
1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy & paste from: `supabase_migrations/00_COMPLETE_MONETIZATION_SETUP.sql`
6. **IMPORTANT**: Change `YOUR_EMAIL_HERE@example.com` to your actual email
7. Click **RUN**
8. You should see "Success. No rows returned"

**Verify it worked:**
```sql
SELECT * FROM app_settings WHERE key = 'free_mode';
```
You should see: `"enabled": true`

---

### ✅ STEP 2: Restart Your Dev Server (30 seconds)
The table is now created! Restart to clear the errors:

```powershell
# Stop current server (Ctrl+C)
npm run dev
```

Visit http://localhost:3000 - errors should be gone!

---

### ✅ STEP 3: Login as Admin (1 minute)
1. Visit http://localhost:3000/login
2. Login with the email you set in Step 1
3. You should now have admin access!

**Test admin access:**
- Visit http://localhost:3000/admin - Should work ✅
- Visit http://localhost:3000/admin/app-settings - Should work ✅
- Visit http://localhost:3000/admin/payment-settings - Should work ✅

---

### ✅ STEP 4: Enable Free Mode (2 minutes)
1. Go to http://localhost:3000/admin/app-settings
2. Toggle **"Enable Free Mode"** to ON
3. Check which features are free:
   - ✅ QR Code Generation
   - ✅ Barcode Generation
   - ✅ Basic Templates
   - ✅ Basic Formats (PNG)
4. Click **Save Settings**

**Test free mode:**
- Open incognito window (not logged in)
- Visit http://localhost:3000
- You should see "Try Free Now - No Signup!" banner 🎉
- Generate a QR code without logging in ✅
- Try premium templates - should show "Login Required" 🔒

---

### ✅ STEP 5: Choose Payment Provider (10 minutes)

#### Option A: Paystack (Best for Africa - Nigeria, Ghana, SA)
1. Sign up: https://paystack.com
2. Dashboard → Settings → API Keys & Webhooks
3. Copy **Public Key** and **Secret Key** (use Test keys first)
4. Go to http://localhost:3000/admin/payment-settings
5. Select **Paystack**
6. Paste your keys
7. Copy the webhook URL shown
8. In Paystack dashboard → Settings → Webhooks → Add webhook URL
9. Save!

#### Option B: Stripe (Best for US/Europe/Global)
1. Sign up: https://stripe.com
2. Dashboard → Developers → API Keys
3. Copy **Publishable key** and **Secret key**
4. Go to http://localhost:3000/admin/payment-settings
5. Select **Stripe**
6. Paste your keys
7. Copy webhook URL
8. In Stripe → Developers → Webhooks → Add endpoint
9. Select events: `payment_intent.succeeded`, `customer.subscription.created`, etc.
10. Copy webhook signing secret
11. Save!

#### Option C: Flutterwave (Africa-wide)
1. Sign up: https://flutterwave.com
2. Settings → API
3. Copy keys (use Test for now)
4. Configure in /admin/payment-settings
5. Set webhook URL in Flutterwave dashboard

#### Option D: PayPal (Global)
1. Sign up: https://developer.paypal.com
2. Create app
3. Get Client ID + Secret
4. Configure in /admin/payment-settings

---

## 🎉 YOU'RE LIVE!

Your app now has:
- ✅ Free mode enabled (visitors can try without signup)
- ✅ Premium features locked behind login
- ✅ Payment processing configured
- ✅ Admin dashboard for control

## 📊 Test the Complete Flow

### Test as Visitor (Free User)
1. Open incognito window
2. Visit homepage
3. See "Try Free Now" banner
4. Generate QR code (no login needed!)
5. Try premium template → See "Login Required" prompt
6. Try SVG export → See "LOGIN" badge

### Test as Logged-in User
1. Register an account
2. Generate QR code
3. Premium templates still locked (need subscription)
4. Click "Upgrade to Pro"
5. Complete payment
6. Premium features now unlocked! 🚀

---

## 💰 Start Making Money!

### Your Freemium Model
- **Free Mode**: Attracts users, builds trust, generates leads
- **Pro Plan** ($9.99/mo): Premium templates, SVG/PDF export
- **Business Plan** ($29.99/mo): Bulk generation, API access

### Growth Strategy
1. **SEO**: Free tool ranks on Google
2. **Social Sharing**: Users share QR codes
3. **Email Capture**: "Save your codes" requires signup
4. **Feature Teasing**: Show locked features to drive upgrades
5. **Limited Usage**: Optional daily limits for free users

### Revenue Timeline
- **Month 1**: $100-300 (first 20-30 users)
- **Month 3**: $500-1000 (100+ users)
- **Month 6**: $2000-5000 (500+ users)
- **Year 1**: $5000-10000/month (2000+ users)

---

## 🆘 Troubleshooting

### "Table app_settings not found"
→ Run Step 1 again (SQL migration)

### "Invalid or expired token" errors
→ Clear cookies, logout, login again
→ Verify admin role: Check Supabase → Authentication → Users → Your user → Raw User Meta Data → should have `"role": "admin"`

### Free mode not showing
→ Check database: `SELECT * FROM app_settings;`
→ Verify value shows `"enabled": true`
→ Clear browser cache

### Payment not working
→ Use test keys first (sandbox mode)
→ Verify webhook URL is correct
→ Check provider dashboard for webhook logs
→ Test with provider's test cards

---

## 📚 Full Documentation

- **Detailed Setup**: [MONETIZATION_SETUP.md](./MONETIZATION_SETUP.md)
- **Free Mode Guide**: [docs/FREE_MODE_FEATURE.md](./docs/FREE_MODE_FEATURE.md)
- **Firebase Setup**: [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

---

## 🎯 Next Actions

**Today:**
- [ ] Complete Step 1 (database setup)
- [ ] Test free mode works
- [ ] Choose payment provider
- [ ] Configure test keys

**This Week:**
- [ ] Test complete payment flow
- [ ] Deploy to production
- [ ] Switch to live payment keys
- [ ] Launch marketing!

**This Month:**
- [ ] Get first 100 users
- [ ] Collect feedback
- [ ] Optimize conversion rate
- [ ] Scale up marketing

---

## 🚀 You've Got This!

Everything is built and ready. Just run that SQL script and you're live! 💰

**Questions?** Check the full guides or reach out for support.

**Good luck!** 🎉
