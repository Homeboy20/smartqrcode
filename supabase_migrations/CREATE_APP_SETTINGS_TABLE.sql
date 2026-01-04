-- Create app_settings table for storing application configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Insert default app settings
INSERT INTO app_settings (key, value, created_at, updated_at)
VALUES (
  'general',
  '{
    "freeMode": false,
    "freeModeFeatures": {
      "qrCodeGeneration": true,
      "barcodeGeneration": true,
      "basicTemplates": true,
      "basicFormats": true
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE app_settings IS 'Stores application-wide configuration settings';
COMMENT ON COLUMN app_settings.key IS 'Unique identifier for the setting (e.g., general, features, etc.)';
COMMENT ON COLUMN app_settings.value IS 'JSON object containing the setting values';
