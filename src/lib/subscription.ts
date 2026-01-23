import { SubscriptionFeatures } from '@/lib/types';

// Define the types directly here to avoid re-export issues
export type SubscriptionTier = 'free' | 'pro' | 'business';
export type FeatureType = 
  | 'qrCodesGenerated' 
  | 'barcodesGenerated' 
  | 'bulkGenerations' 
  | 'aiCustomizations'
  | 'noWatermark'
  | 'svgDownload'
  | 'pdfDownload'
  | 'qrCodeTracking'
  | 'enhancedBarcodes'
  | 'fileUploads'
  | 'analytics'
  | 'restaurant'
  | 'restaurantTeam';

// Define limits for each subscription tier
export const subscriptionLimits = {
  free: {
    qrGenerationLimit: {
      daily: 5,
      monthly: 50,
    },
    barcodeGenerationLimit: {
      daily: 5,
      monthly: 50,
    },
    bulkGenerationLimit: {
      daily: 1,
      monthly: 5,
    },
    aiCustomizationLimit: {
      daily: 0,
      monthly: 0,
    },
  },
  pro: {
    qrGenerationLimit: {
      daily: 50,
      monthly: 500,
    },
    barcodeGenerationLimit: {
      daily: 50,
      monthly: 500,
    },
    bulkGenerationLimit: {
      daily: 10,
      monthly: 100,
    },
    aiCustomizationLimit: {
      daily: 5,
      monthly: 50,
    },
  },
  business: {
    qrGenerationLimit: {
      daily: 500,
      monthly: 5000,
    },
    barcodeGenerationLimit: {
      daily: 500,
      monthly: 5000,
    },
    bulkGenerationLimit: {
      daily: 100,
      monthly: 1000,
    },
    aiCustomizationLimit: {
      daily: 50,
      monthly: 500,
    },
  },
};

// Define feature access for each tier
export const featureAccess = {
  free: {
    qrCodesGenerated: true,
    barcodesGenerated: true,
    bulkGenerations: true,
    aiCustomizations: false,
    noWatermark: false,
    svgDownload: false,
    pdfDownload: false,
    qrCodeTracking: false,
    enhancedBarcodes: false,
    fileUploads: false,
    analytics: false,
    restaurant: false,
    restaurantTeam: false
  },
  pro: {
    qrCodesGenerated: true,
    barcodesGenerated: true,
    bulkGenerations: true,
    aiCustomizations: true,
    noWatermark: true,
    svgDownload: true,
    pdfDownload: true,
    qrCodeTracking: true,
    enhancedBarcodes: true,
    fileUploads: true,
    analytics: true,
    restaurant: true,
    restaurantTeam: false
  },
  business: {
    qrCodesGenerated: true,
    barcodesGenerated: true,
    bulkGenerations: true,
    aiCustomizations: true,
    noWatermark: true,
    svgDownload: true,
    pdfDownload: true,
    qrCodeTracking: true,
    enhancedBarcodes: true,
    fileUploads: true,
    analytics: true,
    restaurant: true,
    restaurantTeam: true
  },
};

/**
 * Check if a user has access to a specific feature based on their subscription tier
 */
export function hasFeatureAccess(
  subscriptionTier: SubscriptionTier,
  feature: FeatureType
): boolean {
  const result = featureAccess[subscriptionTier][feature] || false;
  return result;
}

/**
 * Get the remaining usage for a feature based on the current usage and subscription tier
 */
export function getRemainingUsage(
  subscriptionTier: SubscriptionTier,
  feature: FeatureType,
  currentUsage: { daily: number; monthly: number }
): { daily: number; monthly: number } {
  let limitKey: string;
  
  switch (feature) {
    case 'qrCodesGenerated':
      limitKey = 'qrGenerationLimit';
      break;
    case 'barcodesGenerated':
      limitKey = 'barcodeGenerationLimit';
      break;
    case 'bulkGenerations':
      limitKey = 'bulkGenerationLimit';
      break;
    case 'aiCustomizations':
      limitKey = 'aiCustomizationLimit';
      break;
    case 'noWatermark':
    case 'svgDownload':
    case 'pdfDownload':
    case 'qrCodeTracking':
    case 'enhancedBarcodes':
    case 'fileUploads':
    case 'analytics':
    case 'restaurant':
    case 'restaurantTeam':
      // These are access-based features, not limited by usage
      return { daily: 999999, monthly: 999999 };
    default:
      limitKey = 'qrGenerationLimit';
  }
  
  const limits = subscriptionLimits[subscriptionTier][limitKey as keyof typeof subscriptionLimits.free];
  
  return {
    daily: Math.max(0, limits.daily - (currentUsage.daily || 0)),
    monthly: Math.max(0, limits.monthly - (currentUsage.monthly || 0)),
  };
}

/**
 * Check if a user has reached the limit for a specific feature
 */
export function hasReachedLimit(
  subscriptionTier: SubscriptionTier,
  feature: FeatureType,
  currentUsage: { daily: number; monthly: number }
): boolean {
  const remaining = getRemainingUsage(subscriptionTier, feature, currentUsage);
  return remaining.daily <= 0 || remaining.monthly <= 0;
} 