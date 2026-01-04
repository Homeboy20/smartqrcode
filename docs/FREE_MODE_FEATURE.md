# Free Mode Feature

## Overview

The Free Mode feature allows administrators to make basic functionality of the SmartQR web app available to all visitors without requiring authentication. Premium features remain locked behind user registration and login.

## How It Works

### For Visitors (Not Logged In)
When Free Mode is enabled:
- ✅ Can generate basic QR codes
- ✅ Can generate basic barcodes  
- ✅ Can use standard templates
- ✅ Can export to PNG format
- ❌ Cannot use premium templates (gradient, dotted, framed, logo overlay)
- ❌ Cannot export to SVG or PDF
- ❌ Cannot use bulk generation
- ❌ Cannot use AI customization
- ❌ Cannot access analytics
- ❌ Cannot use custom branding
- ❌ Cannot create teams

### For Registered Users (Logged In)
Logged-in users get access to features based on their subscription tier:

**Free Tier:**
- 10 QR codes max
- 5 barcodes max
- Basic templates only
- PNG export only

**Pro Tier ($9.99/month):**
- 100 QR codes
- 50 barcodes
- All templates including premium
- Bulk generation (25 items)
- AI customization (10 uses)
- Analytics
- Custom branding
- All export formats (PNG, SVG, PDF)

**Business Tier ($29.99/month):**
- 1000 QR codes
- 500 barcodes
- All pro features
- Bulk generation (100 items)
- AI customization (50 uses)
- Team collaboration (5 members)

## Setup Instructions

### 1. Database Migration

Run the SQL migration to create the `app_settings` table:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase_migrations/CREATE_APP_SETTINGS_TABLE.sql

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

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
```

### 2. Enable Free Mode

1. Navigate to **Admin Panel** → **App Settings**
2. Toggle the **Free Mode** switch to ON
3. Configure which basic features should be available:
   - QR Code Generation
   - Barcode Generation
   - Basic Templates
   - Basic Export Formats (PNG)
4. Click **Save Settings**

### 3. Verify Setup

1. **Test as Visitor:**
   - Open an incognito/private window
   - Navigate to your QR code generator page
   - Verify you can generate basic QR codes without logging in
   - Verify premium features show "Login Required" prompts

2. **Test as Logged-In User:**
   - Log in with a test account
   - Verify premium features are accessible based on subscription tier
   - Test bulk generation, premium templates, etc.

## API Endpoints

### Public Endpoint (No Auth Required)
```typescript
GET /api/app-settings

Response:
{
  "freeMode": boolean,
  "freeModeFeatures": {
    "qrCodeGeneration": boolean,
    "barcodeGeneration": boolean,
    "basicTemplates": boolean,
    "basicFormats": boolean
  }
}
```

### Admin Endpoint (Admin Auth Required)
```typescript
GET /api/admin/app-settings
Authorization: Bearer <admin_access_token>

Response:
{
  "settings": {
    "freeMode": boolean,
    "freeModeFeatures": {
      "qrCodeGeneration": boolean,
      "barcodeGeneration": boolean,
      "basicTemplates": boolean,
      "basicFormats": boolean
    }
  }
}

POST /api/admin/app-settings
Authorization: Bearer <admin_access_token>
Content-Type: application/json

Body:
{
  "settings": {
    "freeMode": boolean,
    "freeModeFeatures": {
      "qrCodeGeneration": boolean,
      "barcodeGeneration": boolean,
      "basicTemplates": boolean,
      "basicFormats": boolean
    }
  }
}
```

## Code Integration

### Using the Hook

```typescript
import { useAppSettings } from '@/hooks/useAppSettings';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

function MyComponent() {
  const { settings, loading } = useAppSettings();
  const { user } = useSupabaseAuth();
  
  // Check if user can access a feature
  const canGenerateQR = user || (settings.freeMode && settings.freeModeFeatures.qrCodeGeneration);
  
  return (
    <div>
      {canGenerateQR ? (
        <QRCodeGenerator />
      ) : (
        <div>
          <p>Please log in to generate QR codes</p>
          <Link href="/login">Login</Link>
        </div>
      )}
    </div>
  );
}
```

### Checking Feature Access

The subscription hook now automatically considers free mode:

```typescript
import { useSubscription } from '@/context/SubscriptionProvider';

function FeatureComponent() {
  const { checkFeatureAccess } = useSubscription();
  
  // Returns true if:
  // - User is logged in with appropriate subscription tier, OR
  // - Free mode is enabled and feature is a basic feature
  const canUse = checkFeatureAccess('qrCodeGeneration');
  
  return canUse ? <Feature /> : <UpgradePrompt />;
}
```

## Premium Features (Always Require Login)

These features **always** require user authentication, regardless of Free Mode:

- 🔒 Bulk generation
- 🔒 AI customization
- 🔒 Analytics dashboard
- 🔒 Custom branding
- 🔒 Team collaboration
- 🔒 Premium templates (gradient, dotted, framed, logo overlay)
- 🔒 Advanced export formats (SVG, PDF)
- 🔒 Saved QR codes history
- 🔒 API access

## Business Use Cases

### 1. Freemium Model
Enable free mode to let visitors try basic features, then prompt them to register for premium features.

### 2. Demo/Trial
Allow anyone to test the app's core functionality without friction, encouraging conversion to paid plans.

### 3. Public Tool
Run the app as a free public tool with optional paid upgrades for power users.

### 4. Gated Premium
Keep basic generation free while monetizing advanced features like bulk generation, analytics, and custom branding.

## Security Considerations

1. **Rate Limiting:** Consider implementing rate limiting for unauthenticated users to prevent abuse
2. **Storage:** Free mode users cannot save their generated codes (requires login)
3. **Analytics:** Track usage by IP or session for free mode users
4. **Spam Prevention:** Add CAPTCHA for free mode if abuse occurs

## Troubleshooting

### Free Mode Not Working

1. **Check Database:**
   ```sql
   SELECT * FROM app_settings WHERE key = 'general';
   ```

2. **Verify API Response:**
   ```bash
   curl https://your-domain.com/api/app-settings
   ```

3. **Clear Cache:** Browser may cache old settings
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear application cache

### Premium Features Still Locked for Logged-In Users

1. Check user's subscription tier in database
2. Verify subscription limits in `src/lib/subscriptions.ts`
3. Check `useSupabaseSubscription` hook is properly fetching user data

## Monitoring

Track free mode usage in your analytics:

```typescript
// Example: Track free mode conversions
if (!user && settings.freeMode) {
  analytics.track('free_mode_qr_generated', {
    timestamp: new Date(),
    feature: 'qrCodeGeneration'
  });
}
```

## Future Enhancements

Potential improvements to the free mode system:

- [ ] Daily usage limits for free mode users
- [ ] Watermark on free mode generated codes
- [ ] Time-based access (e.g., free mode only on weekends)
- [ ] Geographic restrictions
- [ ] A/B testing different free mode configurations
- [ ] Conversion funnel tracking

## Support

For issues or questions:
1. Check this documentation
2. Review the code in:
   - `/src/app/admin/app-settings/page.tsx`
   - `/src/hooks/useAppSettings.ts`
   - `/src/hooks/useSupabaseSubscription.tsx`
3. Check Supabase logs for API errors
4. Contact support with specific error messages
