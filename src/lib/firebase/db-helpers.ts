import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  writeBatch,
  increment,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  onSnapshot,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './config';

// Generic type for Firestore document data
export type FirestoreDoc<T> = T & {
  id: string;
};

/**
 * Fetch a document by ID with type safety
 */
export async function getDocumentById<T>(
  collectionName: string, 
  docId: string
): Promise<FirestoreDoc<T> | null> {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as FirestoreDoc<T>;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching document from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Create a new document with auto-generated ID
 */
export async function createDocument<T>(
  collectionName: string, 
  data: T
): Promise<string> {
  try {
    const collectionRef = collection(db, collectionName);
    const docRef = await addDoc(collectionRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
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
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge });
  } catch (error) {
    console.error(`Error setting document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Update specific fields in a document
 */
export async function updateDocument(
  collectionName: string, 
  docId: string, 
  updates: Record<string, any>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(
  collectionName: string, 
  docId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
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
  try {
    let q = query(
      collection(db, collectionName),
      where('userId', '==', userId),
      orderBy(orderByField, descending ? 'desc' : 'asc'),
      limit(limitCount)
    );
    
    if (startAfterDoc) {
      q = query(q, startAfter(startAfterDoc));
    }
    
    const querySnapshot = await getDocs(q);
    const docs: FirestoreDoc<T>[] = [];
    
    querySnapshot.forEach((doc) => {
      docs.push({ id: doc.id, ...doc.data() } as FirestoreDoc<T>);
    });
    
    const lastDoc = querySnapshot.docs.length > 0 
      ? querySnapshot.docs[querySnapshot.docs.length - 1] 
      : null;
    
    return { docs, lastDoc };
  } catch (error) {
    console.error(`Error fetching documents from ${collectionName}:`, error);
    throw error;
  }
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
  try {
    const q = query(
      collection(db, collectionName),
      where(fieldName, '==', fieldValue),
      orderBy(orderByField, descending ? 'desc' : 'asc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const docs: FirestoreDoc<T>[] = [];
    
    querySnapshot.forEach((doc) => {
      docs.push({ id: doc.id, ...doc.data() } as FirestoreDoc<T>);
    });
    
    return docs;
  } catch (error) {
    console.error(`Error fetching documents from ${collectionName} by field:`, error);
    throw error;
  }
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
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      [fieldName]: increment(incrementBy),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`Error incrementing field in ${collectionName}:`, error);
    throw error;
  }
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
  try {
    const batch = writeBatch(db);
    
    operations.forEach(op => {
      const docRef = doc(db, op.collectionName, op.docId);
      
      if (op.type === 'set') {
        batch.set(docRef, {
          ...op.data,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else if (op.type === 'update') {
        batch.update(docRef, {
          ...op.data,
          updatedAt: serverTimestamp()
        });
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error performing batch operations:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for a document
 */
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: FirestoreDoc<T> | null) => void
): () => void {
  const docRef = doc(db, collectionName, docId);
  
  const unsubscribe = onSnapshot(
    docRef,
    (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as FirestoreDoc<T>);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`Error listening to document in ${collectionName}:`, error);
      callback(null);
    }
  );
  
  return unsubscribe;
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
  const collectionRef = collection(db, collectionName);
  
  const constraints = conditions.map(c => where(c.fieldPath, c.opStr as any, c.value));
  const q = query(collectionRef, ...constraints);
  
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const docs: FirestoreDoc<T>[] = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as FirestoreDoc<T>);
      });
      callback(docs);
    },
    (error) => {
      console.error(`Error listening to query in ${collectionName}:`, error);
      callback([]);
    }
  );
  
  return unsubscribe;
}

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export function timestampToDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export function dateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
} 