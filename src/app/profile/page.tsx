'use client';

import React, { useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
  subscriptionTier: string;
  role: string;
  createdAt?: any;
  lastLogin?: any;
  featuresUsage?: {
    qrCodesGenerated: number;
    barcodesGenerated: number;
    bulkGenerations: number;
    aiCustomizations: number;
  };
}

export default function ProfilePage() {
  const { user, loading, logout, updateProfile } = useSupabaseAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/profile');
    }
  }, [user, loading, router]);

  // Populate profile state from Supabase user (no /api/user/profile route exists)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    setProfileLoading(false);
    setError(null);

    const createdAtRaw = (user as any).created_at as string | undefined;
    const lastLoginRaw = (user as any).last_sign_in_at as string | undefined;
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : undefined;
    const lastLogin = lastLoginRaw ? new Date(lastLoginRaw) : undefined;

    const displayNameFromMeta =
      (user.user_metadata as any)?.display_name ||
      (user.user_metadata as any)?.full_name ||
      '';
    const avatarFromMeta =
      (user.user_metadata as any)?.avatar_url ||
      (user.user_metadata as any)?.picture ||
      undefined;

    if (createdAt) {
      const now = new Date();
      if (now.getTime() - createdAt.getTime() < 5 * 60 * 1000) {
        setIsNewUser(true);
      }
    }

    setUserProfile({
      displayName: displayNameFromMeta || '',
      email: user.email || '',
      photoURL: avatarFromMeta,
      subscriptionTier: 'free',
      role: 'user',
      createdAt,
      lastLogin,
    });

    setFormData({
      displayName: displayNameFromMeta || '',
    });

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('display_name, photo_url, subscription_tier, role, features_usage, created_at')
          .eq('id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (cancelled) return;

        // If no user record exists, create it
        if (!data) {
          await fetch('/api/auth/ensure-user', { method: 'POST' });
          // Use defaults for now, profile will update on next load
          if (cancelled) return;
        }

        const dbDisplayName = (data as any)?.display_name as string | null | undefined;
        const dbPhotoUrl = (data as any)?.photo_url as string | null | undefined;
        const subscriptionTier = ((data as any)?.subscription_tier as string | undefined) || 'free';
        const role = ((data as any)?.role as string | undefined) || 'user';
        const featuresUsage = ((data as any)?.features_usage as any) || undefined;
        const dbCreatedAtRaw = (data as any)?.created_at as string | undefined;
        const dbCreatedAt = dbCreatedAtRaw ? new Date(dbCreatedAtRaw) : undefined;

        // Prefer DB profile values, then auth metadata fallbacks.
        setUserProfile(prev => {
          const base = prev || {
            displayName: displayNameFromMeta || '',
            email: user.email || '',
            photoURL: avatarFromMeta,
            subscriptionTier: 'free',
            role: 'user',
            createdAt,
            lastLogin,
            featuresUsage: undefined,
          };

          return {
            ...base,
            displayName: dbDisplayName || base.displayName,
            photoURL: dbPhotoUrl || base.photoURL,
            subscriptionTier,
            role,
            createdAt: dbCreatedAt || base.createdAt,
            featuresUsage: featuresUsage
              ? {
                  qrCodesGenerated: Number(featuresUsage.qrCodesGenerated || 0),
                  barcodesGenerated: Number(featuresUsage.barcodesGenerated || 0),
                  bulkGenerations: Number(featuresUsage.bulkGenerations || 0),
                  aiCustomizations: Number(featuresUsage.aiCustomizations || 0),
                }
              : base.featuresUsage,
          };
        });

        if (dbDisplayName) {
          setFormData({ displayName: dbDisplayName });
        }

        if (dbCreatedAt) {
          const now = new Date();
          if (now.getTime() - dbCreatedAt.getTime() < 5 * 60 * 1000) {
            setIsNewUser(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load profile from users table:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      setProfileLoading(true);
      setError(null);
      setUpdateSuccess(false);

      const success = await updateProfile({ displayName: formData.displayName });
      if (!success) {
        throw new Error('Failed to update profile');
      }

      setUserProfile(prev =>
        prev
          ? { ...prev, displayName: formData.displayName }
          : {
              displayName: formData.displayName,
              email: user.email || '',
              photoURL: (user.user_metadata as any)?.avatar_url || undefined,
              subscriptionTier: 'free',
              role: 'user',
            }
      );
      setUpdateSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  // Show loading until we know auth status
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // User must be logged in to view this page
  if (!user) {
    return null; // useEffect will redirect
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore timestamps with _seconds and _nanoseconds
      if (timestamp._seconds !== undefined) {
        return new Date(timestamp._seconds * 1000).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      
      // Handle standard dates
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (err) {
      console.error('Error formatting date:', timestamp, err);
      return 'Invalid date';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {isNewUser && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800">Welcome to ScanMagic!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Your account has been created successfully. You can now:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Create customized QR codes and barcodes</li>
                  <li>Track their usage with analytics</li>
                  <li>Manage your account settings below</li>
                </ul>
              </div>
              <div className="mt-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account information and settings
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {updateSuccess && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">Profile updated successfully!</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Account Information</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and account status</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Log Out
              </button>
            </div>

            {profileLoading ? (
              <div className="px-4 py-8 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading profile data...</p>
              </div>
            ) : (
              <>
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{userProfile?.email || user.email}</dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Subscription</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${userProfile?.subscriptionTier === 'business' ? 'bg-purple-100 text-purple-800' : 
                            userProfile?.subscriptionTier === 'pro' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {(userProfile?.subscriptionTier
                            ? userProfile.subscriptionTier.charAt(0).toUpperCase() + userProfile.subscriptionTier.slice(1)
                            : 'Free')}
                        </span>
                        {(userProfile?.subscriptionTier === 'free' || !userProfile?.subscriptionTier) && (
                          <Link href="/pricing" className="ml-3 text-xs text-indigo-600 hover:text-indigo-900">
                            Upgrade Now
                          </Link>
                        )}
                      </dd>
                    </div>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Account Created</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(userProfile?.createdAt)}</dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatDate(userProfile?.lastLogin)}</dd>
                    </div>
                  </dl>
                </div>
              </>
            )}
          </div>

          {userProfile?.featuresUsage && (
            <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Usage Statistics</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Your activity on the platform</p>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">QR Codes</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {userProfile.featuresUsage.qrCodesGenerated}
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Barcodes</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {userProfile.featuresUsage.barcodesGenerated}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Bulk Operations</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {userProfile.featuresUsage.bulkGenerations}
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">AI Customizations</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {userProfile.featuresUsage.aiCustomizations}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Profile</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Update your personal information</p>
            </div>

            <div className="border-t border-gray-200 p-6">
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                      Display Name
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="displayName"
                        id="displayName"
                        value={formData.displayName}
                        onChange={handleInputChange}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="How should we call you?"
                      />
                    </div>
                  </div>

                  <div className="pt-5">
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={profileLoading}
                        className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {profileLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Things you can do with your account</p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <div className="flex-shrink-0">
                    <svg className="h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href="/create" className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      <p className="text-sm font-medium text-gray-900">Create New QR Code</p>
                      <p className="text-sm text-gray-500 truncate">Generate a custom QR code for your business</p>
                    </Link>
                  </div>
                </div>

                <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <div className="flex-shrink-0">
                    <svg className="h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href="/analytics" className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      <p className="text-sm font-medium text-gray-900">View Analytics</p>
                      <p className="text-sm text-gray-500 truncate">Track the performance of your codes</p>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 