import { describe, expect, it } from 'vitest';
import { PAYMENT_STATUS_CONFIG } from './game';
import { rarityLabel } from '../utils/rarityLabel';

describe('selo de pagamento na lista do jogo', () => {
  it('diz que o pendente é o pagamento, não a presença', () => {
    expect(PAYMENT_STATUS_CONFIG.PENDING.label).toBe('Pagamento pendente');
    expect(PAYMENT_STATUS_CONFIG.PARTIAL.label).toBe('Pagamento parcial');
    expect(PAYMENT_STATUS_CONFIG.PAID.label).toBe('Pago');
  });
});

describe('rarityLabel', () => {
  it('mostra a raridade com acento', () => {
    expect(rarityLabel('EPICO')).toBe('Épico');
    expect(rarityLabel('LENDARIO')).toBe('Lendário');
    expect(rarityLabel('RARO')).toBe('Raro');
    expect(rarityLabel('comum')).toBe('Comum');
  });

  it('sem raridade, usa Comum; valor desconhecido passa como veio', () => {
    expect(rarityLabel(undefined)).toBe('Comum');
    expect(rarityLabel('MITICO')).toBe('MITICO');
  });
});
