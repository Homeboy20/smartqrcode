import 'server-only';

import * as crypto from 'crypto';

function disabled(): never {
  throw new Error('credentialsVault.server.ts is disabled (legacy Firebase credentials vault retired).');
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
  void credentials;
  void userId;
  disabled();
}

/**
 * Fetch placeholders for keys that exist (never returns decrypted plaintext).
 */
export async function getCredentialPlaceholders() {
  return {
    credentials: {},
    updatedAt: null,
  };
}

export async function getDecryptedCredential(key: string): Promise<string | null> {
  void key;
  disabled();
}

export async function getAllDecryptedCredentials(): Promise<Record<string, string>> {
  disabled();
}
