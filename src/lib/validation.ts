/**
 * Input validation utilities for API routes
 * Prevents SQL injection and malicious inputs
 */

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Alphanumeric with hyphens and underscores
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// Email regex (basic)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone number (E.164 format)
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(value: unknown, fieldName = 'id'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  if (!UUID_REGEX.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName);
  }

  return value;
}

/**
 * Validate safe ID (alphanumeric + hyphen + underscore)
 */
export function validateSafeId(value: unknown, fieldName = 'id'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  if (!SAFE_ID_REGEX.test(value)) {
    throw new ValidationError(
      `${fieldName} contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed.`,
      fieldName
    );
  }

  if (value.length > 100) {
    throw new ValidationError(`${fieldName} is too long (max 100 characters)`, fieldName);
  }

  return value;
}

/**
 * Validate email format
 */
export function validateEmail(value: unknown, fieldName = 'email'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  const trimmed = value.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError(`${fieldName} is not a valid email address`, fieldName);
  }

  if (trimmed.length > 254) {
    throw new ValidationError(`${fieldName} is too long`, fieldName);
  }

  return trimmed;
}

/**
 * Validate phone number (E.164 format)
 */
export function validatePhone(value: unknown, fieldName = 'phone'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  const cleaned = value.trim();

  if (!PHONE_REGEX.test(cleaned)) {
    throw new ValidationError(
      `${fieldName} must be in E.164 format (e.g., +1234567890)`,
      fieldName
    );
  }

  return cleaned;
}

/**
 * Sanitize string input (remove special characters)
 */
export function sanitizeString(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Remove < and > to prevent XSS
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName = 'value'
): T {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      fieldName
    );
  }

  return value as T;
}

/**
 * Validate positive integer
 */
export function validatePositiveInt(value: unknown, fieldName = 'value'): number {
  const num = Number(value);

  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`, fieldName);
  }

  return num;
}

/**
 * Validate amount (currency)
 */
export function validateAmount(value: unknown, fieldName = 'amount'): number {
  const num = Number(value);

  if (isNaN(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`, fieldName);
  }

  // Max 2 decimal places
  if (Math.round(num * 100) / 100 !== num) {
    throw new ValidationError(`${fieldName} can have at most 2 decimal places`, fieldName);
  }

  return num;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: {
  page?: unknown;
  limit?: unknown;
  maxLimit?: number;
}): { page: number; limit: number } {
  const { page = 1, limit = 10, maxLimit = 100 } = params;

  const validPage = validatePositiveInt(page, 'page');
  const validLimit = validatePositiveInt(limit, 'limit');

  if (validLimit > maxLimit) {
    throw new ValidationError(`limit cannot exceed ${maxLimit}`, 'limit');
  }

  return { page: validPage, limit: validLimit };
}

/**
 * Validate URL
 */
export function validateUrl(value: unknown, fieldName = 'url'): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  try {
    const url = new URL(value);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }

    return value;
  } catch {
    throw new ValidationError(`${fieldName} is not a valid URL`, fieldName);
  }
}

/**
 * Validate JSON string
 */
export function validateJSON(value: unknown, fieldName = 'data'): object {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a JSON string`, fieldName);
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Not an object');
    }
    return parsed;
  } catch {
    throw new ValidationError(`${fieldName} is not valid JSON`, fieldName);
  }
}
