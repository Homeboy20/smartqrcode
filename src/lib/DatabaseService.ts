export const COLLECTIONS = {
  USERS: 'users',
  CODES: 'codes',
  SUBSCRIPTIONS: 'subscriptions',
  TRANSACTIONS: 'transactions',
  APP_CREDENTIALS: 'app_credentials',
  GATEWAY_CONFIG: 'gateway_config',
} as const;

export class DatabaseService {
  static createDocPath(collectionName: string, docId: string): string {
    return `${collectionName}/${docId}`;
  }

  static async getDocument<T>(_: string, __: string): Promise<T | null> {
    throw new Error('DatabaseService is disabled (legacy Firebase implementation retired).');
  }

  static async setDocument<T>(_: string, __: string, ___: T): Promise<void> {
    throw new Error('DatabaseService is disabled (legacy Firebase implementation retired).');
  }

  static async updateDocument<T>(_: string, __: string, ___: T): Promise<void> {
    throw new Error('DatabaseService is disabled (legacy Firebase implementation retired).');
  }

  static async deleteDocument(_: string, __: string): Promise<void> {
    throw new Error('DatabaseService is disabled (legacy Firebase implementation retired).');
  }

  static async queryDocuments<T>(_: string, __: unknown[] = []): Promise<T[]> {
    void __;
    throw new Error('DatabaseService is disabled (legacy Firebase implementation retired).');
  }

  static listenToDocument<T>(_: string, __: string, callback: (data: T | null) => void): () => void {
    callback(null);
    return () => {};
  }

  static listenToQuery<T>(_: string, __: unknown[] = [], callback: (data: T[]) => void): () => void {
    void __;
    callback([]);
    return () => {};
  }

  static clearCache(): void {
    // no-op
  }
}

