import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose?: string;
}

const publicDir = resolve(process.cwd(), 'public');
const manifest = JSON.parse(
  readFileSync(resolve(publicDir, 'manifest.json'), 'utf8'),
) as { icons: ManifestIcon[]; orientation?: string };

function readPngMetadata(src: string) {
  const png = readFileSync(resolve(publicDir, src.replace(/^\//, '')));
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25],
  };
}

describe('PWA manifest assets', () => {
  it('mantém ícones any e maskable nos tamanhos exigidos', () => {
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ src: '/icons/icon-192-maskable.png', sizes: '192x192', purpose: 'maskable' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ src: '/icons/icon-512-maskable.png', sizes: '512x512', purpose: 'maskable' }),
    ]));
    for (const icon of manifest.icons) {
      expect(existsSync(resolve(publicDir, icon.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('usa assets opacos para Apple e máscaras do sistema', () => {
    const required = [
      ['/icons/apple-touch-icon.png', 180],
      ['/icons/icon-192-maskable.png', 192],
      ['/icons/icon-512-maskable.png', 512],
    ] as const;
    for (const [src, size] of required) {
      const metadata = readPngMetadata(src);
      expect(metadata).toMatchObject({ width: size, height: size });
      expect([4, 6]).not.toContain(metadata.colorType);
    }
  });

  it('não bloqueia celulares e tablets em modo retrato ou paisagem', () => {
    expect(manifest.orientation).toBeUndefined();
  });
});
