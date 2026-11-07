import { describe, expect, it } from 'vitest';
import { chunkNameFor } from '../vite/chunkGroups';
import { RE2JS } from './utils/re2jsShim';

describe('bundle chunkGroups & re2jsShim (Onda F)', () => {
  it('separa en.json e es.json do chunk de boot i18n-locales (pt-BR)', () => {
    expect(chunkNameFor('/repo/web/src/i18n/locales/pt-BR.json')).toBe('i18n-locales');
    expect(chunkNameFor('/repo/web/src/i18n/locales/en.json')).toBe('i18n-en');
    expect(chunkNameFor('/repo/web/src/i18n/locales/es.json')).toBe('i18n-es');
  });

  it('isola serviços frios do Firebase em chunks próprios', () => {
    expect(chunkNameFor('/repo/web/node_modules/@firebase/functions/dist/index.esm.js')).toBe(
      'vendor-firebase-functions',
    );
    expect(chunkNameFor('/repo/web/node_modules/@firebase/storage/dist/index.esm.js')).toBe(
      'vendor-firebase-storage',
    );
    expect(chunkNameFor('/repo/web/node_modules/@firebase/messaging/dist/index.esm.js')).toBe(
      'vendor-firebase-messaging',
    );
    expect(chunkNameFor('/repo/web/node_modules/@firebase/analytics/dist/index.esm.js')).toBe(
      'vendor-firebase-analytics',
    );
    expect(chunkNameFor('/repo/web/node_modules/@firebase/firestore/dist/index.esm.js')).toBe(
      'vendor-firebase',
    );
  });

  it('mantém ícones do shell inicial fora de vendor-mui-icons e ícones de rotas internas em vendor-mui-icons', () => {
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/icons-material/esm/SportsSoccer.js'),
    ).toBe('vendor-mui');
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/icons-material/esm/utils/createSvgIcon.js'),
    ).toBe('vendor-mui');
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/icons-material/esm/EmojiPeople.js'),
    ).toBe('vendor-mui-icons');
  });

  it('separa componentes MUI pesados de rotas internas em vendor-mui-extra', () => {
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/material/Autocomplete/Autocomplete.js'),
    ).toBe('vendor-mui-extra');
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/material/TextField/TextField.js'),
    ).toBe('vendor-mui-extra');
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/material/InputBase/utils.js'),
    ).toBe('vendor-mui');
    expect(
      chunkNameFor('/repo/web/node_modules/@mui/material/Box/Box.js'),
    ).toBe('vendor-mui');
  });

  it('shim RE2JS suporta compile, test e matches de string inteira', () => {
    const pattern = RE2JS.compile('futeba-[0-9]+');
    expect(pattern.test('meu futeba-123 aqui')).toBe(true);
    expect(pattern.matches('meu futeba-123 aqui')).toBe(false);
    expect(pattern.matches('futeba-123')).toBe(true);

    const caseInsensitive = RE2JS.compile('parcas', 1);
    expect(caseInsensitive.matches('PARCAS')).toBe(true);
  });
});
