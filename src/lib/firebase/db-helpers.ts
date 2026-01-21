// Legacy Firebase Firestore helpers.
// This file is intentionally disabled during the Supabase migration.

type QueryDocumentSnapshot = unknown;
type Timestamp = unknown;

// Generic type for Firestore document data
export type FirestoreDoc<T> = T & {
  id: string;
};

function disabled(): never {
  throw new Error('firebase/db-helpers.ts is disabled (legacy Firebase implementation retired).');
}

/**
 * Fetch a document by ID with type safety
 */
export async function getDocumentById<T>(
  collectionName: string, 
  docId: string
): Promise<FirestoreDoc<T> | null> {
  void collectionName;
  void docId;
  disabled();
}

/**
 * Create a new document with auto-generated ID
 */
export async function createDocument<T>(
  collectionName: string, 
  data: T
): Promise<string> {
  void collectionName;
  void data;
  disabled();
}

/**
 * Create or update a document with a specific ID
 */
export async function setDocument<T>(
  collectionName: string, 
  docId: string, 
  data: T,
  merge = true
): Promise<void> {
  void collectionName;
  void docId;
  void data;
  void merge;
  disabled();
}

/**
 * Update specific fields in a document
 */
export async function updateDocument(
  collectionName: string, 
  docId: string, 
  updates: Record<string, any>
): Promise<void> {
  void collectionName;
  void docId;
  void updates;
  disabled();
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(
  collectionName: string, 
  docId: string
): Promise<void> {
  void collectionName;
  void docId;
  disabled();
}

/**
 * Get documents by user ID with pagination
 */
export async function getDocumentsByUserId<T>(
  collectionName: string,
  userId: string,
  orderByField: string = 'createdAt',
  descending: boolean = true,
  limitCount: number = 10,
  startAfterDoc?: QueryDocumentSnapshot<any>
): Promise<{
  docs: FirestoreDoc<T>[];
  lastDoc: QueryDocumentSnapshot<any> | null;
}> {
  void collectionName;
  void userId;
  void orderByField;
  void descending;
  void limitCount;
  void startAfterDoc;
  disabled();
}

/**
 * Get documents by a specific field value
 */
export async function getDocumentsByField<T>(
  collectionName: string,
  fieldName: string,
  fieldValue: any,
  orderByField: string = 'createdAt',
  descending: boolean = true,
  limitCount: number = 10
): Promise<FirestoreDoc<T>[]> {
  void collectionName;
  void fieldName;
  void fieldValue;
  void orderByField;
  void descending;
  void limitCount;
  disabled();
}

/**
 * Increment a numeric field in a document
 */
export async function incrementField(
  collectionName: string, 
  docId: string, 
  fieldName: string, 
  incrementBy: number = 1
): Promise<void> {
  void collectionName;
  void docId;
  void fieldName;
  void incrementBy;
  disabled();
}

/**
 * Batch write multiple operations
 */
export async function batchOperations(
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    collectionName: string;
    docId: string;
    data?: any;
  }>
): Promise<void> {
  void operations;
  disabled();
}

/**
 * Subscribe to real-time updates for a document
 */
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: FirestoreDoc<T> | null) => void
): () => void {
  void collectionName;
  void docId;
  callback(null);
  return () => {};
}

/**
 * Subscribe to real-time updates for a query
 */
export function subscribeToQuery<T>(
  collectionName: string,
  conditions: {
    fieldPath: string;
    opStr: string;
    value: any;
  }[],
  callback: (data: FirestoreDoc<T>[]) => void
): () => void {
  void collectionName;
  void conditions;
  callback([]);
  return () => {};
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export function timestampToDate(timestamp: Timestamp): Date {
  void timestamp;
  disabled();
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export function dateToTimestamp(date: Date): Timestamp {
  void date;
  disabled();
} 