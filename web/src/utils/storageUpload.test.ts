import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUploadBytes = vi.hoisted(() => vi.fn());
const mockGetAppCheckToken = vi.hoisted(() => vi.fn());

vi.mock('firebase/storage', () => ({
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
}));
vi.mock('firebase/app-check', () => ({
  getToken: (...args: unknown[]) => mockGetAppCheckToken(...args),
}));
vi.mock('../services/firebase', () => ({ appCheck: 'app-check' }));
vi.mock('./logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import {
  refreshFirebaseUploadCredentials,
  uploadImageWithStorageAuthRetry,
} from './storageUpload';

describe('storageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('renova Auth e App Check juntos', async () => {
    const getIdToken = vi.fn().mockResolvedValue('id-token');
    mockGetAppCheckToken.mockResolvedValue({ token: 'app-check-token' });

    await refreshFirebaseUploadCredentials({ getIdToken } as never);

    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(mockGetAppCheckToken).toHaveBeenCalledWith('app-check', true);
  });

  it('renova credenciais e repete upload após falha transitória', async () => {
    const refreshCredentials = vi.fn().mockResolvedValue(undefined);
    mockUploadBytes
      .mockRejectedValueOnce({ code: 'storage/unauthorized' })
      .mockResolvedValueOnce({ ref: 'uploaded' });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    const promise = uploadImageWithStorageAuthRetry('profile-ref' as never, file, {
      refreshCredentials,
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ref: 'uploaded' });
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).toHaveBeenCalledTimes(2);
  });

  it('repete falhas de rede sem exigir renovação de credencial', async () => {
    const refreshCredentials = vi.fn();
    mockUploadBytes
      .mockRejectedValueOnce({ code: 'storage/network-request-failed' })
      .mockResolvedValueOnce({ ref: 'uploaded' });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    const promise = uploadImageWithStorageAuthRetry('profile-ref' as never, file, {
      refreshCredentials,
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ref: 'uploaded' });
    expect(refreshCredentials).not.toHaveBeenCalled();
  });
});
