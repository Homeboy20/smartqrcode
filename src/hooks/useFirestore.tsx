type DocumentData = Record<string, unknown>;
type QueryConstraint = unknown;

export function useDocument<T extends DocumentData>(
  _collectionName: string,
  _documentId: string | null | undefined,
  _options = { listen: true }
) {
  return {
    data: null as T | null,
    loading: false,
    error: new Error('useFirestore hooks are disabled (legacy Firebase implementation retired).'),
    refreshData: async () => {},
    updateDocument: async () => false,
  };
}

export function useCollection<T extends DocumentData>(
  _collectionName: string,
  _queryConstraints: QueryConstraint[] = [],
  _options = { listen: true }
) {
  return {
    data: [] as T[],
    loading: false,
    error: new Error('useFirestore hooks are disabled (legacy Firebase implementation retired).'),
    refreshData: async () => {},
  };
}

export function useUserData(_userId: string | null | undefined) {
  return useDocument<DocumentData>('users', _userId);
}

export function useUserCodes(_userId: string | null | undefined, _options = { listen: true }) {
  return useCollection<DocumentData>('codes');
}

export function useUserSubscription(_userId: string | null | undefined) {
  return useCollection<DocumentData>('subscriptions');
}