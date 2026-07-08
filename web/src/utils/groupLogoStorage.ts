import { getDownloadURL, ref as storageRef, type FirebaseStorage } from 'firebase/storage';
import { uploadImageWithStorageAuthRetry } from './storageUpload';

const GROUP_LOGO_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function getGroupLogoStoragePath(userId: string, groupId: string, file: File) {
  const extension = GROUP_LOGO_EXTENSION_BY_TYPE[file.type] || 'jpg';
  return `users/${userId}/group-logos/${groupId}/logo.${extension}`;
}

export async function uploadGroupLogo(
  storage: FirebaseStorage,
  userId: string,
  groupId: string,
  file: File,
) {
  const groupPhotoRef = storageRef(storage, getGroupLogoStoragePath(userId, groupId, file));
  await uploadImageWithStorageAuthRetry(groupPhotoRef, file);
  return getDownloadURL(groupPhotoRef);
}
