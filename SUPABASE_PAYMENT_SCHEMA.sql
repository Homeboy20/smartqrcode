-- Supabase Payment & Subscription Schema
-- Run this SQL in your Supabase SQL Editor to set up payment testing with Paystack

-- =====================================================
-- 1. Create subscriptions table
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'business')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  paystack_subscription_code TEXT UNIQUE,
  paystack_customer_code TEXT,
  paystack_authorization_code TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paystack_code ON subscriptions(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- 2. Update users table to add payment fields
-- =====================================================
-- Add paystack_customer_code to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'paystack_customer_code'
  ) THEN
    ALTER TABLE users ADD COLUMN paystack_customer_code TEXT;
  END IF;
END $$;

-- Add index for paystack customer lookups
CREATE INDEX IF NOT EXISTS idx_users_paystack_customer_code ON users(paystack_customer_code);

-- =====================================================
-- 3. Create payments table (optional - for payment history)
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded')),
  paystack_reference TEXT UNIQUE,
  paystack_transaction_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(paystack_reference);

-- =====================================================
-- 4. Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access to subscriptions" ON subscriptions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to payments" ON payments
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to get active subscription for a user
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  plan TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.plan,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Create trigger to update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. Create payment_settings table for admin config
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('stripe', 'paypal', 'flutterwave', 'paystack')),
  is_active BOOLEAN DEFAULT false,
  credentials JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on payment_settings
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access payment_settings (admin only)
CREATE POLICY "Service role full access to payment_settings" ON payment_settings
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Apply trigger to payment_settings table
DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON payment_settings;
CREATE TRIGGER update_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. Grant necessary permissions
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON payments TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_subscription(UUID) TO authenticated;

-- =====================================================
-- DONE! 
-- =====================================================
-- Your database is now ready for payment testing with Paystack.
-- Next steps:
-- 1. Add your Paystack test keys to .env.local
-- 2. Create subscription plans in Paystack Dashboard (test mode)
-- 3. Update PAYSTACK_PLAN_CODE_PRO and PAYSTACK_PLAN_CODE_BUSINESS in .env.local
-- 4. Test webhooks using Paystack's test mode
