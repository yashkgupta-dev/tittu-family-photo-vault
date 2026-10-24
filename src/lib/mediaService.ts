import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
  deleteObject,
  StorageError
} from 'firebase/storage';
import { db, storage, auth, STORAGE_BUCKET_NAME } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { computeSHA256, extractMediaDimensions, sanitizeFileName } from './integrity';
import {
  isSupabaseConfigured,
  uploadToSupabase,
  deleteFromSupabase,
  verifySupabaseObject,
  getSupabaseConfig,
  downloadFromSupabase
} from './supabaseStorage';
import type { MediaItem, Album, AlbumItem, UserSettings } from '../types';

export interface StorageUploadErrorInfo {
  code: string;
  message: string;
  serverResponse?: string;
  isBucketNotFound?: boolean;
}

export function parseStorageError(error: unknown): StorageUploadErrorInfo {
  const err = error as (StorageError & { serverResponse?: string; code?: string; message?: string });
  const code = err?.code || 'storage/unknown';
  let message = err?.message || String(error);
  const serverResponse = err?.serverResponse || '';

  let isBucketNotFound = false;

  if (
    code === 'storage/bucket-not-found' ||
    message.includes('bucket does not exist') ||
    message.includes('404') ||
    serverResponse.includes('The specified bucket does not exist')
  ) {
    isBucketNotFound = true;
    message = `Google Cloud Storage bucket '${STORAGE_BUCKET_NAME}' does not exist (requires Firebase paid plan). Please connect free Supabase Storage in your environment.`;
  } else if (code === 'storage/unauthorized') {
    message = 'Storage permission denied. Ensure you are signed in and backend storage security rules allow this user.';
  } else if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') {
    message = 'Upload timed out. Check network connection or verify that storage is active.';
  }

  return {
    code,
    message,
    serverResponse,
    isBucketNotFound,
  };
}

/**
 * Upload a media file with real-time progress, SHA-256 calculation,
 * and post-upload cloud integrity verification.
 * Automatically prefers free-tier Supabase Storage when configured,
 * or falls back to Firebase Storage if provisioned.
 */
