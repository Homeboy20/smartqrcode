import type { UseSubscriptionReturn } from '@/lib/types';
import { useSubscription } from '@/hooks/useSubscription';

// Backwards-compatible wrapper. The canonical implementation now lives in hooks/useSubscription.tsx.
export function useSupabaseSubscription(): UseSubscriptionReturn {
  return useSubscription();
}
