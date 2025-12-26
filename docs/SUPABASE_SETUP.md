# Supabase Database Setup

Run these SQL commands in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new)

## Step 1: Create the users table

```sql
-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  subscription_tier TEXT DEFAULT 'free',
  is_initial_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

## Step 2: Set up RLS Policies

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "Allow public read access" ON public.users;
DROP POLICY IF EXISTS "Allow read access" ON public.users;

-- Create permissive policies for development
-- Allow anyone to read user data (needed for checking admin status, etc.)
CREATE POLICY "Allow public read access" ON public.users
  FOR SELECT
  USING (true);

-- Allow users to update their own data
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own record
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role has full access (bypasses RLS anyway, but explicit is good)
CREATE POLICY "Service role full access" ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

## Step 3: Create your admin user

After signing up through the app (at /supabase-admin-setup), run this to make yourself an admin:

```sql
-- Replace 'your-user-id-here' with your actual user ID from auth.users
-- You can find it by running: SELECT id, email FROM auth.users;

-- First, check your auth users:
SELECT id, email FROM auth.users;

-- Then insert/update your user as admin (replace the ID):
INSERT INTO public.users (id, email, role, is_initial_admin)
SELECT id, email, 'admin', true
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  is_initial_admin = true,
  updated_at = NOW();
```

## Quick Setup Script (All-in-One)

Copy and run this entire script, replacing `your-email@example.com` with your email:

```sql
-- 1. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  subscription_tier TEXT DEFAULT 'free',
  is_initial_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "Allow public read access" ON public.users;
DROP POLICY IF EXISTS "Allow read access" ON public.users;

-- 4. Create new policies
CREATE POLICY "Allow public read access" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Set up admin user - CHANGE THE EMAIL!
INSERT INTO public.users (id, email, role, is_initial_admin)
SELECT id, email, 'admin', true
FROM auth.users
WHERE email = 'your-email@example.com'  -- <-- CHANGE THIS
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  is_initial_admin = true,
  updated_at = NOW();

-- 6. Verify setup
SELECT id, email, role FROM public.users;
```

## Environment Variables for Coolify

Make sure these are set in your Coolify deployment:

```
NEXT_PUBLIC_SUPABASE_URL=https://ufdwqpxqgqhvqoovdssf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZHdxcHhxZ3FodnFvb3Zkc3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MDMwMzMsImV4cCI6MjA4MjI3OTAzM30.tFWVpTpW3XPqUMDbTpnQlpgXJJZyyRhy0Nzm1Tx4GaM
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZHdxcHhxZ3FodnFvb3Zkc3NmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcwMzAzMywiZXhwIjoyMDgyMjc5MDMzfQ.ZAD6_eadAyexp7MQOl80W80BGgh6OXPmG6w9q3gvPUk
ADMIN_SETUP_SECRET=smartqr-admin-setup-2025
```
