"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms: ${label}`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Define the shape of the context
interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  adminLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  updateProfile: (profile: { displayName?: string }) => Promise<boolean>;
  logout: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  signInWithGoogle: (options?: { redirectTo?: string }) => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
  clearError: () => void;
  isAdmin: boolean;
}

// Create the auth context with default values
const SupabaseAuthContext = createContext<SupabaseAuthContextType>({
  user: null,
  session: null,
  loading: true,
  adminLoading: false,
  error: null,
  signIn: async () => false,
  signUp: async () => false,
  updateProfile: async () => false,
  logout: async () => false,
  resetPassword: async () => false,
  signInWithGoogle: async () => false,
  getAccessToken: async () => null,
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
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const applySessionState = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      setAdminLoading(true);
      try {
        await checkAdminStatus(nextSession.user.id, nextSession.access_token);
      } finally {
        setAdminLoading(false);
      }
    } else {
      setIsAdmin(false);
      setAdminLoading(false);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    let disposed = false;

    const init = async () => {
      setLoading(true);
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          'supabase.auth.getSession()'
        );
        if (disposed) return;
        if (error) throw error;
        await applySessionState(data.session);
      } catch (err) {
        console.error('Failed to initialize auth session:', err);
        if (disposed) return;
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setAdminLoading(false);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    init();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setLoading(true);
        try {
          // Note: ignore the event for state; session is source of truth here.
          await applySessionState(session);
        } catch (err) {
          console.error('Auth state change handler failed:', { event, err });
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setAdminLoading(false);
        } finally {
          setLoading(false);
        }
      }
    );

    const refreshOnResume = async () => {
      if (disposed) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      setLoading(true);
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          'supabase.auth.getSession() (resume)'
        );
        if (disposed) return;
        if (error) throw error;
        await applySessionState(data.session);
      } catch (err) {
        console.warn('Auth resume refresh failed:', err);
        if (disposed) return;
        // Keep current state if refresh fails; avoid forcing logout on transient issues.
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    window.addEventListener('focus', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnResume);

    return () => {
      disposed = true;
      window.removeEventListener('focus', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
      subscription.unsubscribe();
    };
  }, []);

  // Check if user is admin
  const checkAdminStatus = async (userId: string, accessToken?: string) => {
    try {
      // Best-effort: ensure the public.users row exists.
      // This avoids noisy 406s from PostgREST when a row is missing.
      if (accessToken) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6_000);
          try {
            await fetch('/api/auth/ensure-user', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timer);
          }
        } catch {
          // ignore
        }
      }

      const result = await withTimeout<any>(
        supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle(),
        10_000,
        'supabase.from(users).select(role)'
      );
      const { data, error } = result as { data: { role?: string } | null; error: any };

      if (error) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === 'admin');
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
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

      // Best-effort upsert to users table (DB trigger should provision reliably).
      if (data.user) {
        try {
          await supabase.from('users').upsert({
            id: data.user.id,
            email: data.user.email,
            display_name: displayName || '',
            role: 'user',
            subscription_tier: 'free',
          });
        } catch (e) {
          // Ignore: user row will be created by trigger or on first authenticated session.
          console.warn('Users table upsert skipped:', e);
        }
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  // Update profile (auth metadata + users table)
  const updateProfile = async (profile: { displayName?: string }) => {
    try {
      clearError();

      const displayName = profile.displayName?.trim();
      if (!displayName) {
        setError('Display name is required');
        return false;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUser = sessionData.session?.user;
      if (!currentUser) {
        setError('Not signed in');
        return false;
      }

      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
        },
      });
      if (updateAuthError) throw updateAuthError;

      // Best-effort update for app profile.
      await supabase
        .from('users')
        .upsert({
          id: currentUser.id,
          email: currentUser.email,
          display_name: displayName,
        });

      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
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
  const signInWithGoogle = async (options?: { redirectTo?: string }) => {
    try {
      clearError();

      const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
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

  const getAccessToken = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data.session?.access_token || null;
    } catch {
      return null;
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        loading,
        adminLoading,
        error,
        signIn,
        signUp,
        updateProfile,
        logout,
        resetPassword,
        signInWithGoogle,
        getAccessToken,
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
