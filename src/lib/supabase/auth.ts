import { createClient } from '@supabase/supabase-js';

/**
 * Verify Supabase access token and check admin status
 * @param accessToken - The Supabase session access token from Authorization header
 * @returns Object with userId, email, and isAdmin status
 */
export async function verifySupabaseAuth(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  // Create client with anon key to verify the user's token
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Verify the access token and get user
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  // Check if user is admin by querying the users table
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Service role key missing');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  
  const { data: userData, error: userError } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (userError) {
    console.error('Error checking admin status:', userError);
    // If user doesn't exist in users table, they're not an admin
    return {
      userId: user.id,
      email: user.email || '',
      isAdmin: false
    };
  }

  // If no user record found, they're not an admin
  if (!userData) {
    return {
      userId: user.id,
      email: user.email || '',
      isAdmin: false
    };
  }

  return {
    userId: user.id,
    email: user.email || '',
    isAdmin: userData?.role === 'admin'
  };
}

/**
 * Verify Supabase access token for a normal (non-admin) user.
 * Returns userId + email, or throws on invalid token.
 */
export async function verifyUserAccess(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authentication token provided');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('Invalid authentication token');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return {
    token,
    userId: user.id,
    email: user.email || '',
  };
}

/**
 * Extract and verify Bearer token from request
 * @param request - Next.js request object
 * @returns Auth result or throws error
 */
export async function verifyAdminAccess(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authentication token provided');
  }

  const token = authHeader.split('Bearer ')[1];
  
  if (!token) {
    throw new Error('Invalid authentication token');
  }

  const authResult = await verifySupabaseAuth(token);
  
  if (!authResult.isAdmin) {
    throw new Error('Admin access required');
  }

  return authResult;
}
