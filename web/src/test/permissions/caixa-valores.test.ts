/**
 * Valores lançados no caixa (cashbox): validação e conversão para centavos.
 *
 * A regra de saldo (despesa maior que o saldo é bloqueada) fica no CashboxScreen,
 * que depende de render; aqui ficam as funções puras que decidem se o valor é válido.
 */
import { describe, expect, it } from 'vitest';
import {
  centsToCashboxAmount,
  cashboxAmountToCents,
  normalizeCashboxAmount,
  parseCashboxAmount,
  parseCashboxAmountToCents,
} from '../../utils/cashboxAmount';

describe('parseCashboxAmountToCents: valor digitado em pt-BR vira centavos', () => {
  it('inteiro "10" vira 1000 centavos', () => {
    expect(parseCashboxAmountToCents('10')).toBe(1000);
  });

  it('vírgula decimal "10,5" vira 1050 centavos', () => {
    expect(parseCashboxAmountToCents('10,5')).toBe(1050);
  });

  it('separador de milhar com vírgula decimal "1.234,56" vira 123456 centavos', () => {
    expect(parseCashboxAmountToCents('1.234,56')).toBe(123456);
  });

  it('centavos "0,50" são aceitos (50 centavos)', () => {
    expect(parseCashboxAmountToCents('0,50')).toBe(50);
  });

  it('zero NÃO é lançamento válido', () => {
    expect(parseCashboxAmountToCents('0')).toBeNull();
  });

  it('valor negativo é recusado (estorno passa por outro fluxo)', () => {
    expect(parseCashboxAmountToCents('-5')).toBeNull();
  });

  it('texto e vazio são recusados', () => {
    expect(parseCashboxAmountToCents('abc')).toBeNull();
    expect(parseCashboxAmountToCents('   ')).toBeNull();
  });

  it('mais de duas casas decimais é recusado', () => {
    expect(parseCashboxAmountToCents('12,345')).toBeNull();
  });
});

describe('parseCashboxAmount: valor em reais a partir do texto', () => {
  it('"10,50" vira 10.5 reais', () => {
    expect(parseCashboxAmount('10,50')).toBe(10.5);
  });

  it('texto inválido vira null', () => {
    expect(parseCashboxAmount('x')).toBeNull();
  });
});

describe('cashboxAmountToCents: conversão de número para centavos', () => {
  it('12.34 reais vira 1234 centavos sem erro de ponto flutuante', () => {
    expect(cashboxAmountToCents(12.34)).toBe(1234);
  });

  it('valor que não é número finito (NaN, string) vira 0', () => {
    expect(cashboxAmountToCents(Number.NaN)).toBe(0);
    expect(cashboxAmountToCents('10')).toBe(0);
  });
});

describe('centsToCashboxAmount e normalizeCashboxAmount', () => {
  it('1234 centavos vira 12.34 reais', () => {
    expect(centsToCashboxAmount(1234)).toBe(12.34);
  });

  it('normalizeCashboxAmount trata valor não finito como 0', () => {
    expect(normalizeCashboxAmount(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
