-- ===================================================================
-- CREATE QRCODES TABLE FOR DYNAMIC QR CODE FUNCTIONALITY
-- ===================================================================
-- This table stores dynamic QR codes and barcodes that can be edited
-- after creation and include analytics tracking.
-- ===================================================================

-- Create the qrcodes table
CREATE TABLE IF NOT EXISTS public.qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- Can be encrypted URL or plain URL
  type TEXT NOT NULL DEFAULT 'qrcode' CHECK (type IN ('qrcode', 'barcode')),
  format TEXT DEFAULT 'png' CHECK (format IN ('png', 'svg', 'jpg', 'webp')),
  scans INTEGER DEFAULT 0,
  last_scan TIMESTAMPTZ,
  customizations JSONB DEFAULT '{}'::jsonb, -- Stores colors, logo, encryption flag, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_qrcodes_user_id ON public.qrcodes(user_id);
CREATE INDEX IF NOT EXISTS idx_qrcodes_type ON public.qrcodes(type);
CREATE INDEX IF NOT EXISTS idx_qrcodes_created_at ON public.qrcodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qrcodes_scans ON public.qrcodes(scans DESC);

-- Enable Row Level Security
ALTER TABLE public.qrcodes ENABLE ROW LEVEL SECURITY;

-- Users can view their own QR codes
CREATE POLICY "Users can view their own QR codes"
  ON public.qrcodes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own QR codes
CREATE POLICY "Users can create their own QR codes"
  ON public.qrcodes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own QR codes
CREATE POLICY "Users can update their own QR codes"
  ON public.qrcodes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own QR codes
CREATE POLICY "Users can delete their own QR codes"
  ON public.qrcodes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all QR codes
CREATE POLICY "Admins can view all QR codes"
  ON public.qrcodes
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admins can update any QR code
CREATE POLICY "Admins can update any QR code"
  ON public.qrcodes
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admins can delete any QR code
CREATE POLICY "Admins can delete any QR code"
  ON public.qrcodes
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Service role has full access (for /c/[id] redirect route)
CREATE POLICY "Service role full access to qrcodes"
  ON public.qrcodes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qrcodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS trigger_update_qrcodes_updated_at ON public.qrcodes;
CREATE TRIGGER trigger_update_qrcodes_updated_at
  BEFORE UPDATE ON public.qrcodes
  FOR EACH ROW
  EXECUTE FUNCTION update_qrcodes_updated_at();

-- ===================================================================
-- VERIFICATION
-- ===================================================================
-- Run this to verify the table was created:
-- SELECT * FROM public.qrcodes LIMIT 5;
-- 
-- Check RLS policies:
-- SELECT * FROM pg_policies WHERE tablename = 'qrcodes';
-- ===================================================================
