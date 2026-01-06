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
  limit
} from 'firebase/firestore';
import { db, isFirebaseAvailable } from './firebase/config';
import { User } from 'firebase/auth';

// User-related database operations
export interface UserData {
  id: string;
  email: string;
  displayName: string | null;
  phoneNumber?: string;
  subscriptionTier: string;
  role: 'admin' | 'user';
  subscriptionEnd?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  authProvider?: 'email' | 'google' | 'phone';
  emailVerified?: boolean;
  phoneVerified?: boolean;
  featuresUsage: {
    qrCodesGenerated: number;
    barcodesGenerated: number;
    bulkGenerations: number;
    aiCustomizations: number;
  };
}

// Check if email or phone number is already in use
export const checkEmailOrPhoneExists = async (email?: string, phoneNumber?: string): Promise<{ exists: boolean, field: string | null }> => {
  try {
    if (!email && !phoneNumber) {
      return { exists: false, field: null };
    }

    const usersCollection = collection(db, "users");
    
    if (email) {
      const emailQuery = query(
        usersCollection,
        where('email', '==', email),
        limit(1)
      );
      
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        return { exists: true, field: 'email' };
      }
    }
    
    if (phoneNumber) {
      const phoneQuery = query(
        usersCollection,
        where('phoneNumber', '==', phoneNumber),
        limit(1)
      );
      
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        return { exists: true, field: 'phoneNumber' };
      }
    }
    
    return { exists: false, field: null };
  } catch (error) {
    console.error("Error checking email or phone existence:", error);
    // Don't assume it exists on error, but log it
    return { exists: false, field: null };
  }
};

// Save or update user data in Firestore
export const saveUserData = async (user: User | UserData) => {
  try {
    // If we're passed a Firebase User object
    if ('uid' in user) {
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        phoneNumber: user.phoneNumber || '',
        emailVerified: user.emailVerified || false,
        phoneVerified: user.phoneNumber ? true : false, // Phone numbers from Firebase Auth are already verified
        subscriptionTier: 'free',
        role: 'user',
        featuresUsage: {
          qrCodesGenerated: 0,
          barcodesGenerated: 0,
          bulkGenerations: 0,
          aiCustomizations: 0
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }, { merge: true });
    } else {
      // If we're passed a UserData object directly
      const { id, ...userData } = user;
      await setDoc(doc(db, 'users', id), {
        id,
        ...userData,
        updatedAt: Timestamp.now()
      }, { merge: true });
    }
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
};

// Get user data from Firestore
export async function getUserData(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user data:", error);
    throw error;
  }
}

// Alias getUserData as getUserById for backward compatibility
export const getUserById = getUserData;

// Get all users (requires appropriate Firestore rules for admin access)
export const getAllUsers = async (): Promise<UserData[]> => {
  const usersCollection = collection(db, "users");
  const usersQuery = query(usersCollection);
  const querySnapshot = await getDocs(usersQuery);
  
  const users: UserData[] = [];
  querySnapshot.forEach((doc) => {
    users.push(doc.data() as UserData);
  });
  
  return users;
};

// QR Code and Barcode related database operations
interface CodeData {
  id: string;
  userId: string;
  name: string;
  content: string;
  type: 'qrcode' | 'barcode';
  format?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stats: {
    scans: number;
    lastScan?: Timestamp;
  };
  settings?: {
    foregroundColor?: string;
    backgroundColor?: string | string[];
    [key: string]: any;
  };
}

// Save a new code (QR code or barcode)
export async function saveCode(userId: string, codeData: Omit<CodeData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  try {
    const codesRef = collection(db, 'codes');
    const newCodeRef = doc(codesRef);
    
    await setDoc(newCodeRef, {
      id: newCodeRef.id,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...codeData
    });
    
    return newCodeRef.id;
  } catch (error) {
    console.error("Error saving code:", error);
    throw error;
  }
}

