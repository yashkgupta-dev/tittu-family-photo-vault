/**
 * TITTU Family Photo Vault - Type Definitions
 */

export interface MediaItem {
  id: string;
  ownerId: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  fileSize: number;
  contentType: string;
  mediaType: 'photo' | 'video';
  checksum: string;
  verified: boolean;
  verifiedAt?: string;
  takenAt?: string;
  uploadedAt: string;
  isFavorite: boolean;
  isTrash: boolean;
  trashedAt?: string;
  caption?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Album {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  coverPhotoUrl?: string;
  mediaCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AlbumItem {
  id: string;
  albumId: string;
  mediaId: string;
  ownerId: string;
  addedAt: string;
}

export interface UserSettings {
  userId: string;
  safetyWarningSeen?: boolean;
  secondaryBackupAcknowledged?: boolean;
  updatedAt?: string;
}

export type UploadStatus = 
  | 'queued' 
  | 'checksumming' 
  | 'uploading' 
  | 'verifying' 
  | 'completed' 
  | 'failed';

export interface UploadTask {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  mediaType: 'photo' | 'video';
  previewUrl: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  status: UploadStatus;
  errorCode?: string;
  errorMessage?: string;
  isBucketNotFound?: boolean;
  checksum?: string;
  downloadUrl?: string;
  storagePath?: string;
}

export type FilterView = 'all' | 'photos' | 'videos' | 'verified' | 'favorites' | 'albums' | 'trash';
