// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => 'wall-posts-collection');
const mockDeleteObject = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockStorageRef = vi.fn((...args: unknown[]) => `storage:${String(args[1])}`);
const mockUploadWithRetry = vi.fn();
const mockUseAuth = vi.fn();
const mockUseToast = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock('../services/firebase', () => ({ db: 'db' }));
vi.mock('../services/firebaseStorage', () => ({ storage: 'storage' }));
vi.mock('../utils/storageUpload', () => ({
  uploadImageWithStorageAuthRetry: (...args: unknown[]) => mockUploadWithRetry(...args),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => mockUseToast() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { createWallPostDocument, useCreateWallPost } from './useGroupWall';

describe('createWallPostDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadWithRetry.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue('https://firebasestorage.googleapis.com/photo.png');
    mockAddDoc.mockResolvedValue({ id: 'post-1' });
    mockDeleteObject.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      currentUser: {
        uid: 'user-1',
        displayName: 'Jordi',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token'),
      },
      user: { name: 'Jordi', photoUrl: null },
    });
    mockUseToast.mockReturnValue({
      showError: vi.fn(),
      showSuccess: vi.fn(),
    });
  });

  it('envia foto sem legenda com retry e path de draft pertencente ao autor', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    const refreshCredentials = vi.fn().mockResolvedValue(undefined);

    await createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { imageFile: image },
      refreshCredentials,
    });

    const mediaPath = mockStorageRef.mock.calls[0]?.[1] as string;
    expect(mediaPath).toMatch(/^groups\/group-1\/wall_media\/__draft__\/user-1\/.*\.png$/);
    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      `storage:${mediaPath}`,
      image,
      { refreshCredentials },
    );
    expect(mockAddDoc).toHaveBeenCalledWith(
      'wall-posts-collection',
      expect.objectContaining({
        text: '',
        media_url: 'https://firebasestorage.googleapis.com/photo.png',
        media_path: mediaPath,
        media_type: 'image/png',
      }),
    );
  });

  it('remove o draft do próprio autor quando a gravação do post falha', async () => {
    const image = new File(['image'], 'foto.jpg', { type: 'image/jpeg' });
    mockAddDoc.mockRejectedValueOnce(new Error('firestore indisponível'));

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: 'Resenha',
      options: { imageFile: image },
    })).rejects.toThrow('firestore indisponível');

    const mediaPath = mockStorageRef.mock.calls[0]?.[1] as string;
    expect(mediaPath).toContain('/__draft__/user-1/');
    expect(mockDeleteObject).toHaveBeenCalledWith(`storage:${mediaPath}`);
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it('remove o draft quando getDownloadURL falha sem mascarar o erro original', async () => {
    const image = new File(['image'], 'foto.jpg', { type: 'image/jpeg' });
    const downloadError = new Error('URL indisponível');
    mockGetDownloadURL.mockRejectedValueOnce(downloadError);
    mockDeleteObject.mockRejectedValueOnce(new Error('cleanup indisponível'));

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: 'Resenha',
      options: { imageFile: image },
    })).rejects.toBe(downloadError);

    const mediaPath = mockStorageRef.mock.calls[0]?.[1] as string;
    expect(mockDeleteObject).toHaveBeenCalledWith(`storage:${mediaPath}`);
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('envia vídeo MP4 com extensão e content type preservados', async () => {
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    await createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: video },
    });

    const mediaPath = mockStorageRef.mock.calls[0]?.[1] as string;
    expect(mediaPath).toMatch(/^groups\/group-1\/wall_media\/__draft__\/user-1\/.*\.mp4$/);
    expect(mockUploadWithRetry).toHaveBeenCalledWith(`storage:${mediaPath}`, video);
    expect(mockAddDoc).toHaveBeenCalledWith(
      'wall-posts-collection',
      expect.objectContaining({
        media_path: mediaPath,
        media_type: 'video/mp4',
      }),
    );
  });

  it('propaga callback de progresso para o upload com refresh de credenciais', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    const refreshCredentials = vi.fn().mockResolvedValue(undefined);
    const onUploadProgress = vi.fn();

    await createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: image },
      refreshCredentials,
      onUploadProgress,
    });

    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      expect.anything(),
      image,
      { refreshCredentials, onProgress: onUploadProgress },
    );
  });
});

describe('useCreateWallPost', () => {
  it('expõe progresso durante upload e reseta com segurança ao concluir', async () => {
    let resolveUpload: ((value: unknown) => void) | undefined;
    let progressCallback: ((percentage: number) => void) | undefined;
    mockUploadWithRetry.mockImplementation((
      _ref: unknown,
      _file: File,
      options: {onProgress?: (percentage: number) => void},
    ) => {
      progressCallback = options.onProgress;
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });
    const { result } = renderHook(() => useCreateWallPost('group-1'));
    let createPromise: Promise<void>;

    act(() => {
      createPromise = result.current.create('', { mediaFile: video });
    });

    await waitFor(() => {
      expect(result.current.sending).toBe(true);
      expect(result.current.uploadProgress).toBe(0);
    });

    act(() => progressCallback?.(37));
    expect(result.current.uploadProgress).toBe(37);

    await act(async () => {
      resolveUpload?.({});
      await createPromise;
    });

    expect(result.current.sending).toBe(false);
    expect(result.current.uploadProgress).toBeNull();
  });

  it('mantém uploadProgress null em post sem mídia', async () => {
    const { result } = renderHook(() => useCreateWallPost('group-1'));

    await act(async () => {
      await result.current.create('Só texto');
    });

    expect(result.current.uploadProgress).toBeNull();
    expect(result.current.sending).toBe(false);
  });
});
