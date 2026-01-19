import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/server';
import { decryptStringWithKeyIndex, isEncryptedPayload } from '@/lib/secure/credentialCrypto';

// GET - Debug payment settings encryption/decryption
export async function GET(request: NextRequest) {
  try {
    // Verify admin access (works with cookie-based session)
    try {
      await verifyAdminAccess(request);
    } catch (authError: any) {
      return NextResponse.json(
        { 
          error: 'Admin authentication required', 
          message: 'Please visit this URL while logged in to the admin panel',
          hint: 'Open /admin/payment-settings in another tab, then try this URL again'
        }, 
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('payment_settings')
      .select('provider, is_active, credentials')
      .eq('provider', 'flutterwave')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        message: 'No Flutterwave settings found in database',
        exists: false 
      });
    }

    const credentials = data.credentials as Record<string, any> || {};
    const debug: any = {
      provider: data.provider,
      isActive: data.is_active,
      credentialFields: Object.keys(credentials),
      encryptionKeyConfigured: !!(process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.CREDENTIALS_ENCRYPTION_KEYS),
      fieldDetails: {},
    };

    // Check each field
    for (const [field, value] of Object.entries(credentials)) {
      const fieldDebug: any = {
        hasValue: !!value,
        type: typeof value,
      };

      if (isEncryptedPayload(value)) {
        fieldDebug.isEncrypted = true;
        fieldDebug.hasIv = !!(value as any).iv;
        fieldDebug.hasEncryptedData = !!(value as any).encrypted;
        
        // Try to decrypt
        try {
          const { plain: decrypted, keyIndex } = decryptStringWithKeyIndex(value as any);
          fieldDebug.decryptionSuccess = true;
          fieldDebug.decryptedLength = decrypted.length;
          fieldDebug.decryptedWithKeyIndex = keyIndex;
          fieldDebug.needsRotation = keyIndex > 0;
          // Show first 4 and last 4 characters for verification
          if (decrypted.length > 8) {
            fieldDebug.preview = `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`;
          } else {
            fieldDebug.preview = `${decrypted.substring(0, 2)}...${decrypted.substring(decrypted.length - 2)}`;
          }
        } catch (e: any) {
          fieldDebug.decryptionSuccess = false;
          fieldDebug.decryptionError = e.message;
        }
      } else if (typeof value === 'string') {
        fieldDebug.isEncrypted = false;
        fieldDebug.length = value.length;
        if (value.length > 8) {
          fieldDebug.preview = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        }
      }

      debug.fieldDetails[field] = fieldDebug;
    }

    // If clientSecret was decrypted successfully, test it
    if (debug.fieldDetails.clientSecret?.decryptionSuccess) {
      try {
        const clientSecret = decryptStringWithKeyIndex((credentials as any).clientSecret).plain;
        debug.clientSecretValidation = {
          format: clientSecret.startsWith('FLWSECK-') || clientSecret.startsWith('FLWSECK_TEST-') 
            ? 'Valid format' 
            : 'Invalid format (should start with FLWSECK- or FLWSECK_TEST-)',
          length: clientSecret.length,
          isTestKey: clientSecret.startsWith('FLWSECK_TEST-'),
          isLiveKey: clientSecret.startsWith('FLWSECK-') && !clientSecret.startsWith('FLWSECK_TEST-'),
        };

        // Test the actual API call
        debug.apiTest = {
          testing: true,
          endpoint: 'https://api.flutterwave.com/v3/balances'
        };

        const testResponse = await fetch('https://api.flutterwave.com/v3/balances', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            'Content-Type': 'application/json',
          },
        });

        debug.apiTest.statusCode = testResponse.status;
        debug.apiTest.statusText = testResponse.statusText;
        debug.apiTest.success = testResponse.ok;

        if (!testResponse.ok) {
          const responseData = await testResponse.json().catch(() => ({}));
          debug.apiTest.errorResponse = responseData;
          debug.apiTest.diagnosis = testResponse.status === 401 
            ? 'Secret key is invalid or expired - please verify from Flutterwave dashboard'
            : testResponse.status === 403
            ? 'Secret key lacks required permissions'
            : `Unexpected error: ${testResponse.status}`;
        } else {
          debug.apiTest.diagnosis = 'Secret key is valid and working!';
        }
      } catch (e: any) {
        debug.apiTest = {
          error: e.message,
          diagnosis: 'Failed to test API connection'
        };
      }
    }

    return NextResponse.json(debug);
  } catch (error: any) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Debug failed' },
      { status: 500 }
    );
  }
}
