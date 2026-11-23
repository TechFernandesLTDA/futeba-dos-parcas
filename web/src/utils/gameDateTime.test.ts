import { describe, it, expect } from 'vitest';
import { gameDateTimeFromLocal } from './gameDateTime';

describe('gameDateTimeFromLocal', () => {
  it('monta o instante na hora local a partir de date e time', () => {
    expect(gameDateTimeFromLocal('2026-03-20', '19:30')).toEqual(new Date(2026, 2, 20, 19, 30));
  });

  it('aceita hora com segundos e sem zero à esquerda', () => {
    expect(gameDateTimeFromLocal('2026-03-20', '7:05:00')).toEqual(new Date(2026, 2, 20, 7, 5));
  });

  it('sem hora usa meia-noite', () => {
    expect(gameDateTimeFromLocal('2026-03-20', '')).toEqual(new Date(2026, 2, 20, 0, 0));
  });

  it('devolve null para data ausente, em outro formato ou inexistente', () => {
    expect(gameDateTimeFromLocal(undefined, '19:00')).toBeNull();
    expect(gameDateTimeFromLocal('20/03/2026', '19:00')).toBeNull();
    expect(gameDateTimeFromLocal('2026-02-31', '19:00')).toBeNull();
  });

  it('devolve null para hora inválida', () => {
    expect(gameDateTimeFromLocal('2026-03-20', '25:00')).toBeNull();
    expect(gameDateTimeFromLocal('2026-03-20', 'noite')).toBeNull();
  });
});
