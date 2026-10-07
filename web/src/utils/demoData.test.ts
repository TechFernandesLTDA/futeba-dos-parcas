import { describe, expect, it } from 'vitest';
import { getDemoDataLabel, isDemoData, type DemoDataLike } from './demoData';

describe('demoData', () => {
  describe('isDemoData', () => {
    it.each([
      ['undefined', undefined, false],
      ['null', null, false],
      ['objeto vazio', {}, false],
      ['demoData true', { demoData: true }, true],
      ['demoData false', { demoData: false }, false],
      ['isMock true', { isMock: true }, true],
      ['isMock false', { isMock: false }, false],
      ["dataOrigin 'DEMO'", { dataOrigin: 'DEMO' }, true],
      ["dataOrigin 'TEST'", { dataOrigin: 'TEST' }, true],
      ["dataOrigin 'PROD'", { dataOrigin: 'PROD' }, false],
      ["dataOrigin 'demo' (case-sensitive)", { dataOrigin: 'demo' }, false],
      ['seedId preenchido', { seedId: 'seed-1' }, true],
      ['seedId vazio', { seedId: '' }, false],
      ['seedId null', { seedId: null }, false],
      ['todos os marcadores falsos', { demoData: false, isMock: false, dataOrigin: null, seedId: null }, false],
    ])('%s → %p', (_name, value, expected) => {
      expect(isDemoData(value as DemoDataLike)).toBe(expected);
    });

    it('qualquer marcador verdadeiro basta (OR)', () => {
      expect(isDemoData({ demoData: true })).toBe(true);
      expect(isDemoData({ isMock: true, dataOrigin: 'PROD' })).toBe(true);
      expect(isDemoData({ dataOrigin: 'DEMO', demoData: false })).toBe(true);
    });
  });

  describe('getDemoDataLabel', () => {
    it('retorna string vazia para não-demo', () => {
      expect(getDemoDataLabel(undefined)).toBe('');
      expect(getDemoDataLabel(null)).toBe('');
      expect(getDemoDataLabel({})).toBe('');
      expect(getDemoDataLabel({ demoData: true })).not.toBe('');
    });

    it("retorna 'Teste' quando dataOrigin é TEST", () => {
      expect(getDemoDataLabel({ dataOrigin: 'TEST' })).toBe('Teste');
    });

    it("retorna 'Teste' mesmo com outros marcadores demo ativos", () => {
      expect(getDemoDataLabel({ demoData: true, dataOrigin: 'TEST' })).toBe('Teste');
    });

    it("retorna 'Fictício' para os demais marcadores demo", () => {
      expect(getDemoDataLabel({ demoData: true })).toBe('Fictício');
      expect(getDemoDataLabel({ isMock: true })).toBe('Fictício');
      expect(getDemoDataLabel({ dataOrigin: 'DEMO' })).toBe('Fictício');
      expect(getDemoDataLabel({ seedId: 's-1' })).toBe('Fictício');
    });
  });
});
