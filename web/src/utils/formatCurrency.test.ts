import { describe, expect, it } from 'vitest';
import { formatBRL } from './formatCurrency';

describe('formatBRL', () => {
  it('usa vírgula decimal, não ponto', () => {
    expect(formatBRL(15.71)).toMatch(/^R\$\s15,71$/);
  });

  it('separa milhar com ponto', () => {
    expect(formatBRL(1234.5)).toMatch(/^R\$\s1\.234,50$/);
  });

  it('trata valor inválido como zero', () => {
    expect(formatBRL(Number.NaN)).toMatch(/^R\$\s0,00$/);
  });
});
