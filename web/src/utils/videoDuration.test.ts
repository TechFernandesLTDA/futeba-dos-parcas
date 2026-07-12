// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readVideoDuration } from './videoDuration';

interface FakeVideo {
  preload: string;
  src: string;
  duration: number;
  onloadedmetadata: ((this: FakeVideo) => void) | null;
  onerror: ((this: FakeVideo) => void) | null;
}

function createFakeVideo(): FakeVideo {
  return {
    preload: 'metadata',
    src: '',
    duration: NaN,
    onloadedmetadata: null,
    onerror: null,
  };
}

describe('readVideoDuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolve a duracao quando loadedmetadata dispara com valor valido', async () => {
    const fake = createFakeVideo();
    vi.spyOn(document, 'createElement').mockReturnValue(fake as unknown as HTMLVideoElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const promise = readVideoDuration(new File([], 'clip.mp4', { type: 'video/mp4' }), 4000);
    fake.duration = 22;
    fake.onloadedmetadata?.call(fake);
    const result = await promise;

    expect(result).toBe(22);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it('resolve null quando o metadata nao esta disponivel (onerror)', async () => {
    const fake = createFakeVideo();
    vi.spyOn(document, 'createElement').mockReturnValue(fake as unknown as HTMLVideoElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const promise = readVideoDuration(new File([], 'clip.mp4', { type: 'video/mp4' }), 4000);
    fake.onerror?.call(fake);
    const result = await promise;

    expect(result).toBeNull();
  });

  it('resolve null quando a duracao nao e finita', async () => {
    const fake = createFakeVideo();
    vi.spyOn(document, 'createElement').mockReturnValue(fake as unknown as HTMLVideoElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const promise = readVideoDuration(new File([], 'clip.mp4', { type: 'video/mp4' }), 4000);
    fake.duration = Infinity;
    fake.onloadedmetadata?.call(fake);
    const result = await promise;

    expect(result).toBeNull();
  });
});
