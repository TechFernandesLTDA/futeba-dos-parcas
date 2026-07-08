import { type StorageReference, uploadBytes } from 'firebase/storage';
import { createLogger } from './logger';

const logger = createLogger('storageUpload');

const STORAGE_UPLOAD_RETRY_DELAYS_MS = [0, 750, 2000, 4000];

const wait = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

function isRetryableStorageUploadError(err: unknown) {
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code)
    : '';
  return code === 'storage/unauthorized' || code === 'storage/unknown';
}

export async function uploadImageWithStorageAuthRetry(
  storageReference: StorageReference,
  file: File,
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
      logger.warn('Retrying image upload after Storage auth propagation delay', {
        attempt: attempt + 1,
        err,
      });
    }
  }

  throw lastErr;
}