// Get codes for a specific user
export async function getUserCodes(userId: string) {
  try {
    const codesRef = collection(db, 'codes');
    const q = query(
      codesRef, 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const codes: CodeData[] = [];
    
    querySnapshot.forEach((doc) => {
      codes.push(doc.data() as CodeData);
    });
    
    return codes;
  } catch (error) {
    console.error("Error getting user codes:", error);
    throw error;
  }
}

// Get a specific code by ID
export async function getCodeById(codeId: string) {
  try {
    const codeRef = doc(db, 'codes', codeId);
    const codeSnap = await getDoc(codeRef);
    
    if (codeSnap.exists()) {
      return codeSnap.data() as CodeData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting code:", error);
    throw error;
  }
}

// Update an existing code
export async function updateCode(codeId: string, codeData: Partial<CodeData>) {
  try {
    const codeRef = doc(db, 'codes', codeId);
    
    await updateDoc(codeRef, {
      ...codeData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating code:", error);
    throw error;
  }
}

// Delete a code
export async function deleteCode(codeId: string) {
  try {
    const codeRef = doc(db, 'codes', codeId);
    await deleteDoc(codeRef);
  } catch (error) {
    console.error("Error deleting code:", error);
    throw error;
  }
}

// Track code usage
export async function incrementCodeScan(codeId: string) {
  try {
    const codeRef = doc(db, 'codes', codeId);
    const codeSnap = await getDoc(codeRef);
    
    if (codeSnap.exists()) {
      const codeData = codeSnap.data() as CodeData;
      const currentScans = codeData.stats?.scans || 0;
      
      await updateDoc(codeRef, {
        'stats.scans': currentScans + 1,
        'stats.lastScan': serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error incrementing code scan:", error);
    throw error;
  }
}

// Update specific fields for a user
export const updateUserData = async (userId: string, dataToUpdate: Partial<UserData>) => {
  const userRef = doc(db, "users", userId);
  // Add updatedAt timestamp automatically
  const updateData = { ...dataToUpdate, updatedAt: Timestamp.now() }; 
  await updateDoc(userRef, updateData);
};

// Payment Gateway Configuration
export interface PaymentGatewayConfig {
  stripe: {
    enabled: boolean;
    testMode: boolean;
  };
  paypal: {
    enabled: boolean;
    testMode: boolean;
  };
  flutterwave: {
    enabled: boolean;
    testMode: boolean;
  };
  paystack: {
    enabled: boolean;
    testMode: boolean;
  };
}

// Default gateway configuration
export const defaultGatewayConfig: PaymentGatewayConfig = {
  stripe: {
    enabled: false,
    testMode: true
  },
  paypal: {
    enabled: false,
    testMode: true
  },
  flutterwave: {
    enabled: false,
    testMode: true
  },
  paystack: {
    enabled: false,
    testMode: true
  }
};

// Save payment gateway configuration
export const saveGatewayConfig = async (config: PaymentGatewayConfig): Promise<boolean> => {
  if (!isFirebaseAvailable()) {
    console.warn('Firebase not available - gateway config not saved');
    return false;
  }
  
  try {
    await setDoc(doc(db, 'app_settings', 'payment_gateways'), {
      ...config,
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error('Error saving gateway config:', error);
    return false;
  }
};

// Get payment gateway configuration
export const getGatewayConfig = async (): Promise<PaymentGatewayConfig> => {
  if (!isFirebaseAvailable()) {
    console.warn('Firebase not available - using default gateway config');
    return defaultGatewayConfig;
  }
  
  try {
    const configDoc = await getDoc(doc(db, 'app_settings', 'payment_gateways'));
    
    if (configDoc.exists()) {
      return configDoc.data() as PaymentGatewayConfig;
    }
    
    // If no config exists, create one with defaults
    await saveGatewayConfig(defaultGatewayConfig);
    return defaultGatewayConfig;
  } catch (error) {
    console.error('Error getting gateway config:', error);
    return defaultGatewayConfig;
  }
}; 