import { describe, expect, it } from 'vitest';
import {
  isSupportedLocationImage,
  isSupportedStorageImage,
  LOCATION_IMAGE_ACCEPT,
  STORAGE_IMAGE_ACCEPT,
  STORAGE_IMAGE_MIME_TYPES,
} from './storageImage';

describe('storageImage', () => {
  it.each(STORAGE_IMAGE_MIME_TYPES)('aceita o formato permitido %s', (contentType) => {
    expect(isSupportedStorageImage({ type: contentType })).toBe(true);
  });

  it.each(['image/heic', 'image/avif', 'image/svg+xml', 'text/html', ''])(
    'recusa o formato não permitido %s antes do upload',
    (contentType) => {
      expect(isSupportedStorageImage({ type: contentType })).toBe(false);
    },
  );

  it('expõe um accept de input alinhado à whitelist', () => {
    expect(STORAGE_IMAGE_ACCEPT).toBe('image/jpeg,image/png,image/webp,image/gif');
  });

  it('restringe fotos de locais às extensões aceitas nos paths públicos', () => {
    expect(isSupportedLocationImage({ type: 'image/jpeg' })).toBe(true);
    expect(isSupportedLocationImage({ type: 'image/png' })).toBe(true);
    expect(isSupportedLocationImage({ type: 'image/webp' })).toBe(true);
    expect(isSupportedLocationImage({ type: 'image/gif' })).toBe(false);
    expect(LOCATION_IMAGE_ACCEPT).toBe('image/jpeg,image/png,image/webp');
  });
});
