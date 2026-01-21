import type { UploadedFile } from '@/lib/types';

export async function uploadFile(
  _userId: string,
  _file: File,
  _isPublic: boolean = false,
  _expiresAt?: Date
): Promise<UploadedFile> {
  throw new Error('Legacy file uploads are disabled (Firebase implementation removed).');
}

export async function getUserFiles(_userId: string): Promise<UploadedFile[]> {
  throw new Error('Legacy file uploads are disabled (Firebase implementation removed).');
}

export async function getFile(_fileId: string): Promise<UploadedFile | null> {
  throw new Error('Legacy file uploads are disabled (Firebase implementation removed).');
}

export async function recordFileAccess(_fileId: string): Promise<void> {
  // no-op while disabled
}

export async function deleteFile(_fileId: string): Promise<void> {
  throw new Error('Legacy file uploads are disabled (Firebase implementation removed).');
}
