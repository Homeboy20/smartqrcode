// Define subscription tiers and their features/limits
export type SubscriptionTier = 'free' | 'pro' | 'business';

interface FeatureLimits {
  maxQRCodes: number;
  maxBarcodes: number;
  bulkGenerationAllowed: boolean;
  maxBulkItems: number;
  aiCustomizationAllowed: boolean;
  maxAICustomizations: number;
  analyticsEnabled: boolean;
  customBrandingAllowed: boolean;
  restaurant: boolean;
  restaurantTeam: boolean;
  teamMembersAllowed: boolean;
  maxTeamMembers: number;
}

// Map subscription tiers to their features and limits
export const subscriptionFeatures: Record<SubscriptionTier, FeatureLimits> = {
  free: {
    maxQRCodes: 10,
    maxBarcodes: 5,
    bulkGenerationAllowed: false,
    maxBulkItems: 0,
    aiCustomizationAllowed: false,
    maxAICustomizations: 0,
    analyticsEnabled: false,
    customBrandingAllowed: false,
    restaurant: false,
    restaurantTeam: false,
    teamMembersAllowed: false,
    maxTeamMembers: 0
  },
  pro: {
    maxQRCodes: 100,
    maxBarcodes: 50,
    bulkGenerationAllowed: true,
    maxBulkItems: 25,
    aiCustomizationAllowed: true,
    maxAICustomizations: 10,
    analyticsEnabled: true,
    customBrandingAllowed: true,
    restaurant: true,
    restaurantTeam: false,
    teamMembersAllowed: false,
    maxTeamMembers: 0
  },
  business: {
    maxQRCodes: 1000,
    maxBarcodes: 500,
    bulkGenerationAllowed: true,
    maxBulkItems: 100,
    aiCustomizationAllowed: true,
    maxAICustomizations: 50,
    analyticsEnabled: true,
    customBrandingAllowed: true,
    restaurant: true,
    restaurantTeam: true,
    teamMembersAllowed: true,
    maxTeamMembers: 5
  }
};

// Subscription pricing (monthly)
export const subscriptionPricing: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 9.99,
  business: 29.99
};

// Helper function to check if a user has access to a specific feature
export function hasFeatureAccess(
  subscriptionTier: SubscriptionTier,
  feature: keyof FeatureLimits
): boolean {
  const tierFeatures = subscriptionFeatures[subscriptionTier];
  
  if (feature === 'bulkGenerationAllowed' || 
      feature === 'aiCustomizationAllowed' || 
      feature === 'analyticsEnabled' || 
      feature === 'customBrandingAllowed' ||
      feature === 'restaurant' ||
      feature === 'restaurantTeam' ||
      feature === 'teamMembersAllowed') {
    return tierFeatures[feature];
  }
  
  // For numeric limits, return true if the limit is greater than 0
  return (tierFeatures[feature] as number) > 0;
}

// Helper function to get the limit for a specific feature
export function getFeatureLimit(
  subscriptionTier: SubscriptionTier,
  feature: keyof FeatureLimits
): number {
  return subscriptionFeatures[subscriptionTier][feature] as number;
}

// Helper to get subscription tier details for display
export function getSubscriptionDetails(tier: SubscriptionTier) {
  return {
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    price: subscriptionPricing[tier],
    features: subscriptionFeatures[tier]
  };
} 