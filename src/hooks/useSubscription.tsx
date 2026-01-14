import { useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { SubscriptionTier, UserData, UseSubscriptionReturn } from '@/lib/types';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  FeatureType,
  hasFeatureAccess,
  getRemainingUsage,
  hasReachedLimit,
  subscriptionLimits,
  featureAccess,
} from '@/lib/subscription';
import { supabase } from '@/lib/supabase/client';

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useSupabaseAuth();
  const { settings: appSettings, loading: appSettingsLoading } = useAppSettings();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (!user) {
        setUserData(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        // If no user record exists yet, create it via ensure-user endpoint
        if (!data) {
          console.log('User record not found, creating...');
          async function getAccessTokenWithRetry(): Promise<string | null> {
            for (let attempt = 0; attempt < 3; attempt++) {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData.session?.access_token || null;
              if (token) return token;
              await new Promise((r) => setTimeout(r, 150));
            }
            return null;
          }

          const accessToken = await getAccessTokenWithRetry();

          const ensureRes = await fetch('/api/auth/ensure-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
          });

          if (!ensureRes.ok) {
            const body = await ensureRes.json().catch(() => null);
            throw new Error(body?.error || 'Failed to create user record');
          }

          // Retry fetching user data
          const { data: retryData, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (retryError || !retryData) {
            throw retryError || new Error('Failed to create user record');
          }
          
          // Use the retry data
          const featuresUsage = (retryData?.features_usage as any) || {};
          const mapped: UserData = {
            id: user.id,
            email: retryData?.email || user.email || '',
            displayName: retryData?.display_name || (user.user_metadata as any)?.display_name || (user.user_metadata as any)?.full_name || null,
            photoURL: retryData?.photo_url || (user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture || '',
            subscriptionTier: ((retryData?.subscription_tier as SubscriptionTier) || 'free') as SubscriptionTier,
            role: (retryData?.role as any) || 'user',
            featuresUsage: {
              qrCodesGenerated: Number(featuresUsage.qrCodesGenerated || 0),
              barcodesGenerated: Number(featuresUsage.barcodesGenerated || 0),
              bulkGenerations: Number(featuresUsage.bulkGenerations || 0),
              aiCustomizations: Number(featuresUsage.aiCustomizations || 0),
            },
          };
          setUserData(mapped);
          setLoading(false);
          return;
        }

        const featuresUsage = (data?.features_usage as any) || {};

        const mapped: UserData = {
          id: user.id,
          email: data?.email || user.email || '',
          displayName: data?.display_name || (user.user_metadata as any)?.display_name || (user.user_metadata as any)?.full_name || null,
          photoURL: data?.photo_url || (user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.picture || '',
          subscriptionTier: ((data?.subscription_tier as SubscriptionTier) || 'free') as SubscriptionTier,
          role: (data?.role as any) || 'user',
          featuresUsage: {
            qrCodesGenerated: Number(featuresUsage.qrCodesGenerated || 0),
            barcodesGenerated: Number(featuresUsage.barcodesGenerated || 0),
            bulkGenerations: Number(featuresUsage.bulkGenerations || 0),
            aiCustomizations: Number(featuresUsage.aiCustomizations || 0),
          },
        };

        setUserData(mapped);
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError(err?.message || 'Could not fetch user data, using default settings');

        setUserData({
          id: user.id,
          email: user.email || '',
          displayName: ((user.user_metadata as any)?.display_name || (user.user_metadata as any)?.full_name || null) as any,
          photoURL: ((user.user_metadata as any)?.avatar_url || '') as any,
          subscriptionTier: 'free',
          role: 'user',
          featuresUsage: {
            qrCodesGenerated: 0,
            barcodesGenerated: 0,
            bulkGenerations: 0,
            aiCustomizations: 0,
          },
        });
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user]);

  const subscriptionTier = userData?.subscriptionTier || 'free';
  const freeModeForAuthenticatedUser = !!user && !!appSettings?.freeMode;
  const effectiveTier: SubscriptionTier = freeModeForAuthenticatedUser ? 'business' : subscriptionTier;

  const featuresUsage = useMemo(
    () =>
      userData?.featuresUsage || {
        qrCodesGenerated: 0,
        barcodesGenerated: 0,
        bulkGenerations: 0,
        aiCustomizations: 0,
      },
    [userData]
  );

  const unlimited = Number.MAX_SAFE_INTEGER;
  const effectiveLimits = freeModeForAuthenticatedUser
    ? {
        qrGenerationLimit: { daily: unlimited, monthly: unlimited },
        barcodeGenerationLimit: { daily: unlimited, monthly: unlimited },
        bulkGenerationLimit: { daily: unlimited, monthly: unlimited },
        aiCustomizationLimit: { daily: unlimited, monthly: unlimited },
      }
    : subscriptionLimits[effectiveTier as SubscriptionTier];

  return {
    loading: loading || appSettingsLoading,
    error,
    subscriptionTier: effectiveTier,
    featuresUsage,
    limits: effectiveLimits,
    getLimit: (featureKey: string) => {
      if (freeModeForAuthenticatedUser) return unlimited;
      try {
        const tier = effectiveTier as SubscriptionTier;
        const tierLimits = subscriptionLimits[tier];
        
        if (!tierLimits) return 0;
        
        const feature = featureKey as keyof typeof subscriptionLimits.free;
        const featureLimits = tierLimits[feature];
        
        if (!featureLimits) return 0;
        
        return featureLimits.daily ?? 0;
      } catch (error) {
        console.error(`Error in getLimit for ${featureKey}:`, error);
        return 0;
      }
    },
    canUseFeature: (feature: string) => {
      if (freeModeForAuthenticatedUser) return true;

      // Anonymous Free Mode: allow only basic generation.
      if (!user && appSettings?.freeMode) {
        const ft = feature as FeatureType;
        if (ft === 'qrCodesGenerated') return !!appSettings.freeModeFeatures.qrCodeGeneration;
        if (ft === 'barcodesGenerated') return !!appSettings.freeModeFeatures.barcodeGeneration;
        return false;
      }

      const ft = feature as FeatureType;
      return hasFeatureAccess(effectiveTier as SubscriptionTier, ft);
    },
    remainingUsage: (feature: string) => {
      if (freeModeForAuthenticatedUser) return unlimited;
      if (!user && appSettings?.freeMode) return unlimited;

      const ft = feature as FeatureType;
      const count = (featuresUsage as any)[ft] || 0;
      const result = getRemainingUsage(effectiveTier as SubscriptionTier, ft, { daily: count, monthly: count });
      return result.daily;
    },
    hasReachedLimit: (feature: string) => {
      if (freeModeForAuthenticatedUser) return false;
      if (!user && appSettings?.freeMode) return false;

      const ft = feature as FeatureType;
      const count = (featuresUsage as any)[ft] || 0;
      return hasReachedLimit(effectiveTier as SubscriptionTier, ft, { daily: count, monthly: count });
    },
    // Check if a usage amount is within the remaining limit
    isWithinUsageLimit: (feature: string, amount: number = 1): boolean => {
      if (freeModeForAuthenticatedUser) return true;
      if (!user && appSettings?.freeMode) return true;
      try {
        const ft = feature as FeatureType;
        const count = (featuresUsage as any)[ft] || 0;
        const remaining = getRemainingUsage(effectiveTier as SubscriptionTier, ft, { daily: count, monthly: count });
        return remaining.daily >= amount;
      } catch (error) {
        console.error("Error in isWithinUsageLimit:", error);
        return false;
      }
    }
  };
} 