import { hasFeatureAccess, type FeatureType, type SubscriptionTier } from '@/lib/subscription';

export async function getUserSubscriptionTier(supabase: any, userId: string): Promise<SubscriptionTier> {
  const { data } = await supabase.from('users').select('subscription_tier').eq('id', userId).maybeSingle();
  return ((data as any)?.subscription_tier || 'free') as SubscriptionTier;
}

export async function requireFeatureAccess(
  supabase: any,
  userId: string,
  feature: FeatureType,
  message?: string
): Promise<{ ok: true; tier: SubscriptionTier } | { ok: false; status: number; error: string; tier: SubscriptionTier }> {
  const tier = await getUserSubscriptionTier(supabase, userId);
  if (hasFeatureAccess(tier, feature)) return { ok: true, tier };

  return {
    ok: false,
    status: 402,
    tier,
    error: message || 'This feature requires a Pro or Business plan (or paid trial).',
  };
}