export async function uploadMediaWithVerification({
  file,
  userId,
  onProgress,
  onStatusUpdate,
}: {
  file: File;
  userId: string;
  onProgress: (progress: number, bytesTransferred: number, totalBytes: number) => void;
  onStatusUpdate: (
    status: 'checksumming' | 'uploading' | 'verifying' | 'completed' | 'failed',
    error?: string,
    errorCode?: string,
    isBucketNotFound?: boolean
  ) => void;
}): Promise<MediaItem> {
  // Guard 1: Verify authenticated user
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.uid) {
    const errorMsg = 'Authentication required: You must be signed in with your Google account to upload files.';
    onStatusUpdate('failed', errorMsg, 'auth/unauthenticated');
    throw new Error(`[auth/unauthenticated] ${errorMsg}`);
  }

  if (currentUser.uid !== userId) {
    const errorMsg = `Identity mismatch: Current user (${currentUser.uid}) does not match upload owner (${userId}).`;
    onStatusUpdate('failed', errorMsg, 'auth/user-mismatch');
    throw new Error(`[auth/user-mismatch] ${errorMsg}`);
  }

  // Guard 2: Verify file existence and validity
  if (!file || !(file instanceof Blob)) {
    const errorMsg = 'Invalid file: The selected item could not be read from your device.';
    onStatusUpdate('failed', errorMsg, 'storage/invalid-argument');
    throw new Error(`[storage/invalid-argument] ${errorMsg}`);
  }

  if (file.size <= 0) {
    const errorMsg = 'Invalid file: Selected file is empty (0 bytes). Please choose a valid photo or video.';
    onStatusUpdate('failed', errorMsg, 'storage/invalid-argument');
    throw new Error(`[storage/invalid-argument] ${errorMsg}`);
  }

  if (file.size > 5368709120) {
    const errorMsg = 'File too large: Maximum supported file size is 5 GB.';
    onStatusUpdate('failed', errorMsg, 'storage/invalid-argument');
    throw new Error(`[storage/invalid-argument] ${errorMsg}`);
  }

  const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const cleanName = sanitizeFileName(file.name);

  try {
    // Step 1: Compute SHA-256 for cryptographic verification
    onStatusUpdate('checksumming');
    const checksum = await computeSHA256(file);
    const dimensions = await extractMediaDimensions(file);

    let storagePath = '';
    let downloadUrl = '';

    // Step 2: Upload to Cloud Storage
    onStatusUpdate('uploading');

    if (isSupabaseConfigured()) {
      // PREFERRED FREE TIER: Supabase Storage
      const result = await uploadToSupabase({
        file,
        userId,
        mediaId,
        cleanName,
        onProgress,
      });
      storagePath = result.storagePath;
      downloadUrl = result.downloadUrl;

      // Step 3: Verify cloud storage object
      onStatusUpdate('verifying');
      const verifyRes = await verifySupabaseObject(storagePath, file.size);
      if (!verifyRes.verified && verifyRes.actualSize !== undefined && verifyRes.actualSize !== file.size) {
        throw new Error(`Integrity check failed: Cloud file size (${verifyRes.actualSize} bytes) does not match local file (${file.size} bytes).`);
      }
    } else {
      // FALLBACK: Firebase Cloud Storage
      storagePath = `users/${userId}/media/${mediaId}_${cleanName}`;
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          originalName: file.name,
          checksum: checksum,
          ownerId: userId,
        },
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      // Safety watchdog: Cancel if 0 bytes transferred after 25s
      let bytesEverTransferred = 0;
      const watchdogTimer = setTimeout(() => {
        if (bytesEverTransferred === 0) {
          uploadTask.cancel();
        }
      }, 25000);

      uploadTask.catch(() => {});

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            bytesEverTransferred = snapshot.bytesTransferred;
            const progress = snapshot.totalBytes > 0 
              ? Math.min(100, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
              : 0;
            onProgress(progress, snapshot.bytesTransferred, snapshot.totalBytes);
          },
          (error) => {
            clearTimeout(watchdogTimer);
            reject(error);
          },
          () => {
            clearTimeout(watchdogTimer);
            resolve();
          }
        );
      });

      // Step 3: Verify cloud storage object existence and size match
      onStatusUpdate('verifying');
      const cloudMeta = await getMetadata(storageRef);
      downloadUrl = await getDownloadURL(storageRef);

      const isSizeVerified = cloudMeta.size === file.size;
      if (!isSizeVerified) {
        throw new Error(`Integrity check failed: Cloud file size (${cloudMeta.size} bytes) does not match local file (${file.size} bytes).`);
      }
    }

    const nowIso = new Date().toISOString();
    const mediaType: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';

    const mediaItem: MediaItem = {
      id: mediaId,
      ownerId: userId,
      fileName: file.name,
      storagePath,
      downloadUrl,
      fileSize: file.size,
      contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      mediaType,
      checksum,
      verified: true,
      verifiedAt: nowIso,
      takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : nowIso,
      uploadedAt: nowIso,
      isFavorite: false,
      isTrash: false,
      ...(dimensions.width ? { width: dimensions.width } : {}),
      ...(dimensions.height ? { height: dimensions.height } : {}),
      ...(dimensions.duration ? { duration: dimensions.duration } : {}),
    };

    // Step 4: Persist metadata in Firestore
    const mediaDocRef = doc(db, 'users', userId, 'media', mediaId);
    try {
      await setDoc(mediaDocRef, mediaItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/media/${mediaId}`);
    }

    onStatusUpdate('completed');
    return mediaItem;
  } catch (error: unknown) {
    const parsed = parseStorageError(error);
    onStatusUpdate('failed', parsed.message, parsed.code, parsed.isBucketNotFound);
    throw error;
  }
}

/**
 * Re-verify existing cloud media item
 */
export async function reVerifyCloudMedia(userId: string, item: MediaItem): Promise<boolean> {
  try {
    if (item.storagePath.startsWith('supabase:') || item.downloadUrl.includes('supabase.co')) {
      const res = await verifySupabaseObject(item.storagePath, item.fileSize);
      if (res.verified && !item.verified) {
        const mediaDocRef = doc(db, 'users', userId, 'media', item.id);
        await updateDoc(mediaDocRef, {
          verified: true,
          verifiedAt: new Date().toISOString(),
        });
      }
      return res.verified;
    } else {
      const storageRef = ref(storage, item.storagePath);
      const cloudMeta = await getMetadata(storageRef);
      const verified = cloudMeta.size === item.fileSize;

      if (verified && !item.verified) {
        const mediaDocRef = doc(db, 'users', userId, 'media', item.id);
        await updateDoc(mediaDocRef, {
          verified: true,
          verifiedAt: new Date().toISOString(),
        });
      }
      return verified;
    }
  } catch (err) {
    console.error('Re-verification failed:', err);
    return false;
  }
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(userId: string, mediaId: string, currentStatus: boolean): Promise<void> {
  const mediaDocRef = doc(db, 'users', userId, 'media', mediaId);
  try {
    await updateDoc(mediaDocRef, {
      isFavorite: !currentStatus,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/media/${mediaId}`);
  }
}

