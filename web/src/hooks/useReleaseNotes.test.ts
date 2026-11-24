import { describe, it, expect, vi } from 'vitest';

// Evita inicializar o Firebase real ao importar a cadeia de serviços.
vi.mock('../services/firebase', () => ({ db: {} }));

import { decideWhatsNewPopup } from './useReleaseNotes';
import { ReleaseNote } from '../types/releaseNotes';

function note(version: string, showPopup = false): ReleaseNote {
  return {
    platform: 'web',
    version,
    buildNumber: null,
    releaseDate: 0,
    type: 'minor',
    headline: `Headline ${version}`,
    highlights: [],
    added: [],
    improved: [],
    fixed: [],
    issueRefs: [],
    showPopup,
  };
}

describe('decideWhatsNewPopup', () => {
  it('retorna a nota de pop-up quando há uma não vista', () => {
    const result = decideWhatsNewPopup([note('1.26.0', true)], '1.25.0', '1.26.0');
    expect(result?.version).toBe('1.26.0');
  });

  it('retorna null quando a nota não tem showPopup', () => {
    expect(decideWhatsNewPopup([note('1.26.0', false)], '1.25.0', '1.26.0')).toBeNull();
  });

  it('retorna null quando a versão já foi vista', () => {
    expect(decideWhatsNewPopup([note('1.26.0', true)], '1.26.0', '1.26.0')).toBeNull();
  });

  it('não anuncia versão mais nova que a instalada', () => {
    expect(decideWhatsNewPopup([note('1.27.0', true)], '1.25.0', '1.26.0')).toBeNull();
  });

  it('retorna null para lista vazia', () => {
    expect(decideWhatsNewPopup([], '1.25.0', '1.26.0')).toBeNull();
  });

  it('mostra pop-up em fresh install (lastSeen vazio)', () => {
    const result = decideWhatsNewPopup([note('1.26.0', true)], '', '1.26.0');
    expect(result?.version).toBe('1.26.0');
  });

  it('primeira visita não mostra nota antiga quando a atual não tem pop-up (#4613)', () => {
    const notes = [note('1.64.0', false), note('1.63.0', false), note('1.60.0', true)];
    expect(decideWhatsNewPopup(notes, '', '1.64.0')).toBeNull();
  });

  it('primeira visita ignora nota mais nova que a versão atual', () => {
    const notes = [note('1.65.0', true), note('1.64.0', true)];
    expect(decideWhatsNewPopup(notes, '', '1.64.0')?.version).toBe('1.64.0');
  });

  it('atualização ainda mostra nota não vista de versão pulada', () => {
    const notes = [note('1.64.0', false), note('1.60.0', true)];
    expect(decideWhatsNewPopup(notes, '1.59.0', '1.64.0')?.version).toBe('1.60.0');
  });

  it('escolhe a nota de pop-up mais recente entre várias', () => {
    const notes = [note('1.24.0', true), note('1.26.0', true), note('1.25.0', true)];
    const result = decideWhatsNewPopup(notes, '1.23.0', '1.26.0');
    expect(result?.version).toBe('1.26.0');
  });
});
