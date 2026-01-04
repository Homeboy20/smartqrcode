-- Create Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  display_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'user',
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Create QR Codes table
CREATE TABLE IF NOT EXISTS qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'qrcode' CHECK (type IN ('qrcode', 'barcode')),
  format TEXT DEFAULT 'png',
  scans INTEGER DEFAULT 0,
  customizations JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_scan TIMESTAMPTZ
);

-- Create Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'inactive')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  amount DECIMAL(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT DEFAULT 'card',
  last_payment_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'success', 'failed', 'refunded')),
  payment_gateway TEXT NOT NULL,
  payment_method TEXT DEFAULT 'card',
  plan TEXT,
  transaction_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qrcodes_user_id ON qrcodes(user_id);
CREATE INDEX IF NOT EXISTS idx_qrcodes_created_at ON qrcodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Enable RLS (Row Level Security) - Optional but recommended
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE qrcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can access all users" ON users;
DROP POLICY IF EXISTS "Service role can access all qrcodes" ON qrcodes;
DROP POLICY IF EXISTS "Service role can access all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can access all transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own qrcodes" ON qrcodes;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;

-- Create policies for admin access (adjust as needed)
-- These allow service role to access all data
CREATE POLICY "Service role can access all users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all qrcodes" ON qrcodes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all transactions" ON transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Users can only access their own data
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view their own qrcodes" ON qrcodes
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Insert sample data
INSERT INTO users (email, display_name, role, subscription_tier) VALUES
('user1@example.com', 'John Doe', 'user', 'pro'),
('user2@example.com', 'Jane Smith', 'user', 'free'),
('user3@example.com', 'Bob Wilson', 'user', 'business');

-- Insert sample QR codes
INSERT INTO qrcodes (user_id, user_email, name, content, type, scans) VALUES
((SELECT id FROM users WHERE email = 'user1@example.com'), 'user1@example.com', 'Website QR', 'https://example.com', 'qrcode', 125),
((SELECT id FROM users WHERE email = 'user2@example.com'), 'user2@example.com', 'Menu QR', 'https://menu.example.com', 'qrcode', 89),
((SELECT id FROM users WHERE email = 'user3@example.com'), 'user3@example.com', 'Product Barcode', '1234567890123', 'barcode', 45);

-- Insert sample subscriptions
INSERT INTO subscriptions (user_id, user_email, plan, status, amount, currency) VALUES
((SELECT id FROM users WHERE email = 'user1@example.com'), 'user1@example.com', 'pro', 'active', 29.99, 'USD'),
((SELECT id FROM users WHERE email = 'user3@example.com'), 'user3@example.com', 'business', 'active', 99.99, 'USD');

-- Insert sample transactions
INSERT INTO transactions (user_id, user_email, amount, currency, status, payment_gateway, plan) VALUES
((SELECT id FROM users WHERE email = 'user1@example.com'), 'user1@example.com', 29.99, 'USD', 'completed', 'stripe', 'pro'),
((SELECT id FROM users WHERE email = 'user2@example.com'), 'user2@example.com', 9.99, 'USD', 'completed', 'paystack', 'basic'),
((SELECT id FROM users WHERE email = 'user3@example.com'), 'user3@example.com', 99.99, 'USD', 'completed', 'paystack', 'business');