/**
 * Move media item to trash (soft deletion)
 */
export async function moveToTrash(userId: string, mediaId: string): Promise<void> {
  const mediaDocRef = doc(db, 'users', userId, 'media', mediaId);
  try {
    await updateDoc(mediaDocRef, {
      isTrash: true,
      trashedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/media/${mediaId}`);
  }
}

/**
 * Restore media item from trash
 */
export async function restoreFromTrash(userId: string, mediaId: string): Promise<void> {
  const mediaDocRef = doc(db, 'users', userId, 'media', mediaId);
  try {
    await updateDoc(mediaDocRef, {
      isTrash: false,
      trashedAt: '',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/media/${mediaId}`);
  }
}

/**
 * Permanently delete media item (removes from Cloud Storage AND Firestore)
 */
export async function permanentlyDeleteMedia(userId: string, mediaId: string, storagePath: string): Promise<void> {
  // First delete from Cloud Storage
  try {
    if (storagePath.startsWith('supabase:')) {
      await deleteFromSupabase(storagePath);
    } else {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    }
  } catch (err) {
    console.warn('Storage delete warning:', err);
  }

  // Then delete Firestore metadata
  const mediaDocRef = doc(db, 'users', userId, 'media', mediaId);
  try {
    await deleteDoc(mediaDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/media/${mediaId}`);
  }

  // Clean up any album mappings
  try {
    const albumItemsRef = collection(db, 'users', userId, 'album_items');
    const q = query(albumItemsRef, where('mediaId', '==', mediaId));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Album items cleanup warning:', err);
  }
}

/**
 * Update media caption / note
 */
export async function updateMediaCaption(userId: string, mediaId: string, caption: string): Promise<void> {
  const mediaDocRef = doc(db, 'users', userId, 'media', mediaId);
  try {
    await updateDoc(mediaDocRef, {
      caption: caption.slice(0, 500),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/media/${mediaId}`);
  }
}

/**
 * Albums Management
 */
export async function createAlbum(userId: string, title: string, description?: string): Promise<Album> {
  const albumId = 'album_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  const album: Album = {
    id: albumId,
    ownerId: userId,
    title: title.trim(),
    createdAt: now,
    ...(description ? { description: description.trim() } : {}),
    mediaCount: 0,
  };

  const albumDocRef = doc(db, 'users', userId, 'albums', albumId);
  try {
    await setDoc(albumDocRef, album);
    return album;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/albums/${albumId}`);
  }
}

export async function deleteAlbum(userId: string, albumId: string): Promise<void> {
  const albumDocRef = doc(db, 'users', userId, 'albums', albumId);
  try {
    await deleteDoc(albumDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/albums/${albumId}`);
  }

  try {
    const albumItemsRef = collection(db, 'users', userId, 'album_items');
    const q = query(albumItemsRef, where('albumId', '==', albumId));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Album items cleanup warning:', err);
  }
}

