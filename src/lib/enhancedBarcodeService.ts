import type { BarcodeData } from '@/lib/types';

function disabled(): never {
  throw new Error('enhancedBarcodeService is disabled (legacy Firebase implementation retired).');
}

export async function createEnhancedBarcode(
  _: Omit<BarcodeData, 'id' | 'createdAt'>
): Promise<string> {
  disabled();
}

export async function getEnhancedBarcode(_: string): Promise<BarcodeData | null> {
  disabled();
}

export async function getUserBarcodes(_: string): Promise<BarcodeData[]> {
  disabled();
}

export async function updateEnhancedBarcode(_: string, __: Partial<BarcodeData>): Promise<void> {
  disabled();
}

export async function deleteEnhancedBarcode(_: string): Promise<void> {
  disabled();
}

export async function getBarcodeByContent(_: string): Promise<BarcodeData | null> {
  disabled();
}

export function getProductPageUrl(barcodeId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/barcode/${barcodeId}`;
}
