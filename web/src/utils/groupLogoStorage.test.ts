import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteObjectMock, getDownloadURLMock, refMock, uploadMock } = vi.hoisted(() => ({
  deleteObjectMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
  refMock: vi.fn((storage: unknown, path: string) => ({ storage, path })),
  uploadMock: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  deleteObject: deleteObjectMock,
  getDownloadURL: getDownloadURLMock,
  ref: refMock,
}));

vi.mock('./storageUpload', () => ({
  uploadImageWithStorageAuthRetry: uploadMock,
}));

import { getGroupLogoStoragePath, uploadGroupLogo } from './groupLogoStorage';

const STORAGE = { app: 'stub' } as never;

function makeFile(type: string): File {
  return new File(['bytes'], 'logo', { type });
}

describe('groupLogoStorage', () => {
  beforeEach(() => {
    refMock.mockClear();
    uploadMock.mockReset().mockResolvedValue(undefined);
    getDownloadURLMock.mockReset();
    deleteObjectMock.mockReset().mockResolvedValue(undefined);
  });

  describe('getGroupLogoStoragePath', () => {
    it.each([
      ['image/jpeg', 'logo.jpg'],
      ['image/png', 'logo.png'],
      ['image/webp', 'logo.webp'],
      ['image/gif', 'logo.jpg'], // tipo não mapeado → fallback jpg
      ['', 'logo.jpg'], // sem tipo → fallback jpg
    ])('type %s → %s', (type, expectedFile) => {
      expect(getGroupLogoStoragePath('u1', 'g1', makeFile(type))).toBe(
        `users/u1/group-logos/g1/${expectedFile}`,
      );
    });
  });

  describe('uploadGroupLogo', () => {
    it('faz upload com retry de Rules e devolve a URL de download', async () => {
      getDownloadURLMock.mockResolvedValue('https://storage/novo');
      const file = makeFile('image/png');

      const url = await uploadGroupLogo(STORAGE, 'u1', 'g1', file);

      expect(uploadMock).toHaveBeenCalledTimes(1);
      expect(uploadMock).toHaveBeenCalledWith(
        { storage: STORAGE, path: 'users/u1/group-logos/g1/logo.png' },
        file,
        { retryUnauthorized: true },
      );
      expect(getDownloadURLMock).toHaveBeenCalledWith({
        storage: STORAGE,
        path: 'users/u1/group-logos/g1/logo.png',
      });
      expect(url).toBe('https://storage/novo');
    });

    it('não tenta deletar quando não há foto anterior (null/undefined)', async () => {
      getDownloadURLMock.mockResolvedValue('https://storage/novo');

      await uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png'), null);
      await uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png'));

      expect(deleteObjectMock).not.toHaveBeenCalled();
    });

    it('não deleta quando a URL anterior é igual à nova', async () => {
      getDownloadURLMock.mockResolvedValue('https://storage/mesma');

      await uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png'), 'https://storage/mesma');

      expect(deleteObjectMock).not.toHaveBeenCalled();
    });

    it('deleta o objeto anterior quando a URL mudou', async () => {
      getDownloadURLMock.mockResolvedValue('https://storage/novo');

      await uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png'), 'https://storage/antigo');

      expect(refMock).toHaveBeenCalledWith(STORAGE, 'https://storage/antigo');
      expect(deleteObjectMock).toHaveBeenCalledWith({
        storage: STORAGE,
        path: 'https://storage/antigo',
      });
    });

    it('engole storage/object-not-found ao deletar a foto anterior (já removida)', async () => {
      getDownloadURLMock.mockResolvedValue('https://storage/novo');
      deleteObjectMock.mockRejectedValue({ code: 'storage/object-not-found' });

      await expect(
        uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png'), 'https://storage/antigo'),
      ).resolves.toBe('https://storage/novo');
    });

    it('propaga erro de deleção que não seja object-not-found', async () => {
      getDownloadURLMock.mockResolvedValue('https://storage/novo');
      deleteObjectMock.mockRejectedValue({ code: 'storage/canceled' });

      await expect(
        uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png'), 'https://storage/antigo'),
      ).rejects.toEqual({ code: 'storage/canceled' });
    });

    it('propaga falha do upload e não chega a pedir URL', async () => {
      uploadMock.mockRejectedValue(new Error('storage/unauthorized'));

      await expect(
        uploadGroupLogo(STORAGE, 'u', 'g', makeFile('image/png')),
      ).rejects.toThrow('storage/unauthorized');
      expect(getDownloadURLMock).not.toHaveBeenCalled();
      expect(deleteObjectMock).not.toHaveBeenCalled();
    });
  });
});
