import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, db as getDb } from '@/lib/firebase/admin';
import * as crypto from 'crypto';

// Helper to get db instance
function getFirestoreDb() {
  const dbInstance = getDb();
  if (!dbInstance) {
    throw new Error('Firebase Admin SDK not initialized');
  }
  return dbInstance;
}

// Encryption/decryption functions
export function encryptData(data: string): { encryptedData: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY || '', 'utf8');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
  };
}

export function decryptData(encryptedData: string, iv: string): string {
  try {
    const key = Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY || '', 'utf8');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// Save credentials with encryption
async function saveCredentials(credentials: Record<string, string>, userId: string) {
  // Create a new record with encrypted values
  const encryptedCredentials: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(credentials)) {
    if (value) {
      const { encryptedData, iv } = encryptData(value);
      encryptedCredentials[key] = {
        encrypted: encryptedData,
        iv: iv,
      };
    }
  }
  
  // Add metadata
  const credentialRecord = {
    credentials: encryptedCredentials,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
  
  // Save to firestore, overwriting any existing record
  const db = getFirestoreDb();
  await db.collection('appSettings').doc('apiCredentials').set(credentialRecord);
  
  // Log access for security audit
  await db.collection('securityLogs').add({
    action: 'credentials_update',
    userId: userId,
    timestamp: new Date().toISOString(),
    details: {
      keysUpdated: Object.keys(credentials).filter(k => credentials[k]),
    },
  });
  
  return credentialRecord;
}

// Fetch and decrypt credentials
async function getCredentials() {
  const db = getFirestoreDb();
  const doc = await db.collection('appSettings').doc('apiCredentials').get();
  
  if (!doc.exists) {
    return {
      credentials: {},
      updatedAt: null,
    };
  }
  
  const data = doc.data();
  const credentials: Record<string, string> = {};
  
  // We only want to return the placeholders or indicator that a key exists
  // We don't want to decrypt and expose the actual values for security reasons
  if (data?.credentials) {
    for (const [key, value] of Object.entries(data.credentials)) {
      if (value && typeof value === 'object' && 'encrypted' in value) {
        // Just indicate that we have this credential stored
        credentials[key] = '••••••••••••••••'; // Placeholder for UI
      }
    }
  }
  
  return {
    credentials,
    updatedAt: data?.updatedAt || null,
  };
}

// Fetch specific credential key for internal use
export async function getDecryptedCredential(key: string): Promise<string | null> {
  try {
    const db = getFirestoreDb();
    const doc = await db.collection('appSettings').doc('apiCredentials').get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    const credentialData = data?.credentials?.[key];
    
    if (!credentialData || typeof credentialData !== 'object' || !('encrypted' in credentialData) || !('iv' in credentialData)) {
      return null;
    }
    
    // Decrypt the value
    return decryptData(credentialData.encrypted, credentialData.iv);
  } catch (error) {
    console.error(`Error fetching credential ${key}:`, error);
    return null;
  }
}

// Fetch all credentials for use by the application
export async function getAllDecryptedCredentials(): Promise<Record<string, string>> {
  try {
    const db = getFirestoreDb();
    const doc = await db.collection('appSettings').doc('apiCredentials').get();
    
    if (!doc.exists) {
      return {};
    }
    
    const data = doc.data();
    const credentials: Record<string, string> = {};
    
    if (data?.credentials) {
      for (const [key, value] of Object.entries(data.credentials)) {
        if (value && typeof value === 'object' && 'encrypted' in value && 'iv' in value) {
          try {
            const encrypted = value.encrypted as string;
            const iv = value.iv as string;
            credentials[key] = decryptData(encrypted, iv);
          } catch (err) {
            console.error(`Failed to decrypt credential ${key}:`, err);
          }
        }
      }
    }
    
    return credentials;
  } catch (error) {
    console.error('Error fetching all credentials:', error);
    return {};
  }
}

// API handler for GET and POST requests
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authToken = request.headers.get('authorization')?.split('Bearer ')[1];
    
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    
    const authResult = await verifyAuth(authToken);
    
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    // Get credentials (placeholders only for UI)
    const credentialsData = await getCredentials();
    
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
    const authToken = request.headers.get('authorization')?.split('Bearer ')[1];
    
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    
    const authResult = await verifyAuth(authToken);
    
    if (!authResult.isAdmin || !authResult.user) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    // Get the request body
    const credentials = await request.json();
    
    // Save credentials
    const result = await saveCredentials(credentials, authResult.user.uid);
    
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