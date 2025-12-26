"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

// Define the shape of the context
interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  clearError: () => void;
  isAdmin: boolean;
}

// Create the auth context with default values
const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  loading: true,
  error: null,
  signIn: async () => false,
  signUp: async () => false,
  logout: async () => false,
  resetPassword: async () => false,
  signInWithGoogle: async () => false,
  clearError: () => {},
  isAdmin: false,
});

// Provider component
export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check if user is admin
  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setIsAdmin(data.role === 'admin');
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  // Clear any error
  const clearError = () => setError(null);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      clearError();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || '',
          }
        }
      });

      if (error) {
        setError(error.message);
        return false;
      }

      // Create user record in users table
      if (data.user) {
        await supabase.from('users').upsert({
          id: data.user.id,
          email: data.user.email,
          display_name: displayName || '',
          role: 'user',
          subscription_tier: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      clearError();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(error.message);
        return false;
      }
      setIsAdmin(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      clearError();
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      clearError();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        signIn,
        signUp,
        logout,
        resetPassword,
        signInWithGoogle,
        clearError,
        isAdmin,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
};

// Hook to use the auth context
export const useSupabaseAuth = () => useContext(SupabaseAuthContext);
