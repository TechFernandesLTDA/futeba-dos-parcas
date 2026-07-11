import type { User as FirebaseUser } from 'firebase/auth';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { storage } from '../services/firebaseStorage';
import {
  getStorageUploadErrorCode,
  refreshFirebaseUploadCredentials,
  uploadImageWithStorageAuthRetry,
} from './storageUpload';
import { isSupportedStorageImage } from './storageImage';

// A regra usa comparação estrita (< 2 MB), portanto 2 MB exatos também devem
// ser recusados no cliente para não terminar como um falso erro de conexão.
export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type ProfileAvatarValidationError = 'invalid-type' | 'too-large';

export function validateProfileAvatar(file: File): ProfileAvatarValidationError | null {
  if (!isSupportedStorageImage(file)) return 'invalid-type';
  if (file.size >= PROFILE_AVATAR_MAX_BYTES) return 'too-large';
  return null;
}

export async function uploadProfileAvatar(file: File, user: FirebaseUser): Promise<string> {
  const fileRef = storageRef(storage, `users/${user.uid}/profile.jpg`);
  await uploadImageWithStorageAuthRetry(fileRef, file, {
    refreshCredentials: () => refreshFirebaseUploadCredentials(user),
  });
  const downloadUrl = await getDownloadURL(fileRef);
  const url = new URL(downloadUrl);
  url.searchParams.set('v', String(Date.now()));
  return url.toString();
}

export function getProfileAvatarUploadErrorKey(err: unknown): string {
  switch (getStorageUploadErrorCode(err)) {
    case 'storage/unauthorized':
    case 'storage/unauthenticated':
      return 'profile.avatarUploadUnauthorized';
    case 'storage/canceled':
      return 'profile.avatarUploadCanceled';
    case 'storage/retry-limit-exceeded':
    case 'storage/network-request-failed':
      return 'profile.avatarUploadNetworkError';
    default:
      return 'profile.avatarUploadError';
  }
}
