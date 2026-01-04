import 'server-only';

import { db as getDb } from '@/lib/firebase/admin';
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
export async function saveCredentials(credentials: Record<string, string>, userId: string) {
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
export async function getCredentials() {
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
    // First check environment variables
    if (process.env[key]) {
      return process.env[key] as string;
    }
    
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
    
    // Add environment variables first
    Object.keys(process.env).forEach(key => {
      if (process.env[key]) {
        credentials[key] = process.env[key] as string;
      }
    });
    
    // Then add database credentials (which will override env vars if they exist)
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