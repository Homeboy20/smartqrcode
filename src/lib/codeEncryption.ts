import crypto from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.CODE_ENCRYPTION_SECRET ||
    process.env.QRCODE_ENCRYPTION_SECRET ||
    process.env.QR_CODE_ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error('Encryption secret missing (set CODE_ENCRYPTION_SECRET)');
  }

  return crypto.createHash('sha256').update(secret, 'utf8').digest(); // 32 bytes
}

export function isEncryptedString(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

export function encryptString(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // recommended for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    base64UrlEncode(iv),
    '.',
    base64UrlEncode(ciphertext),
    '.',
    base64UrlEncode(tag),
  ].join('');
}

export function decryptString(maybeEncrypted: string): string {
  if (!isEncryptedString(maybeEncrypted)) return maybeEncrypted;

  const payload = maybeEncrypted.slice(ENCRYPTION_PREFIX.length);
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload');
  }

  const [ivB64, ciphertextB64, tagB64] = parts;
  const iv = base64UrlDecode(ivB64);
  const ciphertext = base64UrlDecode(ciphertextB64);
  const tag = base64UrlDecode(tagB64);

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}
