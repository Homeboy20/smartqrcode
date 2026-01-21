import type { QRCodeData, ScanLocation } from '@/lib/types';

function disabled(): never {
  throw new Error('dynamicQrService is disabled (legacy Firebase implementation retired).');
}

export async function createDynamicQRCode(
  _: Omit<QRCodeData, 'id' | 'scans' | 'createdAt'>
): Promise<string> {
  void _;
  disabled();
}

export async function getDynamicQRCode(_: string): Promise<QRCodeData | null> {
  void _;
  disabled();
}

export async function getUserQRCodes(_: string): Promise<QRCodeData[]> {
  void _;
  disabled();
}

export async function updateDynamicQRCode(_: string, __: Partial<QRCodeData>): Promise<void> {
  void _;
  void __;
  disabled();
}

export async function deleteDynamicQRCode(_: string): Promise<void> {
  void _;
  disabled();
}

export async function recordQRCodeScan(_: string, __: Partial<ScanLocation>): Promise<void> {
  void _;
  void __;
  disabled();
}

export async function uploadFileForQRCode(
  _: string,
  __: string,
  ___: File
): Promise<{ downloadUrl: string; fileType: string; fileName: string }> {
  void _;
  void __;
  void ___;
  disabled();
}

export async function getQRCodeStats(_: string): Promise<{
  totalCodes: number;
  totalScans: number;
  averageScansPerCode: number;
  mostScannedCode: Partial<QRCodeData> | null;
}> {
  void _;
  disabled();
}
