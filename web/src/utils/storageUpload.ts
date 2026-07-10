import { getToken } from 'firebase/app-check';
import type { User as FirebaseUser } from 'firebase/auth';
import { type StorageReference, uploadBytes } from 'firebase/storage';
import { appCheck } from '../services/firebase';
import { createLogger } from './logger';

const logger = createLogger('storageUpload');

const STORAGE_UPLOAD_RETRY_DELAYS_MS = [0, 750, 2000, 4000];

const wait = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

export function getStorageUploadErrorCode(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code)
    : '';
}

function isRetryableStorageUploadError(err: unknown) {
  const code = getStorageUploadErrorCode(err);
  return code === 'storage/unauthorized' ||
    code === 'storage/unknown' ||
    code === 'storage/retry-limit-exceeded' ||
    code === 'storage/network-request-failed';
}

interface StorageUploadRetryOptions {
  refreshCredentials?: () => Promise<void>;
}

export async function refreshFirebaseUploadCredentials(user: FirebaseUser) {
  await user.getIdToken(true);
  if (appCheck) await getToken(appCheck, true);
}

export async function uploadImageWithStorageAuthRetry(
  storageReference: StorageReference,
  file: File,
  options: StorageUploadRetryOptions = {},
) {
  let lastErr: unknown;

  for (let attempt = 0; attempt < STORAGE_UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = STORAGE_UPLOAD_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) await wait(delayMs);

    try {
      return await uploadBytes(storageReference, file, { contentType: file.type });
    } catch (err) {
      lastErr = err;
      if (!isRetryableStorageUploadError(err) || attempt === STORAGE_UPLOAD_RETRY_DELAYS_MS.length - 1) {
        throw err;
      }
      if (getStorageUploadErrorCode(err) === 'storage/unauthorized' ||
          getStorageUploadErrorCode(err) === 'storage/unknown') {
        try {
          await options.refreshCredentials?.();
        } catch (refreshErr) {
          // A nova tentativa ainda pode funcionar com o refresh automático do SDK.
          logger.warn('Failed to refresh credentials before retrying image upload', refreshErr);
        }
      }
      logger.warn('Retrying image upload after Storage auth propagation delay', {
        attempt: attempt + 1,
        err,
      });
    }
  }

  throw lastErr;
}
