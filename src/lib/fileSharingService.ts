import type { UploadedFile } from '@/lib/types';

export type ShareAccessType = 'view' | 'download';

export interface SharePermission {
  id: string;
  fileId: string;
  createdBy: string;
  sharedWith: string;
  createdAt: unknown;
  expiresAt?: unknown;
  accessType: ShareAccessType;
  accessCount: number;
  lastAccessed?: unknown;
  password?: string;
}

function disabled(): never {
  throw new Error('File sharing is currently disabled (Firebase legacy removed).');
}

export async function shareFileWithUsers(
  _fileId: string,
  _userId: string,
  _emails: string[],
  _accessType: ShareAccessType = 'view',
  _expiresAt?: Date,
  _password?: string
): Promise<string[]> {
  disabled();
}

export async function makeFilePublic(
  _fileId: string,
  _userId: string,
  _accessType: ShareAccessType = 'view',
  _expiresAt?: Date,
  _password?: string
): Promise<string> {
  disabled();
}

export async function revokeSharing(_shareId: string, _userId: string): Promise<void> {
  disabled();
}

export async function getFilesSharedWithUser(
  _email: string
): Promise<Array<{ shareInfo: SharePermission; file: UploadedFile }>> {
  disabled();
}

export async function getUserSharedFiles(
  _userId: string
): Promise<Array<{ shareInfo: SharePermission; file: UploadedFile }>> {
  disabled();
}

export async function recordShareAccess(_shareId: string): Promise<void> {
  // no-op while disabled
}

export async function verifySharePassword(_shareId: string, _password: string): Promise<boolean> {
  return false;
}

export function isShareExpired(_shareInfo: SharePermission): boolean {
  return true;
}
