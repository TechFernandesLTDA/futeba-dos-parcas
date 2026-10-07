import { describe, expect, it, vi } from 'vitest';

const { getDownloadURLMock, refMock, storageStub } = vi.hoisted(() => ({
  getDownloadURLMock: vi.fn(),
  refMock: vi.fn((storage: unknown, path: string) => ({ storage, path })),
  storageStub: { app: 'stub' },
}));

vi.mock('firebase/storage', () => ({
  getDownloadURL: getDownloadURLMock,
  ref: refMock,
}));

vi.mock('../services/firebaseStorage', () => ({ storage: storageStub }));

import { resolveWallPostStorageUrl } from './wallMediaStorage';

describe('wallMediaStorage', () => {
  it('resolve URL de download autenticada para o path informado', async () => {
    getDownloadURLMock.mockResolvedValue('https://storage.googleapis.com/assinada');

    await expect(resolveWallPostStorageUrl('groups/g1/wall/x.jpg')).resolves.toBe(
      'https://storage.googleapis.com/assinada',
    );

    expect(refMock).toHaveBeenCalledTimes(1);
    expect(refMock).toHaveBeenCalledWith(storageStub, 'groups/g1/wall/x.jpg');
    expect(getDownloadURLMock).toHaveBeenCalledWith({ storage: storageStub, path: 'groups/g1/wall/x.jpg' });
  });

  it('importa os módulos dinamicamente (lazy) a cada chamada', async () => {
    getDownloadURLMock.mockResolvedValue('u1');
    await resolveWallPostStorageUrl('a');
    getDownloadURLMock.mockResolvedValue('u2');
    await resolveWallPostStorageUrl('b');

    expect(refMock).toHaveBeenCalledWith(storageStub, 'a');
    expect(refMock).toHaveBeenCalledWith(storageStub, 'b');
  });

  it('propaga falha do getDownloadURL', async () => {
    getDownloadURLMock.mockRejectedValue(new Error('storage/unauthorized'));

    await expect(resolveWallPostStorageUrl('groups/g1/wall/x.jpg')).rejects.toThrow(
      'storage/unauthorized',
    );
  });
});
