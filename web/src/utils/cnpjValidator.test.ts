import { describe, expect, it } from 'vitest';
import { isValidCnpj, maskCnpj, formatCnpj, stripCnpj } from './cnpjValidator';

describe('isValidCnpj', () => {
  it('aceita CNPJs válidos formatados', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('12.345.678/0001-95')).toBe(true);
  });

  it('aceita CNPJs válidos sem máscara', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('12345678000195')).toBe(true);
  });

  it('aceita CNPJs válidos com zeros à esquerda', () => {
    expect(isValidCnpj('00.000.000/0001-91')).toBe(true);
    expect(isValidCnpj('00000000000191')).toBe(true);
  });

  it('rejeita CNPJs com dígito verificador errado', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('12.345.678/0001-00')).toBe(false);
  });

  it('rejeita sequências (todos dígitos iguais)', () => {
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
    expect(isValidCnpj('99999999999999')).toBe(false);
  });

  it('rejeita strings vazias e null', () => {
    expect(isValidCnpj('')).toBe(false);
    expect(isValidCnpj(null as unknown as string)).toBe(false);
    expect(isValidCnpj(undefined as unknown as string)).toBe(false);
  });

  it('rejeita strings só com whitespace', () => {
    expect(isValidCnpj('   ')).toBe(false);
    expect(isValidCnpj('\t\n ')).toBe(false);
  });

  it('rejeita inputs non-string sem crashar', () => {
    expect(isValidCnpj(11222333000181 as unknown as string)).toBe(false);
    expect(isValidCnpj({} as unknown as string)).toBe(false);
  });

  it('rejeita CNPJs com tamanho errado', () => {
    expect(isValidCnpj('123')).toBe(false);
    expect(isValidCnpj('112223330001811')).toBe(false);
    expect(isValidCnpj('11144477735')).toBe(false); // CPF válido não é CNPJ
  });

  it('ignora caracteres não-dígito ao validar', () => {
    expect(isValidCnpj('11-222-333.0001/81')).toBe(true);
    expect(isValidCnpj('11 222 333 0001 81')).toBe(true);
  });
});

describe('maskCnpj', () => {
  it('mascara mostrando apenas os 4 dígitos da filial', () => {
    expect(maskCnpj('11222333000181')).toBe('**.***.***/0001-**');
    expect(maskCnpj('12.345.678/0002-76')).toBe('**.***.***/0002-**');
  });

  it('retorna "***" para CNPJ inválido (curto demais)', () => {
    // maskCnpj sempre mascara — retorna '***' para entradas inválidas
    // (não 14 dígitos) para não vazar dados parciais (LGPD).
    expect(maskCnpj('123')).toBe('***');
  });
});

describe('formatCnpj', () => {
  it('formata CNPJ puro completo para exibição', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('reformata CNPJ já mascarado', () => {
    expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
  });

  it('aplica máscara progressiva em input parcial', () => {
    expect(formatCnpj('')).toBe('');
    expect(formatCnpj('1')).toBe('1');
    expect(formatCnpj('11')).toBe('11');
    expect(formatCnpj('112')).toBe('11.2');
    expect(formatCnpj('11222')).toBe('11.222');
    expect(formatCnpj('112223')).toBe('11.222.3');
    expect(formatCnpj('11222333')).toBe('11.222.333');
    expect(formatCnpj('112223330')).toBe('11.222.333/0');
    expect(formatCnpj('112223330001')).toBe('11.222.333/0001');
    expect(formatCnpj('1122233300018')).toBe('11.222.333/0001-8');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('trunca dígitos excedentes além de 14', () => {
    expect(formatCnpj('112223330001819999')).toBe('11.222.333/0001-81');
  });
});

describe('stripCnpj', () => {
  it('remove máscara', () => {
    expect(stripCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(stripCnpj('11-222-333.0001/81')).toBe('11222333000181');
  });
});
