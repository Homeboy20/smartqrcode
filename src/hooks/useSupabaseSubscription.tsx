import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { SubscriptionTier, UserData, UseSubscriptionReturn } from '../lib/types';
import { 
  hasFeatureAccess, 
  getRemainingUsage, 
  hasReachedLimit,
  subscriptionLimits,
  featureAccess
} from '../lib/subscription';
import { supabase } from '@/lib/supabase/client';

export function useSupabaseSubscription(): UseSubscriptionReturn {
  const { user } = useSupabaseAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (!user) {
        // If no user is logged in, set default data
        setUserData(null);
        setLoading(false);
        return;
      }

      try {
        console.log("Attempting to fetch user data for:", user.id);
        
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          console.log("User data retrieved successfully");
          // Map Supabase data to UserData format
          const mappedData: UserData = {
            id: data.id,
            email: data.email || '',
            displayName: data.display_name || '',
            photoURL: data.photo_url || '',
            subscriptionTier: (data.subscription_tier || 'free') as SubscriptionTier,
            role: data.role || 'user',
            featuresUsage: data.features_usage || {
              qrCodesGenerated: 0,
              barcodesGenerated: 0,
              bulkGenerations: 0,
              aiCustomizations: 0
            }
          };
          console.log("User subscription tier:", mappedData.subscriptionTier);
          setUserData(mappedData);
        } else {
          // If user document doesn't exist, create default user data
          console.log("No user document found, creating default data");
          const defaultUserData: UserData = {
            id: user.id,
            email: user.email || '',
            displayName: user.user_metadata?.display_name || '',
            photoURL: user.user_metadata?.avatar_url || '',
            subscriptionTier: 'free',
            role: 'user',
            featuresUsage: {
              qrCodesGenerated: 0,
              barcodesGenerated: 0,
              bulkGenerations: 0,
              aiCustomizations: 0
            }
          };
          setUserData(defaultUserData);
        }
      } catch (error: any) {
        console.error('Error fetching user data:', error);
        
        // On error, set default user data instead of failing
        const defaultUserData: UserData = {
          id: user.id,
          email: user.email || '',
          displayName: user.user_metadata?.display_name || '',
          photoURL: user.user_metadata?.avatar_url || '',
          subscriptionTier: 'free',
          role: 'user',
          featuresUsage: {
            qrCodesGenerated: 0,
            barcodesGenerated: 0,
            bulkGenerations: 0,
            aiCustomizations: 0
          }
        };
        setUserData(defaultUserData);
        setError(error.message || 'Could not fetch user data, using default settings');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user]);

  // Get the current tier, defaulting to free
  const currentTier: SubscriptionTier = userData?.subscriptionTier || 'free';

  // Check if a specific feature is available
  const checkFeatureAccess = (feature: string): boolean => {
    return hasFeatureAccess(currentTier, feature);
  };

  // Get remaining usage for a feature
  const checkRemainingUsage = (feature: string): number => {
    const usage = userData?.featuresUsage || {};
    return getRemainingUsage(currentTier, feature, usage[feature] || 0);
  };

  // Check if user has reached the limit for a feature
  const checkHasReachedLimit = (feature: string): boolean => {
    const usage = userData?.featuresUsage || {};
    return hasReachedLimit(currentTier, feature, usage[feature] || 0);
  };

  return {
    userData,
    loading,
    error,
    currentTier,
    checkFeatureAccess,
    checkRemainingUsage,
    checkHasReachedLimit,
    limits: subscriptionLimits[currentTier],
    featureAccess: featureAccess[currentTier]
  };
}
