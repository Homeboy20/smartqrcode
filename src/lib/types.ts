export type SubscriptionTier = 'free' | 'pro' | 'business';

export interface UserData {
  id: string;
  email: string;
  displayName: string | null;
  photoURL?: string;
  createdAt?: any; // Using any for now to handle Firebase Timestamp
  updatedAt?: any; // Using any for now to handle Firebase Timestamp
  subscriptionTier: SubscriptionTier;
  role?: 'admin' | 'user';
  featuresUsage: {
    qrCodesGenerated: number;
    barcodesGenerated: number;
    bulkGenerations: number;
    aiCustomizations: number;
  };
}

export interface SubscriptionFeatures {
  qrGenerationLimit: number;
  barcodeGenerationLimit: number;
  bulkGenerationLimit: number;
  aiCustomizationLimit: number;
}

// Defines the shape of subscription hook return value
export interface UseSubscriptionReturn {
  loading: boolean;
  error: string | null;
  subscriptionTier: SubscriptionTier;
  featuresUsage: UserData['featuresUsage'];
  limits: any;
  getLimit: (featureKey: string) => number;
  canUseFeature: (feature: string) => boolean;
  remainingUsage: (feature: string) => number;
  hasReachedLimit: (feature: string) => boolean;
  isWithinUsageLimit: (feature: string, amount?: number) => boolean;
}

// Dynamic QR code tracking types
export interface QRCodeData {
  id: string;
  userId: string;
  name: string;
  content: string;
  type: 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi' | 'file';
  createdAt: any;
  expiresAt?: any;
  trackingEnabled: boolean;
  scans: number;
  lastScan?: any;
  scanLocations?: ScanLocation[];
  isPublic: boolean;
  customData?: Record<string, any>;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
}

export interface ScanLocation {
  timestamp: any;
  ip?: string;
  country?: string;
  city?: string;
  browser?: string;
  os?: string;
  device?: string;
  referrer?: string;
}

// Enhanced Barcode types
export interface BarcodeData {
  id: string;
  userId: string;
  name: string;
  content: string;
  type: string; // barcode format (e.g., CODE128, EAN13)
  createdAt: any;
  enhancedData?: {
    title?: string;
    description?: string;
    productInfo?: {
      name?: string;
      sku?: string;
      price?: number;
      currency?: string;
      category?: string;
      manufacturer?: string;
      dimensions?: string;
      weight?: string;
    };
    customFields?: Record<string, string>;
  };
  isPublic: boolean;
}

// Analytics data type
export interface AnalyticsData {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: any;
  endDate: any;
  metrics: {
    totalScans: number;
    uniqueVisitors: number;
    topLocations: {
      country: string;
      count: number;
    }[];
    deviceBreakdown: {
      mobile: number;
      desktop: number;
      tablet: number;
      other: number;
    };
    scansByDay: {
      date: string;
      count: number;
    }[];
    topReferrers: {
      referrer: string;
      count: number;
    }[];
  };
}

// File Upload type
export interface UploadedFile {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadDate: any;
  downloadUrl: string;
  accessCount: number;
  qrCodeId?: string;
  isPublic: boolean;
  expiresAt?: any;
}

// Payment provider credential types
export interface PaymentCredentials {
  provider: 'stripe' | 'paypal' | 'flutterwave';
  isActive: boolean;
  encryptedData: string; // This will store the encrypted credentials JSON
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeCredentials {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  pricePro: string;
  priceBusiness: string;
}

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  planIdPro: string;
  planIdBusiness: string;
}

export interface FlutterwaveCredentials {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  webhookSecretHash?: string;
  /** Optional ISO-3166-1 alpha-2 allow-list (comma-separated), e.g. "NG,GH,ZA" */
  allowedCountries?: string;
}

export interface PaystackCredentials {
  publicKey: string;
  secretKey: string;
  planCodePro: string;
  planCodeBusiness: string;
  /** Optional yearly/annual Paystack plan codes (for annual subscriptions). */
  planCodeProYearly?: string;
  planCodeBusinessYearly?: string;
  /** Optional Paystack plan codes for Kenyan Shilling (KES), if you use Paystack in Kenya. */
  planCodeProKes?: string;
  planCodeBusinessKes?: string;
  /** Optional yearly/annual Paystack plan codes for Kenyan Shilling (KES). */
  planCodeProYearlyKes?: string;
  planCodeBusinessYearlyKes?: string;
  /** Optional ISO-3166-1 alpha-2 allow-list (comma-separated), e.g. "NG,GH,ZA" */
  allowedCountries?: string;
} 

// Restaurant digital menu MVP
export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  whatsappNumber: string;
  acceptedPayments: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  category: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
  available: boolean;
  createdAt?: any;
  updatedAt?: any;
}