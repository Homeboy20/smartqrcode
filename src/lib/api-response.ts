/**
 * Standardized error response utilities
 * Ensures consistent error format and prevents sensitive data exposure
 */

import { NextResponse } from 'next/server';

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR';

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Invalid input provided',
  AUTHENTICATION_ERROR: 'Authentication required',
  AUTHORIZATION_ERROR: 'Insufficient permissions',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource already exists',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  INTERNAL_ERROR: 'An unexpected error occurred',
  EXTERNAL_SERVICE_ERROR: 'External service unavailable',
  DATABASE_ERROR: 'Database operation failed',
};

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message?: string,
  status?: number,
  details?: unknown
): NextResponse<ErrorResponse> {
  const defaultMessage = ERROR_MESSAGES[code];
  const statusCode = status ?? getDefaultStatusCode(code);

  const response: ErrorResponse = {
    error: {
      message: message || defaultMessage,
      code,
      ...(details && process.env.NODE_ENV === 'development' ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Get default HTTP status code for error code
 */
function getDefaultStatusCode(code: ErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'AUTHENTICATION_ERROR':
      return 401;
    case 'AUTHORIZATION_ERROR':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'EXTERNAL_SERVICE_ERROR':
      return 502;
    case 'DATABASE_ERROR':
    case 'INTERNAL_ERROR':
      return 500;
    default:
      return 500;
  }
}

/**
 * Sanitize error for logging (removes sensitive data)
 */
export function sanitizeError(error: unknown): {
  message: string;
  stack?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Unknown error' };
}

/**
 * Log error securely (strips sensitive data)
 */
export function logError(context: string, error: unknown, metadata?: Record<string, unknown>) {
  const sanitized = sanitizeError(error);
  const isDev = process.env.NODE_ENV === 'development';

  const logData = {
    context,
    error: sanitized,
    ...(metadata || {}),
    timestamp: new Date().toISOString(),
  };

  if (isDev) {
    console.error(`[${context}]`, logData);
  } else {
    // In production, only log message (no stack trace to console)
    console.error(`[${context}] ${sanitized.message}`, {
      code: sanitized.code,
      ...metadata,
    });
  }

  // TODO: Send to external logging service (Sentry, LogRocket, etc.)
}

/**
 * Handle API errors consistently
 */
export function handleApiError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): NextResponse<ErrorResponse> {
  // Log the error securely
  logError(context, error, metadata);

  // Check for known error types
  if ((error as any).name === 'ValidationError') {
    return createErrorResponse('VALIDATION_ERROR', (error as Error).message, 400);
  }

  if ((error as Error).message?.includes('token') || (error as Error).message?.includes('authentication')) {
    return createErrorResponse('AUTHENTICATION_ERROR', undefined, 401);
  }

  if ((error as Error).message?.includes('Admin access required') || (error as Error).message?.includes('Forbidden')) {
    return createErrorResponse('AUTHORIZATION_ERROR', undefined, 403);
  }

  if ((error as Error).message?.includes('not found')) {
    return createErrorResponse('NOT_FOUND', undefined, 404);
  }

  // Check for Supabase errors
  if ((error as any).code?.startsWith('PGRST')) {
    return createErrorResponse('DATABASE_ERROR', 'Database operation failed', 500);
  }

  // Check for network/external service errors
  if ((error as Error).message?.includes('fetch') || (error as Error).message?.includes('network')) {
    return createErrorResponse('EXTERNAL_SERVICE_ERROR', undefined, 502);
  }

  // Generic internal error (don't expose details to client)
  return createErrorResponse(
    'INTERNAL_ERROR',
    undefined,
    500,
    process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
  );
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}
