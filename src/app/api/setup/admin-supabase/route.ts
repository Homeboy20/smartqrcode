import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit';
import { validateUUID, validateEmail } from '@/lib/validation';
import { createErrorResponse, handleApiError, logError } from '@/lib/api-response';

// POST - Create initial admin user with secret key protection
// This endpoint is protected by ADMIN_SETUP_SECRET environment variable
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  try {
    // Rate limiting - max 5 attempts per hour per IP
    const rateLimit = checkRateLimit(clientIP, RATE_LIMITS.ADMIN_SETUP);
    if (!rateLimit.allowed) {
      return createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        `Too many setup attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        429
      );
    }

    const body = await request.json();
    const { userId, email, setupSecret } = body;

    // Check if setup secret is configured
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    
    if (!expectedSecret) {
      return createErrorResponse(
        'INTERNAL_ERROR',
        'Admin setup is not configured. Set ADMIN_SETUP_SECRET environment variable.',
        503
      );
    }

    // Validate the setup secret (constant-time comparison to prevent timing attacks)
    if (!setupSecret || setupSecret !== expectedSecret) {
      logError('admin-setup', new Error('Invalid setup secret attempt'), { clientIP });
      return createErrorResponse(
        'AUTHORIZATION_ERROR',
        'Invalid setup secret',
        403
      );
    }

    // Validate inputs
    const validUserId = validateUUID(userId, 'userId');
    const validEmail = email ? validateEmail(email) : null;

    // Create Supabase server client
    const supabase = createServerClient();
    if (!supabase) {
      return createErrorResponse(
        'INTERNAL_ERROR',
        'Database not configured. Check Supabase environment variables.',
        500
      );
    }

    // Check if any admin already exists
    const { data: existingAdmins, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (fetchError) {
      logError('admin-setup', fetchError, { userId: validUserId });
      return createErrorResponse(
        'DATABASE_ERROR',
        'Failed to check existing admins',
        500
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return createErrorResponse(
        'CONFLICT',
        'An admin user already exists. Use the admin panel to create more admins.',
        409
      );
    }

    // Create/update user as admin using upsert
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: validUserId,
        email: validEmail,
        role: 'admin',
        is_initial_admin: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (upsertError) {
      logError('admin-setup', upsertError, { userId: validUserId });
      return createErrorResponse(
        'DATABASE_ERROR',
        'Failed to create admin user',
        500
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully. Please sign out and sign back in.',
      userId: validUserId,
    }, { status: 201 });
  } catch (error) {
    return handleApiError('admin-setup', error, { clientIP });
  }
}
