/**
 * Rate limiting utilities for API endpoints
 * Prevents brute force attacks and abuse
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
  blocked: boolean;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Block duration after exceeding limit (milliseconds) */
  blockDurationMs?: number;
  /** Unique key for this rate limiter */
  keyPrefix?: string;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Usually IP address or user ID
 * @param config - Rate limit configuration
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const {
    maxRequests,
    windowMs,
    blockDurationMs = windowMs * 10,
    keyPrefix = 'rl',
  } = config;

  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Check if currently blocked
  if (record?.blocked && now < record.resetTime) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  // No record or window expired - start fresh
  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetTime,
      blocked: false,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime,
    };
  }

  // Increment count
  record.count++;

  // Check if limit exceeded
  if (record.count > maxRequests) {
    record.blocked = true;
    record.resetTime = now + blockDurationMs;
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil(blockDurationMs / 1000),
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Reset rate limit for a specific identifier
 */
export function resetRateLimit(identifier: string, keyPrefix = 'rl') {
  const key = `${keyPrefix}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Clean up expired rate limit records
 */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime && !record.blocked) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIP(headers: Headers): string {
  // Check various headers that might contain the real IP
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return 'unknown';
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMITS = {
  /** Authentication endpoints (login, register) */
  AUTH: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
    keyPrefix: 'auth',
  },
  /** Password reset */
  PASSWORD_RESET: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 24 * 60 * 60 * 1000, // 24 hour block
    keyPrefix: 'pwd-reset',
  },
  /** Admin setup endpoint */
  ADMIN_SETUP: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 24 * 60 * 60 * 1000, // 24 hour block
    keyPrefix: 'admin-setup',
  },
  /** API routes (general) */
  API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'api',
  },
  /** Webhook endpoints */
  WEBHOOK: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'webhook',
  },
  /** File uploads */
  UPLOAD: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'upload',
  },
} as const;

// Cleanup expired records every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}
