import { describe, expect, it } from 'vitest';
import { resolveExpectedPayment } from './gamePayment';

describe('resolveExpectedPayment', () => {
  it('usa totalCost dividido por maxPlayers em jogos com preço automático', () => {
    expect(resolveExpectedPayment({
      totalCost: 525,
      maxPlayers: 14,
      dailyPrice: 21,
      priceManualOverride: false,
    })).toBe(37.5);
  });

  it('trata jogos legados sem flag manual como preço automático', () => {
    expect(resolveExpectedPayment({
      totalCost: 525,
      maxPlayers: 14,
      dailyPrice: 21,
    })).toBe(37.5);
  });

  it('preserva dailyPrice quando o jogo foi salvo com preço manual', () => {
    expect(resolveExpectedPayment({
      totalCost: 525,
      maxPlayers: 14,
      dailyPrice: 21,
      priceManualOverride: true,
    })).toBe(21);
  });
});
