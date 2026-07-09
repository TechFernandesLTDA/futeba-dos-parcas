import { describe, expect, it } from 'vitest';
import {
  cashboxAmountToCents,
  centsToCashboxAmount,
  formatCashboxAmountInput,
  normalizeCashboxAmount,
  parseCashboxAmount,
  parseCashboxAmountToCents,
} from './cashboxAmount';

describe('parseCashboxAmount', () => {
  it('aceita valor decimal no formato pt-BR', () => {
    expect(parseCashboxAmount('12,50')).toBe(12.5);
    expect(parseCashboxAmountToCents('12,50')).toBe(1250);
  });

  it('aceita valor decimal com ponto', () => {
    expect(parseCashboxAmount('12.50')).toBe(12.5);
    expect(parseCashboxAmountToCents('12.50')).toBe(1250);
  });

  it('rejeita valor vazio', () => {
    expect(parseCashboxAmount('')).toBeNull();
    expect(parseCashboxAmount('   ')).toBeNull();
    expect(parseCashboxAmountToCents('')).toBeNull();
  });

  it('rejeita valor negativo', () => {
    expect(parseCashboxAmount('-12,50')).toBeNull();
    expect(parseCashboxAmountToCents('-12,50')).toBeNull();
  });

  it('normaliza valor para exibição pt-BR', () => {
    expect(formatCashboxAmountInput(12.5)).toBe('12,50');
  });

  it('converte floats legados em centavos sem perder precisão no saldo', () => {
    expect(cashboxAmountToCents(0.1 + 0.2)).toBe(30);
    expect(centsToCashboxAmount(30)).toBe(0.3);
    expect(normalizeCashboxAmount(10.105)).toBe(10.11);
  });
});
