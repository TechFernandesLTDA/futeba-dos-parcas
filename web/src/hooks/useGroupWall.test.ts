// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => 'wall-posts-collection');
const mockDeleteObject = vi.fn();
const mockDoc = vi.fn((...args: unknown[]) => `doc:${args.slice(1).join('/')}`);
const mockGetDoc = vi.fn();
const mockGetDocFromServer = vi.fn();
const mockGetMetadata = vi.fn();
const mockOnSnapshot = vi.fn();
const mockStorageRef = vi.fn((...args: unknown[]) => `storage:${String(args[1])}`);
const mockUploadWithRetry = vi.fn();
const mockCreateDraft = vi.fn();
const mockUseAuth = vi.fn();
const mockUseToast = vi.fn();
const mockOutboxPut = vi.fn();
const mockOutboxRestore = vi.fn();
const mockOutboxRemove = vi.fn();
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
  getDocFromServer: (...args: unknown[]) => mockGetDocFromServer(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  getMetadata: (...args: unknown[]) => mockGetMetadata(...args),
}));

vi.mock('../services/firebase', () => ({ db: 'db' }));
vi.mock('../services/firebaseStorage', () => ({ storage: 'storage' }));
vi.mock('../utils/storageUpload', () => ({
  uploadImageWithStorageAuthRetry: (...args: unknown[]) => mockUploadWithRetry(...args),
}));
vi.mock('../utils/groupWallMediaOutbox', () => ({
  GroupWallMediaOutbox: class {
    put(...args: unknown[]) { return mockOutboxPut(...args); }
    restore(...args: unknown[]) { return mockOutboxRestore(...args); }
    remove(...args: unknown[]) { return mockOutboxRemove(...args); }
  },
  createGroupWallMediaOutboxFingerprint: (input: {
    groupId: string;
    text: string;
    file: File;
    mediaType?: string | null;
    highlightRef?: unknown;
  }) => JSON.stringify({
    groupId: input.groupId,
    text: input.text.trim(),
    name: input.file.name,
    type: input.mediaType ?? input.file.type,
    size: input.file.size,
    lastModified: input.file.lastModified,
    highlightRef: input.highlightRef ?? null,
  }),
}));
vi.mock('../services/groupWallMediaService', () => ({
  createGroupWallMediaDraft: (...args: unknown[]) => mockCreateDraft(...args),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => mockUseToast() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  createWallPostDocument,
  reconcileWallMediaUpload,
  useCreateWallPost,
} from './useGroupWall';

describe('createWallPostDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOutboxRestore.mockResolvedValue(null);
    mockOutboxRemove.mockResolvedValue(undefined);
    mockOutboxPut.mockImplementation(async (input: Record<string, unknown>) => ({
      schemaVersion: 1,
      ...input,
      file: input.file,
      highlightRef: input.highlightRef ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    }));
    mockUploadWithRetry.mockResolvedValue({});
    mockAddDoc.mockResolvedValue({ id: 'post-1' });
    mockDeleteObject.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGetDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'AWAITING_UPLOAD' }),
    });
    mockGetMetadata.mockRejectedValue({ code: 'storage/object-not-found' });
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

  afterEach(() => vi.useRealTimers());

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
      expect.objectContaining({
        refreshCredentials,
        contentType: 'image/png',
        shouldRetryAfterError: expect.any(Function),
      }),
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
      expect.objectContaining({
        contentType: 'video/mp4',
        shouldRetryAfterError: expect.any(Function),
      }),
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
      expect.objectContaining({
        contentType: 'video/mp4',
        shouldRetryAfterError: expect.any(Function),
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
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      expect.anything(),
      image,
      expect.objectContaining({
        refreshCredentials,
        onProgress: onUploadProgress,
        contentType: 'image/png',
        shouldRetryAfterError: expect.any(Function),
      }),
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
    mockGetDocFromServer.mockResolvedValueOnce({
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
    expect(mockGetDocFromServer).toHaveBeenCalledWith(
      'doc:groups/group-1/wall_post_drafts/post-1',
    );
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('conclui sem reupload quando a confirmação perdida já está READY', async () => {
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });
    mockUploadWithRetry.mockRejectedValueOnce({ code: 'storage/network-request-failed' });
    mockGetDocFromServer.mockResolvedValueOnce({
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

    expect(mockGetDocFromServer).toHaveBeenCalledWith(
      'doc:groups/group-1/wall_post_drafts/post-1',
    );
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('reconcilia como aceito quando o objeto já existe no Storage', async () => {
    mockGetMetadata.mockResolvedValueOnce({ size: 1024 });

    await expect(reconcileWallMediaUpload(
      'group-1',
      'post-1',
      'groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
    )).resolves.toEqual({ kind: 'accepted', status: 'OBJECT_PRESENT' });

    expect(mockGetDocFromServer).toHaveBeenCalledTimes(1);
    expect(mockGetMetadata).toHaveBeenCalledWith(
      'storage:groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
    );
  });

  it('interrompe o fallback se o draft avançar para PROCESSING durante a janela de reconciliação', async () => {
    vi.useFakeTimers();
    mockGetDocFromServer
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'AWAITING_UPLOAD' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'PROCESSING' }),
      });
    mockGetMetadata.mockRejectedValueOnce({ code: 'storage/object-not-found' });

    const promise = reconcileWallMediaUpload(
      'group-1',
      'post-1',
      'groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
    );
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ kind: 'accepted', status: 'PROCESSING' });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
  });

  it('autoriza retry somente após ausência estável no draft e no Storage', async () => {
    vi.useFakeTimers();

    const promise = reconcileWallMediaUpload(
      'group-1',
      'post-1',
      'groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
    );
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ kind: 'retry' });
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(3);
    expect(mockGetMetadata).toHaveBeenCalledTimes(3);
  });

  it('não autoriza retry quando a leitura de metadata é inconclusiva', async () => {
    mockGetMetadata.mockRejectedValueOnce({ code: 'storage/network-request-failed' });

    await expect(reconcileWallMediaUpload(
      'group-1',
      'post-1',
      'groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
    )).resolves.toEqual({ kind: 'inconclusive' });

    expect(mockGetMetadata).toHaveBeenCalledTimes(1);
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockOutboxRestore.mockResolvedValue(null);
    mockOutboxRemove.mockResolvedValue(undefined);
    mockOutboxPut.mockImplementation(async (input: Record<string, unknown>) => ({
      schemaVersion: 1,
      ...input,
      file: input.file,
      highlightRef: input.highlightRef ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    }));
    mockUploadWithRetry.mockResolvedValue({});
    mockAddDoc.mockResolvedValue({ id: 'post-1' });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGetDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'AWAITING_UPLOAD' }),
    });
    mockGetMetadata.mockRejectedValue({ code: 'storage/object-not-found' });
    mockCreateDraft.mockResolvedValue({
      postId: 'post-1',
      uploadPath: 'groups/group-1/wall_media_staging/post-1/user-1/source.mp4',
      expiresAt: '2026-07-11T16:00:00.000Z',
      maxBytes: 25 * 1024 * 1024,
      pipelineVersion: 1,
      duplicate: false,
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

  it('restaura o anexo após reload e reutiliza o clientRequestId idempotente', async () => {
    const video = new File(['video'], 'partida.mp4', {
      type: 'video/mp4',
      lastModified: 1234,
    });
    const fingerprint = JSON.stringify({
      groupId: 'group-1',
      text: 'Recuperado',
      name: video.name,
      type: 'video/mp4',
      size: video.size,
      lastModified: video.lastModified,
      highlightRef: null,
    });
    mockOutboxRestore.mockResolvedValueOnce({
      schemaVersion: 1,
      ownerUid: 'user-1',
      groupId: 'group-1',
      text: 'Recuperado',
      file: video,
      fingerprint,
      clientRequestId: CLIENT_REQUEST_ID,
      highlightRef: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    const { result } = renderHook(() => useCreateWallPost('group-1'));
    await waitFor(() => {
      expect(result.current.restoredMediaDraft?.fingerprint).toBe(fingerprint);
    });

    await act(async () => {
      await result.current.create('Recuperado', { mediaFile: video });
    });

    expect(mockCreateDraft).toHaveBeenCalledWith(expect.objectContaining({
      clientRequestId: CLIENT_REQUEST_ID,
    }));
    expect(mockOutboxPut).toHaveBeenCalledWith(expect.objectContaining({
      clientRequestId: CLIENT_REQUEST_ID,
      expiresAt: expect.any(Number),
    }));
    expect(mockOutboxPut.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateDraft.mock.invocationCallOrder[0],
    );
    expect(mockOutboxRemove).toHaveBeenCalledWith('user-1', 'group-1');
    expect(result.current.restoredMediaDraft).toBeNull();
  });

  it('não deixa a conclusão do grupo anterior limpar o draft restaurado do grupo novo', async () => {
    const firstVideo = new File(['first'], 'primeiro.mp4', { type: 'video/mp4', lastModified: 1 });
    const secondVideo = new File(['second'], 'segundo.mp4', { type: 'video/mp4', lastModified: 2 });
    const secondFingerprint = JSON.stringify({
      groupId: 'group-2',
      text: 'Segundo grupo',
      name: secondVideo.name,
      type: 'video/mp4',
      size: secondVideo.size,
      lastModified: secondVideo.lastModified,
      highlightRef: null,
    });
    mockOutboxRestore.mockImplementation(async (_ownerUid: string, restoredGroupId: string) => (
      restoredGroupId === 'group-2'
        ? {
            schemaVersion: 1,
            ownerUid: 'user-1',
            groupId: 'group-2',
            text: 'Segundo grupo',
            file: secondVideo,
            fingerprint: secondFingerprint,
            clientRequestId: '22222222-2222-4222-8222-222222222222',
            highlightRef: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 60_000,
          }
        : null
    ));
    let resolveFirstUpload: ((value: unknown) => void) | undefined;
    mockUploadWithRetry.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirstUpload = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ activeGroupId }) => useCreateWallPost(activeGroupId),
      { initialProps: { activeGroupId: 'group-1' } },
    );
    let firstCreate: Promise<void>;
    act(() => {
      firstCreate = result.current.create('Primeiro grupo', { mediaFile: firstVideo });
    });
    await waitFor(() => expect(mockUploadWithRetry).toHaveBeenCalledOnce());

    rerender({ activeGroupId: 'group-2' });
    await waitFor(() => {
      expect(result.current.restoredMediaDraft?.fingerprint).toBe(secondFingerprint);
      expect(result.current.sending).toBe(false);
    });

    await act(async () => {
      resolveFirstUpload?.({});
      await firstCreate;
    });

    expect(result.current.restoredMediaDraft?.fingerprint).toBe(secondFingerprint);
    expect(mockOutboxRemove).toHaveBeenCalledWith('user-1', 'group-1');
  });
});
