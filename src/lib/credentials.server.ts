import 'server-only';

import * as crypto from 'crypto';

function disabled(): never {
  throw new Error('credentials.server.ts is disabled (legacy Firebase credentials storage retired).');
}

// Encryption/decryption functions
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

// Save credentials with encryption
export async function saveCredentials(credentials: Record<string, string>, userId: string) {
  void credentials;
  void userId;
  disabled();
}

// Fetch and decrypt credentials
export async function getCredentials() {
  disabled();
}

// Fetch specific credential key for internal use
export async function getDecryptedCredential(key: string): Promise<string | null> {
  void key;
  disabled();
}

// Fetch all credentials for use by the application
export async function getAllDecryptedCredentials(): Promise<Record<string, string>> {
  disabled();
} 