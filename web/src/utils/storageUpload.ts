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
// Firebase Storage already has a 30 s retry/status budget configured. The
// watchdog must run after that budget, otherwise it cancels valid SDK recovery.
const RESUMABLE_UPLOAD_STALL_TIMEOUT_MS = 35_000;
const CREDENTIAL_REFRESH_TIMEOUT_MS = 15_000;
const RESUMABLE_UPLOAD_STALLED_CODE = 'storage/resumable-upload-stalled';
const CREDENTIAL_REFRESH_TIMEOUT_CODE = 'storage/credential-refresh-timeout';

const wait = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

export function getStorageUploadErrorCode(err: unknown) {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code)
    : '';
}

function isRetryableStorageUploadError(err: unknown, retryUnauthorized: boolean) {
  const code = getStorageUploadErrorCode(err);
  return (retryUnauthorized && code === 'storage/unauthorized') ||
    code === 'storage/unauthenticated' ||
    code === 'storage/unauthorized-app' ||
    code === 'storage/unknown' ||
    code === 'storage/retry-limit-exceeded' ||
    code === 'storage/network-request-failed' ||
    code === 'storage/invalid-checksum' ||
    code === 'storage/server-file-wrong-size' ||
    code === RESUMABLE_UPLOAD_STALLED_CODE;
}

function isRefreshableStorageAuthError(err: unknown) {
  const code = getStorageUploadErrorCode(err);
  return code === 'storage/unauthenticated' || code === 'storage/unauthorized-app';
}

export interface StorageUploadOptions {
  refreshCredentials?: () => Promise<void>;
  onProgress?: (percentage: number) => void;
  onRetrying?: () => void;
  contentType?: string;
  /**
   * Authoritative gate used before retrying an upload that may already have
   * reached Storage. Resumable uploads never fall back without this gate.
   */
  shouldRetryAfterError?: (error: unknown) => Promise<boolean>;
  /** Narrow opt-in for known Rules propagation windows such as a new group logo. */
  retryUnauthorized?: boolean;
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
  let credentialsRefreshed = false;
  let integrityRetryUsed = false;

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

    const canRunStallWatchdog = () => {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      return !offline && !hidden;
    };

    const clearStallTimer = () => {
      if (stallTimer !== null) clearTimeout(stallTimer);
      stallTimer = null;
    };
    const cleanup = () => {
      clearStallTimer();
      unsubscribe?.();
      unsubscribe = undefined;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleConnectivityChange);
        window.removeEventListener('offline', handleConnectivityChange);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleConnectivityChange);
      }
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
      if (!canRunStallWatchdog()) return;
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

    function handleConnectivityChange() {
      if (settled) return;
      if (canRunStallWatchdog()) armStallTimer();
      else clearStallTimer();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleConnectivityChange);
      window.addEventListener('offline', handleConnectivityChange);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleConnectivityChange);
    }
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
      if (!isRetryableStorageUploadError(err, options.retryUnauthorized === true) ||
        attempt === STORAGE_UPLOAD_RETRY_DELAYS_MS.length - 1) {
        throw err;
      }
      const errorCode = getStorageUploadErrorCode(err);

      if (errorCode === 'storage/invalid-checksum' || errorCode === 'storage/server-file-wrong-size') {
        if (integrityRetryUsed) throw err;
        integrityRetryUsed = true;
      }

      if (isRefreshableStorageAuthError(err)) {
        // Auth/App Check is refreshed at most once. A second 401 is terminal
        // for this upload attempt; retrying would only repeat the same failure.
        if (credentialsRefreshed) throw err;
        try {
          await refreshCredentialsWithTimeout(options.refreshCredentials);
          credentialsRefreshed = true;
        } catch (refreshErr) {
          logger.warn('Failed to refresh Firebase upload credentials', refreshErr);
          throw refreshErr;
        }
      }

      // A rejected resumable task may have been finalized by Storage even
      // after cancel() returned. Never start uploadBytes() until the caller
      // proves that both the draft and object are still absent/stable.
      const retryApproved = options.shouldRetryAfterError
        ? await options.shouldRetryAfterError(err)
        : !options.onProgress;
      if (!retryApproved) throw err;

      if (errorCode === RESUMABLE_UPLOAD_STALLED_CODE && !credentialsRefreshed) {
        try {
          // Limited preflight: avoid a simple upload being blocked by the same
          // Auth/App Check acquisition that stalled the resumable request.
          await refreshCredentialsWithTimeout(options.refreshCredentials);
          credentialsRefreshed = true;
        } catch (refreshErr) {
          logger.warn('Credential refresh failed before compatible upload fallback', refreshErr);
          throw refreshErr;
        }
      }

      options.onRetrying?.();
      logger.warn('Retrying Storage upload after an approved transient failure', {
        attempt: attempt + 1,
        err,
      });
    }
  }

  throw lastErr;
}
