import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/lib/supabase/auth';
import { mapEnvStylePaymentKeysToProviders, saveProviderSettings } from '@/lib/paymentSettingsStore';
import {
  getAllDecryptedCredentials,
  getCredentialPlaceholders,
  saveEncryptedCredentials,
} from '@/lib/credentialsVault.server';

// Note: encryption/decryption + Firestore access live in credentialsVault.server.ts

// API handler for GET and POST requests
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAccess(request);
    
    // Get credentials (placeholders only for UI)
    const credentialsData = await getCredentialPlaceholders();
    
    return NextResponse.json(credentialsData);
  } catch (error) {
    console.error('Error in GET /api/admin/credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAccess(request);
    
    // Get the request body
    const credentials = await request.json();
    
    // Save credentials
    const result = await saveEncryptedCredentials(credentials, authResult.userId);

    // Also sync payment-related credentials into Supabase payment_settings so
    // checkout/runtime and the Settings UI read from the same place.
    try {
      const paymentUpdates = mapEnvStylePaymentKeysToProviders(credentials);
      for (const update of paymentUpdates) {
        await saveProviderSettings({ provider: update.provider, credentials: update.credentials });
      }
    } catch (syncError) {
      // Don't fail the whole request if Supabase is not configured yet.
      console.warn('Failed syncing payment credentials to Supabase payment_settings:', syncError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Credentials saved successfully',
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save credentials' },
      { status: 500 }
    );
  }
} 