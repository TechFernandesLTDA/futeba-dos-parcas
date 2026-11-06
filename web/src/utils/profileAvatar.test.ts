import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStorageRef = vi.hoisted(() => vi.fn((..._args: unknown[]) => 'profile-ref'));
const mockGetDownloadURL = vi.hoisted(() =>
  vi.fn((..._args: unknown[]) => Promise.resolve('https://storage.example/profile.jpg?token=abc'))
);
const mockUploadWithRetry = vi.hoisted(() => vi.fn((..._args: unknown[]) => Promise.resolve({})));
const mockRefreshCredentials = vi.hoisted(() => vi.fn((..._args: unknown[]) => Promise.resolve()));

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock('../services/firebaseStorage', () => ({ storage: 'storage' }));
vi.mock('./storageUpload', () => ({
  uploadImageWithStorageAuthRetry: (...args: unknown[]) => mockUploadWithRetry(...args),
  refreshFirebaseUploadCredentials: (...args: unknown[]) => mockRefreshCredentials(...args),
  getStorageUploadErrorCode: (err: unknown) =>
    typeof err === 'object' && err && 'code' in err ? String(err.code) : '',
}));

import {
  getProfileAvatarUploadErrorKey,
  PROFILE_AVATAR_MAX_BYTES,
  uploadProfileAvatar,
  validateProfileAvatar,
} from './profileAvatar';

describe('profileAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1234);
  });

  it('alinha tipo e limite estrito com as regras de Storage', () => {
    expect(validateProfileAvatar(new File(['ok'], 'avatar.png', { type: 'image/png' }))).toBeNull();
    expect(validateProfileAvatar(new File(['svg'], 'avatar.svg', { type: 'image/svg+xml' })))
      .toBe('invalid-type');
    expect(validateProfileAvatar(new File(['heic'], 'avatar.heic', { type: 'image/heic' })))
      .toBe('invalid-type');
    expect(validateProfileAvatar(new File(
      [new Uint8Array(PROFILE_AVATAR_MAX_BYTES)],
      'avatar.jpg',
      { type: 'image/jpeg' },
    ))).toBe('too-large');
  });

  it('usa o path canônico, retry com refresh e cache-busting', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const firebaseUser = { uid: 'user-1', getIdToken: vi.fn() } as never;

    const result = await uploadProfileAvatar(file, firebaseUser);

    expect(mockStorageRef).toHaveBeenCalledWith('storage', 'users/user-1/profile.jpg');
    expect(mockUploadWithRetry).toHaveBeenCalledWith(
      'profile-ref',
      file,
      expect.objectContaining({ refreshCredentials: expect.any(Function) }),
    );
    const retryOptions = mockUploadWithRetry.mock.calls[0][2] as {
      refreshCredentials: () => Promise<void>;
    };
    await retryOptions.refreshCredentials();
    expect(mockRefreshCredentials).toHaveBeenCalledWith(firebaseUser);
    expect(result).toBe('https://storage.example/profile.jpg?token=abc&v=1234');
  });

  it('mapeia erros de credencial e rede sem mascará-los como falha genérica', () => {
    expect(getProfileAvatarUploadErrorKey({ code: 'storage/unauthorized' }))
      .toBe('profile.avatarUploadUnauthorized');
    expect(getProfileAvatarUploadErrorKey({ code: 'storage/network-request-failed' }))
      .toBe('profile.avatarUploadNetworkError');
    expect(getProfileAvatarUploadErrorKey({ code: 'storage/canceled' }))
      .toBe('profile.avatarUploadCanceled');
  });
});
