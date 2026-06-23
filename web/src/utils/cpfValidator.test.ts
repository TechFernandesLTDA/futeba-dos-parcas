import { describe, expect, it } from 'vitest';
import { isValidCpf, maskCpf, formatCpf, stripCpf } from './cpfValidator';

describe('isValidCpf', () => {
  it('aceita CPFs válidos formatados', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(isValidCpf('123.456.789-09')).toBe(true);
  });

  it('aceita CPFs válidos sem máscara', () => {
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('12345678909')).toBe(true);
  });

  it('aceita CPFs válidos com zero à esquerda', () => {
    expect(isValidCpf('00000000191')).toBe(true);
    expect(isValidCpf('000.000.001-91')).toBe(true);
  });

  it('rejeita CPFs com dígito verificador errado', () => {
    expect(isValidCpf('111.444.777-36')).toBe(false);
    expect(isValidCpf('123.456.789-00')).toBe(false);
  });

  it('rejeita sequências (todos dígitos iguais)', () => {
    expect(isValidCpf('000.000.000-00')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('999.999.999-99')).toBe(false);
  });

  it('rejeita strings vazias e null', () => {
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf(null as unknown as string)).toBe(false);
    expect(isValidCpf(undefined as unknown as string)).toBe(false);
  });

  it('rejeita strings só com whitespace (paridade com CpfValidatorTest.kt:40)', () => {
    expect(isValidCpf('   ')).toBe(false);
    expect(isValidCpf('\t\n ')).toBe(false);
  });

  it('rejeita inputs non-string sem crashar (#1310 L3)', () => {
    expect(isValidCpf(12345678909 as unknown as string)).toBe(false);
    expect(isValidCpf({} as unknown as string)).toBe(false);
  });

  it('rejeita CPFs com tamanho errado', () => {
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('123456789012')).toBe(false);
  });

  it('ignora caracteres não-dígito ao validar', () => {
    expect(isValidCpf('111-444-777.35')).toBe(true);
    expect(isValidCpf('111 444 777 35')).toBe(true);
  });
});

describe('maskCpf', () => {
  it('mascara mostrando apenas 6 dígitos centrais', () => {
    expect(maskCpf('11144477735')).toBe('***.444.777-**');
    expect(maskCpf('123.456.789-09')).toBe('***.456.789-**');
  });

  it('retorna "***" para CPF inválido (curto demais)', () => {
    // maskCpf sempre mascara — retorna '***' para entradas inválidas (não 11 dígitos)
    // para não vazar dados parciais (LGPD). #2330 fix de expectativa errada.
    expect(maskCpf('123')).toBe('***');
  });
});

describe('formatCpf', () => {
  it('formata CPF puro para exibição', () => {
    expect(formatCpf('11144477735')).toBe('111.444.777-35');
  });

  it('reformata CPF já mascarado', () => {
    expect(formatCpf('111.444.777-35')).toBe('111.444.777-35');
  });
});

describe('stripCpf', () => {
  it('remove máscara', () => {
    expect(stripCpf('111.444.777-35')).toBe('11144477735');
    expect(stripCpf('111-444-777.35')).toBe('11144477735');
  });
});
