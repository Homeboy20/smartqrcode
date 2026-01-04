-- =================================================================
-- COMPLETE MONETIZATION SETUP - RUN THIS FIRST!
-- =================================================================
-- This sets up everything needed for your freemium business model:
-- 1. App settings table (for free mode toggle)
-- 2. Enable free mode by default
-- 3. Admin role assignment (UPDATE YOUR EMAIL BELOW!)
-- =================================================================

-- ===========================
-- 1. CREATE APP SETTINGS TABLE
-- ===========================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

-- Add RLS policies for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for free mode checking)
CREATE POLICY "Allow public read access to app_settings"
  ON public.app_settings
  FOR SELECT
  TO public
  USING (true);

-- Only admins can update app_settings
CREATE POLICY "Only admins can modify app_settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ===========================
-- 2. INSERT DEFAULT FREE MODE SETTINGS
-- ===========================

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
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- ===========================
-- 3. SET ADMIN ROLE
-- ===========================
-- ⚠️ IMPORTANT: Replace 'YOUR_EMAIL_HERE@example.com' with your actual email!
-- This gives you admin access to payment settings and app configuration

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'YOUR_EMAIL_HERE@example.com';

-- ===========================
-- 4. VERIFY SETUP
-- ===========================
-- Run these queries to confirm everything is set up correctly:

-- Check app_settings table exists and has free mode enabled
SELECT * FROM public.app_settings WHERE key = 'free_mode';
-- Expected: You should see "enabled": true in the value column

-- Check your admin role was assigned
SELECT 
  email, 
  raw_user_meta_data->>'role' as role 
FROM auth.users 
WHERE email = 'YOUR_EMAIL_HERE@example.com';
-- Expected: role should show 'admin'

-- ===========================
-- 5. OPTIONAL: CREATE USAGE LIMITS TABLE
-- ===========================
-- Uncomment this if you want to limit free users (e.g., 10 QR codes per day)

/*
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  resource_type TEXT NOT NULL, -- 'qr_code', 'barcode', etc.
  count INTEGER DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 day',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, resource_type),
  UNIQUE(ip_address, resource_type)
);

CREATE INDEX idx_usage_limits_user ON public.usage_limits(user_id);
CREATE INDEX idx_usage_limits_ip ON public.usage_limits(ip_address);
CREATE INDEX idx_usage_limits_reset ON public.usage_limits(reset_at);

-- RLS policies for usage_limits
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.usage_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage all usage records"
  ON public.usage_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
*/

-- ===========================
-- 6. CREATE PAYMENT EVENTS LOG (OPTIONAL)
-- ===========================
-- Track all payment events for debugging and analytics

/*
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'paystack', 'stripe', 'flutterwave', 'paypal'
  event_type TEXT NOT NULL, -- 'payment_success', 'subscription_created', etc.
  amount DECIMAL(10, 2),
  currency TEXT,
  transaction_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_events_user ON public.payment_events(user_id);
CREATE INDEX idx_payment_events_provider ON public.payment_events(provider);
CREATE INDEX idx_payment_events_created ON public.payment_events(created_at DESC);

-- RLS for payment_events
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment events"
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment events"
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
*/

-- ===========================
-- SUCCESS! 🎉
-- ===========================
-- Your monetization setup is complete!
-- 
-- Next steps:
-- 1. ✅ Verify free mode is enabled: Visit /api/app-settings
-- 2. ✅ Login as admin: Visit /admin
-- 3. ✅ Configure payments: Visit /admin/payment-settings
-- 4. ✅ Adjust free mode: Visit /admin/app-settings
-- 5. 🚀 Start making money!
-- ===========================
