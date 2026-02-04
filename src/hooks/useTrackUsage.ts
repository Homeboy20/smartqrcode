import { useState, useCallback, useMemo } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppSettings } from '@/hooks/useAppSettings';
import { FeatureType } from '@/lib/subscription';

/**
 * Hook for tracking feature usage
 */
export function useTrackUsage() {
  const { user, getAccessToken } = useSupabaseAuth();
  const subscription = useSubscription();
  const { settings: appSettings } = useAppSettings();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseFeature = useCallback(
    (feature: string): boolean => {
      try {
        if (!feature) return false;
        return subscription.canUseFeature(feature);
      } catch (e) {
        console.error('Error in canUseFeature:', e);
        return false;
      }
    },
    [subscription]
  );

  // Memoize the isWithinUsageLimit function
  const isWithinUsageLimit = useCallback((feature: string, amount: number = 1): boolean => {
    try {
      if (!feature) return false;
      
      // For permission-based features
      if (feature === "pdfDownload" || feature === "svgDownload" || feature === "noWatermark" || feature === "fileUploads") {
        return canUseFeature(feature);
      }
      
      // For other features, check if reached limit via subscription hook
      return subscription.isWithinUsageLimit(feature, amount);
    } catch (error) {
      console.error("Error in isWithinUsageLimit:", error);
      return false;
    }
  }, [subscription, canUseFeature]);

  // Memoize the trackUsage function
  const trackUsage = useCallback(async (feature: FeatureType, amount: number = 1): Promise<boolean> => {
    // Anonymous Free Mode: allow basic features without tracking.
    if (!user) {
      const isFreeMode = !!appSettings?.freeMode;
      const allowsQr = !!appSettings?.freeModeFeatures?.qrCodeGeneration;
      const allowsBarcode = !!appSettings?.freeModeFeatures?.barcodeGeneration;

      const basicAllowed =
        isFreeMode &&
        ((feature === 'qrCodesGenerated' && allowsQr) || (feature === 'barcodesGenerated' && allowsBarcode));

      if (basicAllowed) return true;

      setError('User not authenticated');
      return false;
    }

    const token = await getAccessToken();
    if (!token) {
      setError('Unable to authenticate request');
      return false;
    }

    // Check if feature can be used
    if (!canUseFeature(feature)) {
      setError(`Feature ${feature} is not available on your plan`);
      return false;
    }

    // Check if user has reached limit based on local state first
    if (!isWithinUsageLimit(feature, amount)) {
      setError(`You've reached your ${feature} limit for your current plan`);
      return false;
    }

    try {
      setIsTracking(true);
      setError(null);

      const response = await fetch('/api/usage/track-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          feature,
          amount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to track usage');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while tracking usage');
      return false;
    } finally {
      setIsTracking(false);
    }
  }, [user, getAccessToken, canUseFeature, isWithinUsageLimit, appSettings]);

  // Get remaining usage for a feature (using local state data)
  const getRemainingUsage = useCallback((feature?: FeatureType): number => {
    if (!feature) return 0;
    return subscription.remainingUsage(feature);
  }, [subscription]);

  // Return stable object with memoized functions to prevent render loops
  return useMemo(() => ({
    trackUsage,
    isTracking,
    error,
    canUseFeature,
    getRemainingUsage,
    isWithinUsageLimit
  }), [
    trackUsage,
    isTracking,
    error,
    canUseFeature,
    getRemainingUsage,
    isWithinUsageLimit
  ]);
}

// Mapping of feature types to their limit properties
const featureLimitMap: Record<FeatureType, any> = {
  qrCodesGenerated: 'qrGenerationLimit',
  barcodesGenerated: 'barcodeGenerationLimit',
  bulkGenerations: 'bulkGenerationLimit',
  aiCustomizations: 'aiCustomizationLimit',

  // access-based features (no numeric limits)
  noWatermark: 'noWatermark',
  svgDownload: 'svgDownload',
  pdfDownload: 'pdfDownload',
  qrCodeTracking: 'qrCodeTracking',
  enhancedBarcodes: 'enhancedBarcodes',
  fileUploads: 'fileUploads',
  analytics: 'analytics',
  restaurant: 'restaurant',
  restaurantTeam: 'restaurantTeam',
}; 