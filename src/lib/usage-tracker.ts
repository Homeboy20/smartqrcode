import { FeatureType } from '@/lib/subscription';

export type UsageStats = {
  features: Record<
    string,
    {
      daily: { count: number; lastReset: Date };
      monthly: { count: number; lastReset: Date };
    }
  >;
};

// Legacy Firebase usage tracking was retired during the Supabase migration.
// These are safe no-op stubs kept to preserve imports.

export async function getUserUsageStats(_userId: string): Promise<UsageStats> {
  return { features: {} };
}

export async function incrementUsage(
  _userId: string,
  _feature: FeatureType,
  _amount: number = 1
): Promise<void> {
  // no-op
}

export async function resetUsageStats(_userId: string, _feature?: FeatureType): Promise<void> {
  // no-op
}
