import { describe, expect, it } from 'vitest';
import { mapCpfVerificationFailureReason } from './onboardingSecurity';

describe('onboardingSecurity', () => {
  describe('mapCpfVerificationFailureReason', () => {
    it.each([
      ['functions/already-exists', 'duplicate_cpf'],
      ['functions/invalid-argument', 'invalid_cpf'],
      ['functions/resource-exhausted', 'rate_limited'],
      ['app/cpf-verification-failed', 'invalid_cpf'],
    ] as const)('mapeia "%s" para "%s"', (code, expected) => {
      expect(mapCpfVerificationFailureReason(code)).toBe(expected);
    });

    it('retorna invalid_format quando o código é undefined', () => {
      expect(mapCpfVerificationFailureReason()).toBe('invalid_format');
    });

    it('retorna invalid_format para código desconhecido', () => {
      expect(mapCpfVerificationFailureReason('functions/unavailable')).toBe('invalid_format');
      expect(mapCpfVerificationFailureReason('')).toBe('invalid_format');
      expect(mapCpfVerificationFailureReason('duplicate_cpf')).toBe('invalid_format');
    });

    it('é sensível a maiúsculas/case (não normaliza)', () => {
      expect(mapCpfVerificationFailureReason('FUNCTIONS/ALREADY-EXISTS')).toBe('invalid_format');
    });

    it('retorna apenas motivos do enum VerificationFailureReason', () => {
      const valid: string[] = [
        'invalid_format',
        'invalid_cpf',
        'duplicate_cpf',
        'duplicate_phone',
        'rate_limited',
        'code_expired',
        'code_incorrect',
      ];
      const inputs = [
        'functions/already-exists',
        'functions/invalid-argument',
        'functions/resource-exhausted',
        'app/cpf-verification-failed',
        undefined,
        'x',
      ];
      for (const input of inputs) {
        expect(valid).toContain(mapCpfVerificationFailureReason(input));
      }
    });

    it('distingue invalid_cpf (CPF recusado) de invalid_format (entrada malformada)', () => {
      expect(mapCpfVerificationFailureReason('app/cpf-verification-failed')).toBe('invalid_cpf');
      expect(mapCpfVerificationFailureReason('qualquer-coisa')).toBe('invalid_format');
    });
  });
});
