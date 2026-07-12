import { getToken } from 'firebase/app-check';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  type StorageReference,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage';
import { appCheck } from '../services/firebase';
import { createLogger } from './logger';

const logger = createLogger('storageUpload');

const STORAGE_UPLOAD_RETRY_DELAYS_MS = [0, 750, 2000, 4000];
const RESUMABLE_UPLOAD_STALL_TIMEOUT_MS = 20_000;
const CREDENTIAL_REFRESH_TIMEOUT_MS = 15_000;
const RESUMABLE_UPLOAD_STALLED_CODE = 'storage/resumable-upload-stalled';
const CREDENTIAL_REFRESH_TIMEOUT_CODE = 'storage/credential-refresh-timeout';

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
    code === 'storage/network-request-failed' ||
    code === RESUMABLE_UPLOAD_STALLED_CODE;
}

export interface StorageUploadOptions {
  refreshCredentials?: () => Promise<void>;
  onProgress?: (percentage: number) => void;
  onRetrying?: () => void;
  contentType?: string;
}

async function refreshCredentialsWithTimeout(refreshCredentials?: () => Promise<void>) {
  if (!refreshCredentials) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Object.assign(
        new Error('Tempo esgotado ao renovar as credenciais do upload.'),
        { code: CREDENTIAL_REFRESH_TIMEOUT_CODE },
      )),
      CREDENTIAL_REFRESH_TIMEOUT_MS,
    );
    Promise.resolve().then(refreshCredentials).then(
      () => {
        clearTimeout(timeout);
        resolve();
      },
      (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    );
  });
}

export async function refreshFirebaseUploadCredentials(user: FirebaseUser) {
  await refreshCredentialsWithTimeout(async () => {
    await Promise.all([
      user.getIdToken(true),
      appCheck ? getToken(appCheck, true) : Promise.resolve(null),
    ]);
  });
}

export async function uploadImageWithStorageAuthRetry(
  storageReference: StorageReference,
  file: File,
  options: StorageUploadOptions = {},
) {
  let lastErr: unknown;
  let highestProgress = -1;

  const reportProgress = (percentage: number) => {
    if (!options.onProgress) return;
    const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
    if (normalized <= highestProgress) return;
    highestProgress = normalized;
    options.onProgress(normalized);
  };

  const uploadWithProgress = () => new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageReference, file, {
      contentType: options.contentType ?? file.type,
    });
    let settled = false;
    let lastTransferred = 0;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | undefined;

    const clearStallTimer = () => {
      if (stallTimer !== null) clearTimeout(stallTimer);
      stallTimer = null;
    };
    const cleanup = () => {
      clearStallTimer();
      unsubscribe?.();
      unsubscribe = undefined;
    };
    const rejectOnce = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reportProgress(100);
      resolve(uploadTask.snapshot);
    };
    const uploadSucceeded = () => uploadTask.snapshot.state === 'success';
    const armStallTimer = () => {
      clearStallTimer();
      stallTimer = setTimeout(() => {
        if (settled) return;
        if (uploadSucceeded()) {
          resolveOnce();
          return;
        }
        clearStallTimer();
        unsubscribe?.();
        unsubscribe = undefined;
        // Cancela a sessão resumível antes do fallback para evitar duas
        // finalizações concorrentes no mesmo path imutável do staging.
        let canceled = false;
        try {
          canceled = uploadTask.cancel();
        } catch (cancelError) {
          logger.warn('Failed to cancel stalled resumable upload', cancelError);
        }
        if (!canceled && uploadSucceeded()) {
          resolveOnce();
          return;
        }
        rejectOnce(Object.assign(
          new Error('O upload resumível ficou sem progresso.'),
          { code: RESUMABLE_UPLOAD_STALLED_CODE },
        ));
      }, RESUMABLE_UPLOAD_STALL_TIMEOUT_MS);
    };

    armStallTimer();
    unsubscribe = uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percentage = snapshot.totalBytes > 0
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0;
        reportProgress(percentage);
        if (snapshot.bytesTransferred !== lastTransferred) {
          lastTransferred = snapshot.bytesTransferred;
          armStallTimer();
        }
      },
      rejectOnce,
      resolveOnce,
    );
    // Alguns mocks e implementações podem concluir sincronicamente durante
    // o registro do observer. Nesse caso, remove o listener recém-retornado.
    if (settled) cleanup();
  });

  if (options.onProgress) reportProgress(0);

  for (let attempt = 0; attempt < STORAGE_UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = STORAGE_UPLOAD_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) await wait(delayMs);

    try {
      if (options.onProgress && attempt === 0) return await uploadWithProgress();
      const snapshot = await uploadBytes(storageReference, file, {
        contentType: options.contentType ?? file.type,
      });
      reportProgress(100);
      return snapshot;
    } catch (err) {
      lastErr = err;
      if (!isRetryableStorageUploadError(err) || attempt === STORAGE_UPLOAD_RETRY_DELAYS_MS.length - 1) {
        throw err;
      }
      const errorCode = getStorageUploadErrorCode(err);
      if (errorCode === RESUMABLE_UPLOAD_STALLED_CODE) {
        options.onRetrying?.();
        try {
          // Preflight limitado: impede que o fallback simples fique preso na
          // mesma aquisição de Auth/App Check que travou o resumable.
          await refreshCredentialsWithTimeout(options.refreshCredentials);
        } catch (refreshErr) {
          logger.warn('Credential refresh timed out before compatible upload fallback', refreshErr);
          throw refreshErr;
        }
      } else if (errorCode === 'storage/unauthorized' || errorCode === 'storage/unknown') {
        try {
          await refreshCredentialsWithTimeout(options.refreshCredentials);
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
