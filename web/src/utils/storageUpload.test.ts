import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUploadBytes = vi.hoisted(() => vi.fn());
const mockUploadBytesResumable = vi.hoisted(() => vi.fn());
const mockGetAppCheckToken = vi.hoisted(() => vi.fn());

vi.mock('firebase/storage', () => ({
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
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

  it('não fica preso se a renovação de credenciais não responder', async () => {
    const getIdToken = vi.fn(() => new Promise<string>(() => undefined));
    mockGetAppCheckToken.mockResolvedValue({ token: 'app-check-token' });

    const promise = refreshFirebaseUploadCredentials({ getIdToken } as never);
    const expectation = expect(promise).rejects.toThrow('Tempo esgotado');
    await vi.advanceTimersByTimeAsync(15_000);

    await expectation;
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

  it('preserva uploadBytes para callers sem callback de progresso', async () => {
    mockUploadBytes.mockResolvedValueOnce({ ref: 'uploaded' });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    await expect(uploadImageWithStorageAuthRetry(
      'profile-ref' as never,
      file,
    )).resolves.toEqual({ ref: 'uploaded' });

    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
  });

  it('permite normalizar o content type de MP4 informado pelo navegador', async () => {
    mockUploadBytes.mockResolvedValueOnce({ ref: 'uploaded' });
    const file = new File(['video'], 'partida.mp4', { type: '' });

    await uploadImageWithStorageAuthRetry('wall-ref' as never, file, {
      contentType: 'video/mp4',
    });

    expect(mockUploadBytes).toHaveBeenCalledWith(
      'wall-ref',
      file,
      { contentType: 'video/mp4' },
    );
  });

  it('faz fallback para upload simples se o resumable falhar', async () => {
    const onProgress = vi.fn();
    const refreshCredentials = vi.fn().mockResolvedValue(undefined);
    const firstTask = {
      snapshot: { ref: 'first-attempt' },
      on: vi.fn((
        _event: string,
        next: (snapshot: {bytesTransferred: number; totalBytes: number}) => void,
        error: (err: unknown) => void,
      ) => {
        next({ bytesTransferred: 40, totalBytes: 100 });
        error({ code: 'storage/network-request-failed' });
      }),
    };
    mockUploadBytesResumable.mockReturnValueOnce(firstTask);
    mockUploadBytes.mockResolvedValueOnce({ ref: 'uploaded' });
    const file = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    const promise = uploadImageWithStorageAuthRetry('wall-ref' as never, file, {
      refreshCredentials,
      onProgress,
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ref: 'uploaded' });
    expect(onProgress.mock.calls.map(([percentage]) => percentage)).toEqual([0, 40, 100]);
    expect(mockUploadBytesResumable).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    expect(refreshCredentials).not.toHaveBeenCalled();
  });

  it('cancela resumable inativo e conclui pelo upload compatível', async () => {
    const onProgress = vi.fn();
    const onRetrying = vi.fn();
    const cancel = vi.fn(() => true);
    const unsubscribe = vi.fn();
    mockUploadBytesResumable.mockReturnValueOnce({
      snapshot: { ref: 'stalled-attempt', state: 'running' },
      cancel,
      on: vi.fn(() => unsubscribe),
    });
    mockUploadBytes.mockResolvedValueOnce({ ref: 'uploaded' });
    const file = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    const promise = uploadImageWithStorageAuthRetry('wall-ref' as never, file, {
      onProgress,
      onRetrying,
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ ref: 'uploaded' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockUploadBytesResumable).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    expect(onRetrying).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls.map(([percentage]) => percentage)).toEqual([0, 100]);
  });

  it('não inicia fallback se o resumable concluir durante o watchdog', async () => {
    const snapshot = { ref: 'resumable-uploaded', state: 'running' };
    const cancel = vi.fn(() => {
      snapshot.state = 'success';
      return false;
    });
    mockUploadBytesResumable.mockReturnValueOnce({
      snapshot,
      cancel,
      on: vi.fn(() => vi.fn()),
    });
    const file = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    const promise = uploadImageWithStorageAuthRetry('wall-ref' as never, file, {
      onProgress: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(promise).resolves.toEqual(snapshot);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });

  it('limita refresh travado antes do fallback compatível', async () => {
    const refreshCredentials = vi.fn(() => new Promise<void>(() => undefined));
    mockUploadBytesResumable.mockReturnValueOnce({
      snapshot: { ref: 'stalled-attempt', state: 'running' },
      cancel: vi.fn(() => true),
      on: vi.fn(() => vi.fn()),
    });
    const file = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    const promise = uploadImageWithStorageAuthRetry('wall-ref' as never, file, {
      refreshCredentials,
      onProgress: vi.fn(),
    });
    const expectation = expect(promise).rejects.toMatchObject({
      code: 'storage/credential-refresh-timeout',
    });
    await vi.runAllTimersAsync();

    await expectation;
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
    expect(mockUploadBytes).not.toHaveBeenCalled();
  });

  it('reinicia o watchdog quando bytes avançam ou recuam durante retomada', async () => {
    const onProgress = vi.fn();
    const cancel = vi.fn();
    let next: ((snapshot: {bytesTransferred: number; totalBytes: number}) => void) | undefined;
    let complete: (() => void) | undefined;
    const task = {
      snapshot: { ref: 'resumable-uploaded', state: 'running' },
      cancel,
      on: vi.fn((
        _event: string,
        nextCallback: typeof next,
        _error: (err: unknown) => void,
        completeCallback: typeof complete,
      ) => {
        next = nextCallback;
        complete = completeCallback;
        return vi.fn();
      }),
    };
    mockUploadBytesResumable.mockReturnValueOnce(task);
    const file = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    const promise = uploadImageWithStorageAuthRetry('wall-ref' as never, file, {
      onProgress,
    });
    await vi.advanceTimersByTimeAsync(15_000);
    next?.({ bytesTransferred: 80, totalBytes: 100 });
    await vi.advanceTimersByTimeAsync(15_000);
    next?.({ bytesTransferred: 40, totalBytes: 100 });
    await vi.advanceTimersByTimeAsync(15_000);
    next?.({ bytesTransferred: 60, totalBytes: 100 });
    complete?.();

    await expect(promise).resolves.toEqual(task.snapshot);
    expect(cancel).not.toHaveBeenCalled();
    expect(mockUploadBytes).not.toHaveBeenCalled();
    expect(onProgress.mock.calls.map(([percentage]) => percentage)).toEqual([0, 80, 100]);
  });
});
