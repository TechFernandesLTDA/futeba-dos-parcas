import { describe, it, expect } from 'vitest';
import { compareVersions, isNewerVersion } from './semver';

describe('semver', () => {
  describe('compareVersions', () => {
    it('versões iguais retornam 0', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('major maior retorna positivo', () => {
      expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    });

    it('minor maior retorna positivo', () => {
      expect(compareVersions('1.3.0', '1.2.9')).toBeGreaterThan(0);
    });

    it('patch menor retorna negativo', () => {
      expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0);
    });

    it('componentes ausentes contam como 0 (1.2 == 1.2.0)', () => {
      expect(compareVersions('1.2', '1.2.0')).toBe(0);
    });

    it('prefixo v é ignorado', () => {
      expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    });

    it('sufixo de pré-release é ignorado', () => {
      expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(0);
    });

    it('sufixo de build é ignorado', () => {
      expect(compareVersions('1.2.3+42', '1.2.3')).toBe(0);
    });

    it('string vazia conta como 0.0.0', () => {
      expect(compareVersions('1.0.0', '')).toBeGreaterThan(0);
    });

    it('componentes não numéricos contam como 0 (degradação segura)', () => {
      expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
    });
  });

  describe('isNewerVersion', () => {
    it('true quando a é estritamente mais nova', () => {
      expect(isNewerVersion('1.26.0', '1.25.0')).toBe(true);
    });

    it('false quando as versões são iguais', () => {
      expect(isNewerVersion('1.26.0', '1.26.0')).toBe(false);
    });

    it('false quando a é mais antiga', () => {
      expect(isNewerVersion('1.25.0', '1.26.0')).toBe(false);
    });
  });
});
