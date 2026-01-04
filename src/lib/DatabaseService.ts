import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  Timestamp,
  serverTimestamp,
  limit,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  FieldValue
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserData } from './firestore';

// Collection name constants to avoid typos
export const COLLECTIONS = {
  USERS: 'users',
  CODES: 'codes',
  SUBSCRIPTIONS: 'subscriptions',
  TRANSACTIONS: 'transactions',
  APP_CREDENTIALS: 'app_credentials',
  GATEWAY_CONFIG: 'gateway_config'
};

/**
 * Class for managing interactions with Firestore database
 * Provides a consistent API and handles caching
 */
export class DatabaseService {
  // Cache for document data
  private static memoryCache: { [key: string]: { data: any, timestamp: number } } = {};
  private static CACHE_TTL = 60 * 1000; // 60 seconds cache lifetime
  
  /**
   * Creates a document path string
   */
  static createDocPath(collectionName: string, docId: string): string {
    return `${collectionName}/${docId}`;
  }
  
  /**
   * Get a document with caching
   */
  static async getDocument<T extends DocumentData>(
    collectionName: string, 
    docId: string, 
    options = { useCache: true }
  ): Promise<T | null> {
    const docPath = this.createDocPath(collectionName, docId);
    const now = Date.now();
    
    // Try getting from cache first
    if (options.useCache && 
        this.memoryCache[docPath] && 
        now - this.memoryCache[docPath].timestamp < this.CACHE_TTL) {
      console.log(`[DB] Cache hit for ${docPath}`);
      return this.memoryCache[docPath].data as T;
    }
    
    // Get from Firestore
    console.log(`[DB] Fetching ${docPath}`);
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = { ...docSnap.data(), id: docId } as unknown as T;
      
      // Update cache
      this.memoryCache[docPath] = {
        data: { ...data, id: docId } as unknown as T,
        timestamp: now
      };
      
      return data;
    }
    
    return null;
  }
  
  /**
   * Set a document with caching
   */
  static async setDocument<T extends DocumentData>(
    collectionName: string, 
    docId: string, 
    data: T, 
    options = { merge: true }
  ): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    
    // Add timestamps
    const dataWithTimestamps: DocumentData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // If it's a new document (not merging), add createdAt
    if (!options.merge) {
      dataWithTimestamps.createdAt = serverTimestamp();
    }
    
    await setDoc(docRef, dataWithTimestamps, { merge: options.merge });
    
    // Update cache
    const docPath = this.createDocPath(collectionName, docId);
    this.memoryCache[docPath] = {
      data: { ...data, id: docId } as unknown as T,
      timestamp: Date.now()
    };
  }
  
  /**
   * Update a document with caching
   */
  static async updateDocument<T extends Partial<DocumentData>>(
    collectionName: string, 
    docId: string, 
    data: T
  ): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    
    // Add timestamp
    const dataWithTimestamp: DocumentData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, dataWithTimestamp);
    
    // Invalidate cache - don't update directly as the serverTimestamp 
    // won't be resolved until next fetch
    const docPath = this.createDocPath(collectionName, docId);
    delete this.memoryCache[docPath];
  }
  
  /**
   * Delete a document and remove from cache
   */
  static async deleteDocument(collectionName: string, docId: string): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    
    // Remove from cache
    const docPath = this.createDocPath(collectionName, docId);
    delete this.memoryCache[docPath];
  }
  
  /**
   * Query documents with optional constraints
   */
  static async queryDocuments<T extends DocumentData>(
    collectionName: string,
    queryConstraints: QueryConstraint[] = []
  ): Promise<T[]> {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...queryConstraints);
    
    const querySnapshot = await getDocs(q);
    const results: T[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const docData = docSnapshot.data();
      const data = { ...docData, id: docSnapshot.id } as unknown as T;
      results.push(data);
      
      // Cache individual documents
      this.memoryCache[this.createDocPath(collectionName, docSnapshot.id)] = {
        data,
        timestamp: Date.now()
      };
    });
    
    return results;
  }
  
  /**
   * Set up a real-time listener for a document
   */
  static listenToDocument<T extends DocumentData>(
    collectionName: string,
    docId: string,
    callback: (data: T | null) => void
  ): () => void {
    const docRef = doc(db, collectionName, docId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...docSnap.data(), id: docSnap.id } as unknown as T;
        
        // Update cache
        this.memoryCache[this.createDocPath(collectionName, docId)] = {
          data,
          timestamp: Date.now()
        };
        
        callback(data);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`[DB] Error listening to ${collectionName}/${docId}:`, error);
      callback(null);
    });
    
    return unsubscribe;
  }
  
  /**
   * Set up a real-time listener for a query
   */
  static listenToQuery<T extends DocumentData>(
    collectionName: string,
    queryConstraints: QueryConstraint[] = [],
    callback: (data: T[]) => void
  ): () => void {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...queryConstraints);
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const results: T[] = [];
      
      querySnapshot.forEach((docSnapshot) => {
        const docData = docSnapshot.data();
        const data = { ...docData, id: docSnapshot.id } as unknown as T;
        results.push(data);
        
        // Cache individual documents
        this.memoryCache[this.createDocPath(collectionName, docSnapshot.id)] = {
          data,
          timestamp: Date.now()
        };
      });
      
      callback(results);
    }, (error) => {
      console.error(`[DB] Error listening to query on ${collectionName}:`, error);
      callback([]);
    });
    
    return unsubscribe;
  }
  
  /**
   * Clear the memory cache or a specific entry
   */
  static clearCache(collectionName?: string, docId?: string): void {
    if (collectionName && docId) {
      delete this.memoryCache[this.createDocPath(collectionName, docId)];
    } else {
      this.memoryCache = {};
    }
  }
} 