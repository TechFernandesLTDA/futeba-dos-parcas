import { describe, expect, it } from 'vitest';
import { formatCashboxAmountInput, parseCashboxAmount } from './cashboxAmount';

describe('parseCashboxAmount', () => {
  it('aceita valor decimal no formato pt-BR', () => {
    expect(parseCashboxAmount('12,50')).toBe(12.5);
  });

  it('aceita valor decimal com ponto', () => {
    expect(parseCashboxAmount('12.50')).toBe(12.5);
  });

  it('rejeita valor vazio', () => {
    expect(parseCashboxAmount('')).toBeNull();
    expect(parseCashboxAmount('   ')).toBeNull();
  });

  it('rejeita valor negativo', () => {
    expect(parseCashboxAmount('-12,50')).toBeNull();
  });

  it('normaliza valor para exibição pt-BR', () => {
    expect(formatCashboxAmountInput(12.5)).toBe('12,50');
  });
});
