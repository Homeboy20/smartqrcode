export type Timestamp = unknown;

function disabled(): never {
  throw new Error('firestore.ts is disabled (legacy Firebase implementation retired).');
}

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

export interface CodeData {
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
    [key: string]: unknown;
  };
}

export interface PaymentGatewayConfig {
  stripe: { publicKey: string; secretKey: string; enabled: boolean };
  paystack: { publicKey: string; secretKey: string; enabled: boolean };
  flutterwave: { publicKey: string; secretKey: string; enabled: boolean };
  paypal: { clientId: string; clientSecret: string; enabled: boolean };
}

export const defaultGatewayConfig: PaymentGatewayConfig = {
  stripe: { publicKey: '', secretKey: '', enabled: false },
  paystack: { publicKey: '', secretKey: '', enabled: false },
  flutterwave: { publicKey: '', secretKey: '', enabled: false },
  paypal: { clientId: '', clientSecret: '', enabled: false },
};

export const checkEmailOrPhoneExists = async (
  _email?: string,
  _phoneNumber?: string
): Promise<{ exists: boolean; field: string | null }> => {
  void _email;
  void _phoneNumber;
  disabled();
};

export const saveUserData = async (_user: unknown): Promise<void> => {
  void _user;
  disabled();
};

export async function getUserData(_userId: string): Promise<UserData | null> {
  void _userId;
  disabled();
}

export const getUserById = getUserData;

export const getAllUsers = async (): Promise<UserData[]> => {
  disabled();
};

export async function saveCode(
  _userId: string,
  _codeData: Omit<CodeData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  void _userId;
  void _codeData;
  disabled();
}

export async function getUserCodes(_userId: string): Promise<CodeData[]> {
  void _userId;
  disabled();
}

export async function getCodeById(_codeId: string): Promise<CodeData | null> {
  void _codeId;
  disabled();
}

export async function updateCode(_codeId: string, _codeData: Partial<CodeData>): Promise<void> {
  void _codeId;
  void _codeData;
  disabled();
}

export async function deleteCode(_codeId: string): Promise<void> {
  void _codeId;
  disabled();
}

export async function incrementCodeScan(_codeId: string): Promise<void> {
  void _codeId;
  disabled();
}

export const updateUserData = async (
  _userId: string,
  _dataToUpdate: Partial<UserData>
): Promise<void> => {
  void _userId;
  void _dataToUpdate;
  disabled();
};

export const saveGatewayConfig = async (_config: PaymentGatewayConfig): Promise<boolean> => {
  void _config;
  disabled();
};

export const getGatewayConfig = async (): Promise<PaymentGatewayConfig> => {
  disabled();
};