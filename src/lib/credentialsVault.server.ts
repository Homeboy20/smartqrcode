import 'server-only';

import * as crypto from 'crypto';
import { db as getDb } from '@/lib/firebase/admin';

function getFirestoreDb() {
  const dbInstance = getDb();
  if (!dbInstance) {
    console.warn('Firebase Admin SDK not initialized - credentials vault unavailable');
    return null;
  }
  return dbInstance;
}

export function encryptData(data: string): { encryptedData: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing CREDENTIALS_ENCRYPTION_KEY');
  }

  const keyBuf = Buffer.from(raw, 'utf8');
  const key = keyBuf.length === 32 ? keyBuf : crypto.createHash('sha256').update(keyBuf).digest();

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
  };
}

export function decryptData(encryptedData: string, iv: string): string {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing CREDENTIALS_ENCRYPTION_KEY');
  }

  const keyBuf = Buffer.from(raw, 'utf8');
  const key = keyBuf.length === 32 ? keyBuf : crypto.createHash('sha256').update(keyBuf).digest();

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Save credentials in Firestore (encrypted) and write a security audit entry.
 * Returns the record written to Firestore.
 */
export async function saveEncryptedCredentials(credentials: Record<string, string>, userId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase not configured - credentials storage unavailable');
  }

  const encryptedCredentials: Record<string, any> = {};

  for (const [key, value] of Object.entries(credentials)) {
    if (value) {
      const { encryptedData, iv } = encryptData(value);
      encryptedCredentials[key] = {
        encrypted: encryptedData,
        iv,
      };
    }
  }

  const credentialRecord = {
    credentials: encryptedCredentials,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  await db.collection('appSettings').doc('apiCredentials').set(credentialRecord);

  await db.collection('securityLogs').add({
    action: 'credentials_update',
    userId,
    timestamp: new Date().toISOString(),
    details: {
      keysUpdated: Object.keys(credentials).filter((k) => credentials[k]),
    },
  });

  return credentialRecord;
}

/**
 * Fetch placeholders for keys that exist (never returns decrypted plaintext).
 */
export async function getCredentialPlaceholders() {
  const db = getFirestoreDb();
  if (!db) {
    return {
      credentials: {},
      updatedAt: null,
    };
  }

  const doc = await db.collection('appSettings').doc('apiCredentials').get();

  if (!doc.exists) {
    return {
      credentials: {},
      updatedAt: null,
    };
  }

  const data = doc.data();
  const credentials: Record<string, string> = {};

  if (data?.credentials) {
    for (const [key, value] of Object.entries(data.credentials)) {
      if (value && typeof value === 'object' && 'encrypted' in value) {
        credentials[key] = '••••••••••••••••';
      }
    }
  }

  return {
    credentials,
    updatedAt: data?.updatedAt || null,
  };
}

export async function getDecryptedCredential(key: string): Promise<string | null> {
  try {
    const db = getFirestoreDb();
    if (!db) {
      return null;
    }

    const doc = await db.collection('appSettings').doc('apiCredentials').get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    const credentialData = data?.credentials?.[key];

    if (
      !credentialData ||
      typeof credentialData !== 'object' ||
      !('encrypted' in credentialData) ||
      !('iv' in credentialData)
    ) {
      return null;
    }

    return decryptData(credentialData.encrypted, credentialData.iv);
  } catch (error) {
    console.error(`Error fetching credential ${key}:`, error);
    return null;
  }
}

export async function getAllDecryptedCredentials(): Promise<Record<string, string>> {
  try {
    const db = getFirestoreDb();
    if (!db) {
      return {};
    }

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
