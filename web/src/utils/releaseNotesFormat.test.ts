import { describe, expect, it } from 'vitest';
import { formatReleaseDate } from './releaseNotesFormat';

// 2026-05-22 12:00:00 UTC (evita virar dia em fusos negativos/positivos)
const EPOCH = Date.UTC(2026, 4, 22, 12, 0, 0);

describe('releaseNotesFormat', () => {
  describe('formatReleaseDate', () => {
    it('formata epoch válido em pt-BR (mês por extenso)', () => {
      expect(formatReleaseDate(EPOCH, 'pt-BR')).toBe('22 de maio de 2026');
    });

    it('formata epoch válido em en-US', () => {
      expect(formatReleaseDate(EPOCH, 'en-US')).toBe('May 22, 2026');
    });

    it('usa pt-BR quando locale é vazio', () => {
      expect(formatReleaseDate(EPOCH, '')).toBe('22 de maio de 2026');
    });

    it('é determinística quanto ao fuso do host (timeZone UTC)', () => {
      // Qualquer que seja o TZ do processo, o dia formatado é 22
      const result = formatReleaseDate(EPOCH, 'en-US');
      expect(result).toContain('22');
      expect(result).toContain('2026');
    });

    it('retorna vazio para epoch 0', () => {
      expect(formatReleaseDate(0, 'pt-BR')).toBe('');
    });

    it('retorna vazio para epoch negativo', () => {
      expect(formatReleaseDate(-1, 'pt-BR')).toBe('');
      expect(formatReleaseDate(-8_640_000_000_000, 'pt-BR')).toBe('');
    });

    it('retorna vazio para NaN', () => {
      expect(formatReleaseDate(NaN, 'pt-BR')).toBe('');
    });

    it('retorna vazio para locale inválido (Intl lança RangeError)', () => {
      expect(formatReleaseDate(EPOCH, 'locale-invalido-@@')).toBe('');
    });

    it('formata corretamente em outro dia/mês (1º de janeiro)', () => {
      const firstJan = Date.UTC(2025, 0, 1, 12, 0, 0);
      expect(formatReleaseDate(firstJan, 'pt-BR')).toBe('1 de janeiro de 2025');
    });

    it('aceita locale com país completo (pt-BR vs pt)', () => {
      // Ambos os locales devem produzir o dia "22" e o ano "2026"
      for (const locale of ['pt', 'pt-PT', 'pt-BR']) {
        const result = formatReleaseDate(EPOCH, locale);
        expect(result).toContain('22');
        expect(result).toContain('2026');
      }
    });
  });
});
