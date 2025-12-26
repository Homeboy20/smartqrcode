import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client - only create if env vars are present
let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase client: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  // Create a dummy client that will fail gracefully
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };

// Database types
export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: 'user' | 'admin';
  subscription_tier: 'free' | 'pro' | 'business';
  created_at: string;
  updated_at: string;
  last_login: string | null;
  is_initial_admin: boolean;
}

export interface QRCode {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}
