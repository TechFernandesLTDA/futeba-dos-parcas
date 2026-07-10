// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((..._args: unknown[]) => 'wall-posts-collection');
const mockDeleteObject = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockStorageRef = vi.fn((...args: unknown[]) => `storage:${String(args[1])}`);
const mockUploadWithRetry = vi.fn();

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
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/ToastContext', () => ({ useToast: vi.fn() }));

import { createWallPostDocument } from './useGroupWall';

describe('createWallPostDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadWithRetry.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue('https://firebasestorage.googleapis.com/photo.png');
    mockAddDoc.mockResolvedValue({ id: 'post-1' });
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it('envia foto sem legenda com retry e path de draft pertencente ao autor', async () => {
    const image = new File(['image'], 'foto.png', { type: 'image/png' });

    await createWallPostDocument({
      groupId: 'group-1',
      currentUserUid: 'user-1',
      authorName: 'Jordi',
      authorPhotoUrl: null,
      text: '',
      options: { imageFile: image },
    });

    const mediaPath = mockStorageRef.mock.calls[0]?.[1] as string;
    expect(mediaPath).toMatch(/^groups\/group-1\/wall_media\/__draft__\/user-1\/.*\.png$/);
    expect(mockUploadWithRetry).toHaveBeenCalledWith(`storage:${mediaPath}`, image);
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
  });
});
