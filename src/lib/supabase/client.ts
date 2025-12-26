import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
