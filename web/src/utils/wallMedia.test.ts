import { describe, expect, it } from 'vitest';
import {
  getWallMediaType,
  isWallPostVideo,
  isWallVideoFile,
} from './wallMedia';

describe('wallMedia', () => {
  it('normaliza MP4 com MIME vazio, genérico ou QuickTime', () => {
    for (const type of ['', 'application/octet-stream', 'video/quicktime']) {
      const file = new File(['video'], 'partida.MP4', { type });
      expect(getWallMediaType(file)).toBe('video/mp4');
      expect(isWallVideoFile(file)).toBe(true);
    }
  });

  it('não aceita extensão MP4 com MIME incompatível', () => {
    expect(getWallMediaType(new File(['x'], 'ataque.mp4', { type: 'text/plain' }))).toBeNull();
  });

  it('reconhece posts legados pela URL ou path', () => {
    expect(isWallPostVideo(null, 'https://cdn.test/clip.mp4?token=1', null)).toBe(true);
    expect(isWallPostVideo(null, null, 'groups/g/wall_media/clip.mp4')).toBe(true);
    expect(isWallPostVideo('image/jpeg', 'https://cdn.test/photo.jpg', null)).toBe(false);
  });
});

