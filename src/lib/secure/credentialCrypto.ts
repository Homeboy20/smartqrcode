import 'server-only';

import crypto from 'crypto';

export type EncryptedPayload = {
  encrypted: string;
  iv: string;
};

const MASK = '••••••••••••••••';

export function getMaskedValue() {
  return MASK;
}

export function isMaskedValue(value: unknown): value is string {
  return typeof value === 'string' && value === MASK;
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'encrypted' in value &&
    'iv' in value &&
    typeof (value as any).encrypted === 'string' &&
    typeof (value as any).iv === 'string'
  );
}

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('Missing CREDENTIALS_ENCRYPTION_KEY');
  }

  // Expect a 32-byte key for aes-256-cbc.
  // If user provides a longer passphrase, we derive a 32-byte key via SHA-256.
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length === 32) return buf;
  return crypto.createHash('sha256').update(buf).digest();
}

export function encryptString(plain: string): EncryptedPayload {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);

  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return { encrypted, iv: iv.toString('hex') };
}

export function decryptString(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(payload.iv, 'hex'));

  let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
