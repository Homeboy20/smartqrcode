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
  refreshSession: () => Promise<void>;
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
  refreshSession: async () => {},
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
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const lastRefreshRef = React.useRef<number>(0);

  // Check if user is admin
  const checkAdminStatus = React.useCallback(async (_userId: string, accessToken?: string) => {
    if (!accessToken) {
      setIsAdmin(false);
      return;
    }

    // Best-effort: ensure the public.users row exists.
    // This avoids noisy 406s from PostgREST when a row is missing.
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

    // Use a server-side check (service role) so client RLS cannot cause false negatives.
    try {
      const response = await withTimeout(
        fetch('/api/admin/auth-status', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        7_000,
        'GET /api/admin/auth-status'
      );

      const body = await response.json().catch(() => ({} as any));

      if (response.ok) {
        setIsAdmin(Boolean(body?.isAdmin));
        return;
      }

      // Only treat explicit auth failures as non-admin.
      if (response.status === 401 || response.status === 403) {
        setIsAdmin(false);
      }
      // For other failures (5xx, network), keep existing `isAdmin` to avoid lockouts.
    } catch (err) {
      console.warn('Admin status check failed:', err);
      // Keep existing `isAdmin` on transient errors.
    }
  }, []);

  const applySessionState = React.useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    const now = Date.now();
    setLastRefresh(now);
    lastRefreshRef.current = now;

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
  }, [checkAdminStatus]);

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

      // Skip refresh if session was validated recently (< 5 minutes ago)
      // Use ref to avoid stale closure
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshRef.current;
      if (timeSinceLastRefresh < 5 * 60 * 1000) {
        return;
      }

      // Refresh in background without blocking UI
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          5_000,
          'supabase.auth.getSession() (resume)'
        );
        if (disposed) return;
        if (error) throw error;
        await applySessionState(data.session);
      } catch (err) {
        console.warn('Auth resume refresh failed:', err);
        if (disposed) return;
        // Keep current state if refresh fails; avoid forcing logout on transient issues.
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
  }, [applySessionState]);

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
        // Parse specific error messages
        let errorMsg = error.message;
        if (error.message.toLowerCase().includes('already registered') || 
            error.message.toLowerCase().includes('email already exists')) {
          errorMsg = 'This email is already registered. Please sign in instead.';
        } else if (error.message.toLowerCase().includes('invalid email')) {
          errorMsg = 'Please enter a valid email address.';
        } else if (error.message.toLowerCase().includes('password')) {
          errorMsg = 'Password must be at least 6 characters long.';
        }
        setError(errorMsg);
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
      setError(err.message || 'Registration failed');
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

  // Sign in with Google (auto-login if account exists)
  const signInWithGoogle = async (options?: { redirectTo?: string }) => {
    try {
      clearError();

      const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`;
      // OAuth flow handles both signup and signin automatically
      // If account exists, it signs in; if not, it creates new account
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

  const refreshSession = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        10_000,
        'supabase.auth.getSession() (manual refresh)'
      );
      if (error) throw error;
      await applySessionState(data.session);
    } catch (err) {
      console.warn('Manual auth session refresh failed:', err);
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
        refreshSession,
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
