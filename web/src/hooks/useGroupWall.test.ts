// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => 'wall-posts-collection');
const mockDeleteObject = vi.fn();
const mockDoc = vi.fn((...args: unknown[]) => `doc:${args.slice(1).join('/')}`);
const mockGetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockStorageRef = vi.fn((...args: unknown[]) => `storage:${String(args[1])}`);
const mockUploadWithRetry = vi.fn();
const mockCreateDraft = vi.fn();
const mockUseAuth = vi.fn();
const mockUseToast = vi.fn();
const CLIENT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock('../services/firebase', () => ({ db: 'db' }));
vi.mock('../services/firebaseStorage', () => ({ storage: 'storage' }));
vi.mock('../utils/storageUpload', () => ({
  uploadImageWithStorageAuthRetry: (...args: unknown[]) => mockUploadWithRetry(...args),
}));
vi.mock('../services/groupWallMediaService', () => ({
  createGroupWallMediaDraft: (...args: unknown[]) => mockCreateDraft(...args),
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
    mockAddDoc.mockResolvedValue({ id: 'post-1' });
    mockDeleteObject.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockCreateDraft.mockImplementation(async (request: { declaredContentType: string }) => {
      const extension = request.declaredContentType === 'video/mp4'
        ? 'mp4'
        : request.declaredContentType === 'image/jpeg'
          ? 'jpg'
          : request.declaredContentType.split('/')[1];
      return {
        postId: 'post-1',
        uploadPath: `groups/group-1/wall_media_staging/post-1/user-1/source.${extension}`,
        expiresAt: '2026-07-11T16:00:00.000Z',
        maxBytes: 25 * 1024 * 1024,
        pipelineVersion: 1,
        duplicate: false,
      };
    });
    mockOnSnapshot.mockImplementation((_reference, onNext) => {
      queueMicrotask(() => onNext({
        exists: () => true,
        data: () => ({ status: 'READY' }),
      }));
      return vi.fn();
    });
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

  it('prepara e envia foto sem legenda pelo caminho de staging autorizado', async () => {
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
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(mockCreateDraft).toHaveBeenCalledWith({
      groupId: 'group-1',
      text: '',
      declaredContentType: 'image/png',
      sizeBytes: image.size,
      fileName: 'foto.png',
      clientRequestId: CLIENT_REQUEST_ID,
      highlightRef: null,
    });
    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      'storage:groups/group-1/wall_media_staging/post-1/user-1/source.png',
      image,
      { refreshCredentials, contentType: 'image/png' },
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveBeenCalledWith(
      'doc:groups/group-1/wall_post_drafts/post-1',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('preserva o rascunho e mostra a rejeição acionável do processamento', async () => {
    const image = new File(['image'], 'foto.jpg', { type: 'image/jpeg' });
    mockOnSnapshot.mockImplementationOnce((_reference, onNext) => {
      queueMicrotask(() => onNext({
        exists: () => true,
        data: () => ({ status: 'REJECTED', error_message: 'Arquivo corrompido.' }),
      }));
      return vi.fn();
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: 'Resenha',
      options: { imageFile: image },
      clientRequestId: CLIENT_REQUEST_ID,
    })).rejects.toThrow('Arquivo corrompido.');

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
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(mockCreateDraft).toHaveBeenCalledWith(expect.objectContaining({
      declaredContentType: 'video/mp4',
      fileName: 'partida.mp4',
    }));
    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      'storage:groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
      video,
      { contentType: 'video/mp4' },
    );
  });

  it('normaliza MP4 selecionado no Android sem MIME confiável', async () => {
    const video = new File(['video'], 'partida.MP4', { type: '' });

    await createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: video },
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(mockCreateDraft).toHaveBeenCalledWith(expect.objectContaining({
      declaredContentType: 'video/mp4',
    }));
    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      'storage:groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
      video,
      { contentType: 'video/mp4' },
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
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      expect.anything(),
      image,
      { refreshCredentials, onProgress: onUploadProgress, contentType: 'image/png' },
    );
  });

  it('conclui retry idempotente já READY sem reenviar bytes', async () => {
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });
    mockCreateDraft.mockResolvedValueOnce({
      postId: 'post-1',
      uploadPath: 'groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
      expiresAt: '2026-07-11T16:00:00.000Z',
      maxBytes: 25 * 1024 * 1024,
      pipelineVersion: 1,
      duplicate: true,
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'READY' }),
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: video },
      clientRequestId: CLIENT_REQUEST_ID,
    })).resolves.toEqual({ postId: 'post-1', pipelineVersion: 1 });

    expect(mockUploadWithRetry).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('recusa staging reservado para outro autor antes do upload', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    mockCreateDraft.mockResolvedValueOnce({
      postId: 'post-1',
      uploadPath: 'groups/group-1/wall_media_staging/post-1/outro-user/source.png',
      expiresAt: '2026-07-11T16:00:00.000Z',
      maxBytes: 10 * 1024 * 1024,
      pipelineVersion: 1,
      duplicate: false,
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: image },
      clientRequestId: CLIENT_REQUEST_ID,
    })).rejects.toThrow('caminho de mídia inválido');
    expect(mockUploadWithRetry).not.toHaveBeenCalled();
  });

  it('apenas observa retry idempotente que já está PROCESSING', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    const onProcessing = vi.fn();
    mockCreateDraft.mockResolvedValueOnce({
      postId: 'post-1',
      uploadPath: 'groups/group-1/wall_media_staging/post-1/user-1/source.png',
      expiresAt: '2026-07-11T16:00:00.000Z',
      maxBytes: 10 * 1024 * 1024,
      pipelineVersion: 1,
      duplicate: true,
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'PROCESSING' }),
    });

    await createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: 'Resenha',
      options: { mediaFile: image },
      onProcessing,
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(onProcessing).toHaveBeenCalled();
    expect(mockUploadWithRetry).not.toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('recupera confirmação perdida quando o objeto já entrou em PROCESSING', async () => {
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });
    const onProcessing = vi.fn();
    mockUploadWithRetry.mockRejectedValueOnce({ code: 'storage/network-request-failed' });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'PROCESSING' }),
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: 'Gol',
      options: { mediaFile: video },
      onProcessing,
      clientRequestId: CLIENT_REQUEST_ID,
    })).resolves.toEqual({ postId: 'post-1', pipelineVersion: 1 });

    expect(onProcessing).toHaveBeenCalled();
    expect(mockGetDoc).toHaveBeenCalledWith(
      'doc:groups/group-1/wall_post_drafts/post-1',
    );
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('conclui sem reupload quando a confirmação perdida já está READY', async () => {
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });
    mockUploadWithRetry.mockRejectedValueOnce({ code: 'storage/network-request-failed' });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'READY' }),
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: 'Gol confirmado',
      options: { mediaFile: video },
      clientRequestId: CLIENT_REQUEST_ID,
    })).resolves.toEqual({ postId: 'post-1', pipelineVersion: 1 });

    expect(mockGetDoc).toHaveBeenCalledWith(
      'doc:groups/group-1/wall_post_drafts/post-1',
    );
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('falha imediatamente quando o draft de mídia não existe', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockImplementationOnce((_reference, onNext) => {
      queueMicrotask(() => onNext({
        exists: () => false,
        metadata: { fromCache: false },
      }));
      return unsubscribe;
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: image },
      clientRequestId: CLIENT_REQUEST_ID,
    })).rejects.toMatchObject({
      code: 'wall-media/draft-not-found',
      message: 'O envio de mídia não foi encontrado. Tente novamente.',
    });

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('aguarda o servidor quando apenas o cache local ainda não conhece o draft', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockImplementationOnce((_reference, onNext) => {
      queueMicrotask(() => {
        onNext({
          exists: () => false,
          metadata: { fromCache: true },
        });
        onNext({
          exists: () => true,
          data: () => ({ status: 'READY' }),
        });
      });
      return unsubscribe;
    });

    await expect(createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { mediaFile: image },
      clientRequestId: CLIENT_REQUEST_ID,
    })).resolves.toEqual({ postId: 'post-1', pipelineVersion: 1 });

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe('useCreateWallPost', () => {
  it('expõe upload e processamento até o draft ficar pronto', async () => {
    let resolveUpload: ((value: unknown) => void) | undefined;
    let progressCallback: ((percentage: number) => void) | undefined;
    let retryCallback: (() => void) | undefined;
    let draftListener: ((snapshot: { exists: () => boolean; data: () => { status: string } }) => void) | undefined;
    mockOnSnapshot.mockImplementation((_reference, onNext) => {
      draftListener = onNext;
      return vi.fn();
    });
    mockUploadWithRetry.mockImplementation((
      _ref: unknown,
      _file: File,
      options: {onProgress?: (percentage: number) => void; onRetrying?: () => void},
    ) => {
      progressCallback = options.onProgress;
      retryCallback = options.onRetrying;
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
      expect(result.current.mediaPhase).toBe('uploading');
    });

    act(() => progressCallback?.(37));
    expect(result.current.uploadProgress).toBe(37);

    act(() => retryCallback?.());
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.mediaPhase).toBe('uploading');

    act(() => {
      resolveUpload?.({});
    });

    await waitFor(() => {
      expect(result.current.mediaPhase).toBe('processing');
      expect(draftListener).toBeDefined();
    });

    await act(async () => {
      draftListener?.({ exists: () => true, data: () => ({ status: 'READY' }) });
      await createPromise;
    });

    expect(result.current.sending).toBe(false);
    expect(result.current.uploadProgress).toBeNull();
    expect(result.current.mediaPhase).toBeNull();
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