export async function addMediaToAlbum(userId: string, albumId: string, mediaId: string, mediaCoverUrl?: string): Promise<void> {
  const itemId = `${albumId}_${mediaId}`;
  const albumItem: AlbumItem = {
    id: itemId,
    albumId,
    mediaId,
    ownerId: userId,
    addedAt: new Date().toISOString(),
  };

  const itemRef = doc(db, 'users', userId, 'album_items', itemId);
  try {
    await setDoc(itemRef, albumItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/album_items/${itemId}`);
  }

  try {
    const albumRef = doc(db, 'users', userId, 'albums', albumId);
    const snap = await getDoc(albumRef);
    if (snap.exists()) {
      const data = snap.data();
      const newCount = (data.mediaCount || 0) + 1;
      await updateDoc(albumRef, {
        mediaCount: newCount,
        ...(mediaCoverUrl ? { coverPhotoUrl: mediaCoverUrl } : {}),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Update album count warning:', err);
  }
}

export async function removeMediaFromAlbum(userId: string, albumId: string, mediaId: string): Promise<void> {
  const itemId = `${albumId}_${mediaId}`;
  const itemRef = doc(db, 'users', userId, 'album_items', itemId);
  try {
    await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/album_items/${itemId}`);
  }

  try {
    const albumRef = doc(db, 'users', userId, 'albums', albumId);
    const snap = await getDoc(albumRef);
    if (snap.exists()) {
      const data = snap.data();
      const newCount = Math.max(0, (data.mediaCount || 1) - 1);
      await updateDoc(albumRef, {
        mediaCount: newCount,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Update album count warning:', err);
  }
}

/**
 * User Settings & Safety Checklists
 */
export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
  const settingRef = doc(db, 'users', userId, 'settings', 'config');
  const now = new Date().toISOString();
  try {
    await setDoc(settingRef, {
      userId,
      ...settings,
      updatedAt: now,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/settings/config`);
  }
}

/**
 * Download original media file directly to device.
 * For Supabase Storage, uses authenticated API so downloads succeed even from private buckets.
 * Validates that the downloaded payload is not an error JSON blob.
 */
export async function downloadOriginalFile(
  downloadUrl: string,
  fileName: string,
  storagePath?: string
): Promise<void> {
  const isSupabase =
    (storagePath && storagePath.startsWith('supabase:')) ||
    downloadUrl.includes('supabase.co') ||
    isSupabaseConfigured();

  try {
    if (isSupabase) {
      // 1. Authenticated Supabase download (works for both private and public buckets)
      const { blob, fileName: resolvedFileName } = await downloadFromSupabase(
        storagePath || downloadUrl,
        downloadUrl
      );
      const downloadName = fileName || resolvedFileName || 'family_photo.jpg';
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
      return;
    }

    // 2. Fallback for Firebase Storage
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed with status HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    // Guard against saving HTML or JSON 404 pages as image files
    if (blob.type.includes('json') || blob.type.includes('html')) {
      const text = await blob.text();
      if (text.includes('NoSuchBucket') || text.includes('Bucket not found') || text.includes('404')) {
        throw new Error('Cloud storage bucket or object not found.');
      }
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || 'family_photo.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TITTU Download] Failed to download "${fileName}":`, errorMsg);
    throw new Error(errorMsg);
  }
}

