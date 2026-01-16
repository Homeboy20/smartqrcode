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

function deriveKey(raw: string): Buffer {
  // Expect a 32-byte key for aes-256-cbc.
  // If user provides a longer passphrase, we derive a 32-byte key via SHA-256.
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length === 32) return buf;
  return crypto.createHash('sha256').update(buf).digest();
}

function getCandidateKeyStrings(): string[] {
  const list = process.env.CREDENTIALS_ENCRYPTION_KEYS;
  const primary = process.env.CREDENTIALS_ENCRYPTION_KEY;
  const legacyOld = process.env.CREDENTIALS_ENCRYPTION_KEY_OLD;

  const candidates: string[] = [];

  if (typeof list === 'string' && list.trim().length > 0) {
    for (const part of list.split(',')) {
      const trimmed = part.trim();
      if (trimmed) candidates.push(trimmed);
    }
  } else if (typeof primary === 'string' && primary.trim().length > 0) {
    // Back-compat: single key.
    candidates.push(primary.trim());
  }

  if (typeof legacyOld === 'string' && legacyOld.trim().length > 0) {
    const trimmed = legacyOld.trim();
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  }

  if (candidates.length === 0) {
    throw new Error('Missing CREDENTIALS_ENCRYPTION_KEY (or CREDENTIALS_ENCRYPTION_KEYS)');
  }

  return candidates;
}

function getCandidateKeys(): Buffer[] {
  return getCandidateKeyStrings().map(deriveKey);
}

export function encryptString(plain: string): EncryptedPayload {
  const iv = crypto.randomBytes(16);
  const [key] = getCandidateKeys();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return { encrypted, iv: iv.toString('hex') };
}

export function decryptString(payload: EncryptedPayload): string {
  const keys = getCandidateKeys();
  let lastError: unknown = null;

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(payload.iv, 'hex'));

      let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to decrypt payload with available CREDENTIALS_ENCRYPTION_KEYS');
}
