import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export type RestaurantStaffRole = 'manager' | 'kitchen' | 'waiter' | 'delivery';

export type RestaurantAccess = {
  userId: string;
  restaurantId: string;
  isOwner: boolean;
  staffRole: RestaurantStaffRole | null;
  canManageStaff: boolean;
};

type State =
  | { loading: true; access: null; error: null }
  | { loading: false; access: RestaurantAccess; error: null }
  | { loading: false; access: null; error: string };

export function useRestaurantAccess(): State {
  const { user, getAccessToken } = useSupabaseAuth();
  const [state, setState] = useState<State>({ loading: true, access: null, error: null });

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setState({ loading: false, access: null, error: 'Not signed in' });
      return;
    }

    (async () => {
      setState({ loading: true, access: null, error: null });

      try {
        // Prefer cookie auth; fall back to bearer token.
        let res = await fetch('/api/restaurant/access', { method: 'GET' });
        if (res.status === 401) {
          const token = await getAccessToken();
          if (token) {
            res = await fetch('/api/restaurant/access', {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        }

        const body = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to load access');
        }

        const access = body?.access as RestaurantAccess;
        if (!access?.restaurantId) {
          throw new Error('Restaurant access not found');
        }

        if (!cancelled) setState({ loading: false, access, error: null });
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, access: null, error: String(e?.message || 'Failed to load access') });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken]);

  return state;
}
