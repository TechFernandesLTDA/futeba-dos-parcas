import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GAME_DURATION_MINUTES,
  normalizeHourlyPriceForGame,
  getGameDurationMinutes,
  formatGameDurationLabel,
  calculateFieldRentalCost,
  calculatePerPlayerPrice,
  resolveGamePricingForSave,
} from './gamePricing';

describe('DEFAULT_GAME_DURATION_MINUTES', () => {
  it('é 60 minutos', () => {
    expect(DEFAULT_GAME_DURATION_MINUTES).toBe(60);
  });
});

describe('normalizeHourlyPriceForGame', () => {
  it('retorna 0 para undefined', () => {
    expect(normalizeHourlyPriceForGame(undefined)).toBe(0);
  });

  it('retorna 0 para null', () => {
    expect(normalizeHourlyPriceForGame(null)).toBe(0);
  });

  it('retorna 0 para zero', () => {
    expect(normalizeHourlyPriceForGame(0)).toBe(0);
  });

  it('retorna 0 para valor negativo', () => {
    expect(normalizeHourlyPriceForGame(-50)).toBe(0);
  });

  it('retorna 0 para NaN', () => {
    expect(normalizeHourlyPriceForGame(NaN)).toBe(0);
  });

  it('retorna 0 para Infinity', () => {
    expect(normalizeHourlyPriceForGame(Infinity)).toBe(0);
  });

  it('mantém valor em reais abaixo de 1000', () => {
    expect(normalizeHourlyPriceForGame(80)).toBe(80);
  });

  it('mantém valores decimais abaixo de 1000', () => {
    expect(normalizeHourlyPriceForGame(99.9)).toBe(99.9);
  });

  it('converte centavos para reais quando >= 1000', () => {
    expect(normalizeHourlyPriceForGame(5000)).toBe(50);
  });

  it('converte exatamente 1000 centavos para 10 reais', () => {
    expect(normalizeHourlyPriceForGame(1000)).toBe(10);
  });
});

describe('getGameDurationMinutes', () => {
  it('retorna 60 quando startTime é vazio', () => {
    expect(getGameDurationMinutes('')).toBe(60);
  });

  it('retorna 60 quando endTime não informado', () => {
    expect(getGameDurationMinutes('19:00')).toBe(60);
  });

  it('calcula duração de 1 hora', () => {
    expect(getGameDurationMinutes('19:00', '20:00')).toBe(60);
  });

  it('calcula duração de 90 minutos', () => {
    expect(getGameDurationMinutes('19:00', '20:30')).toBe(90);
  });

  it('calcula duração atravessando horas simples', () => {
    expect(getGameDurationMinutes('09:15', '10:00')).toBe(45);
  });

  it('retorna 60 quando endTime é igual ao startTime', () => {
    expect(getGameDurationMinutes('19:00', '19:00')).toBe(60);
  });

  it('retorna 60 quando endTime é anterior ao startTime', () => {
    expect(getGameDurationMinutes('20:00', '19:00')).toBe(60);
  });

  it('retorna 60 quando startTime é inválido (não numérico)', () => {
    expect(getGameDurationMinutes('abc', '21:00')).toBe(60);
  });

  it('retorna 60 quando endTime é inválido (não numérico)', () => {
    expect(getGameDurationMinutes('19:00', 'xyz')).toBe(60);
  });
});

describe('formatGameDurationLabel', () => {
  it('formata apenas minutos', () => {
    expect(formatGameDurationLabel(45)).toBe('45min');
  });

  it('formata apenas horas cheias', () => {
    expect(formatGameDurationLabel(60)).toBe('1h');
  });

  it('formata horas e minutos com padStart', () => {
    expect(formatGameDurationLabel(90)).toBe('1h30');
  });

  it('formata 2 horas', () => {
    expect(formatGameDurationLabel(120)).toBe('2h');
  });

  it('formata múltiplo não redondo de horas (2h10)', () => {
    expect(formatGameDurationLabel(130)).toBe('2h10');
  });

  it('formata 0 como "0min"', () => {
    expect(formatGameDurationLabel(0)).toBe('0min');
  });
});

describe('calculateFieldRentalCost', () => {
  it('retorna 0 quando hourlyPrice é null', () => {
    expect(calculateFieldRentalCost(null, '19:00', '20:00')).toBe(0);
  });

  it('retorna 0 quando hourlyPrice é undefined', () => {
    expect(calculateFieldRentalCost(undefined, '19:00', '20:00')).toBe(0);
  });

  it('retorna 0 quando hourlyPrice é 0', () => {
    expect(calculateFieldRentalCost(0, '19:00', '20:00')).toBe(0);
  });

  it('calcula custo para 1h com preço em reais', () => {
    expect(calculateFieldRentalCost(80, '19:00', '20:00')).toBe(80);
  });

  it('calcula custo para 90 minutos (proporcional)', () => {
    expect(calculateFieldRentalCost(80, '19:00', '20:30')).toBe(120);
  });

  it('converte preço em centavos antes de calcular', () => {
    expect(calculateFieldRentalCost(8000, '19:00', '20:00')).toBe(80);
  });

  it('usa duração default de 60min quando endTime não informado', () => {
    expect(calculateFieldRentalCost(80, '19:00')).toBe(80);
  });

  it('usa duração default quando horários inválidos', () => {
    expect(calculateFieldRentalCost(80, 'abc', '20:00')).toBe(80);
  });

  it('arredonda para 2 casas decimais', () => {
    // 19.99 * 45/60 = 14.9925 → 14.99
    expect(calculateFieldRentalCost(19.99, '19:00', '19:45')).toBe(14.99);
  });
});

describe('calculatePerPlayerPrice', () => {
  it('divide custo total pelos jogadores', () => {
    expect(calculatePerPlayerPrice(150, 10)).toBe(15);
  });

  it('retorna 0 quando totalCost é 0', () => {
    expect(calculatePerPlayerPrice(0, 10)).toBe(0);
  });

  it('retorna 0 quando totalCost é negativo', () => {
    expect(calculatePerPlayerPrice(-100, 10)).toBe(0);
  });

  it('retorna 0 quando maxPlayers é 0', () => {
    expect(calculatePerPlayerPrice(150, 0)).toBe(0);
  });

  it('retorna 0 quando maxPlayers é negativo', () => {
    expect(calculatePerPlayerPrice(150, -5)).toBe(0);
  });

  it('arredonda para 2 casas decimais (divisão não exata)', () => {
    expect(calculatePerPlayerPrice(100, 3)).toBe(33.33);
  });
});

describe('resolveGamePricingForSave', () => {
  it('calcula dailyPrice a partir do total quando não há override', () => {
    const result = resolveGamePricingForSave({ totalCost: 150, maxPlayers: 10 });
    expect(result).toEqual({
      totalCost: 150,
      dailyPrice: 15,
      priceManualOverride: false,
    });
  });

  it('usa dailyPrice informado quando priceManualOverride é true', () => {
    const result = resolveGamePricingForSave({
      totalCost: 150,
      maxPlayers: 10,
      dailyPrice: 12,
      priceManualOverride: true,
    });
    expect(result).toEqual({
      totalCost: 150,
      dailyPrice: 12,
      priceManualOverride: true,
    });
  });

  it('ignora dailyPrice quando priceManualOverride é false', () => {
    const result = resolveGamePricingForSave({
      totalCost: 150,
      maxPlayers: 10,
      dailyPrice: 99,
      priceManualOverride: false,
    });
    expect(result.dailyPrice).toBe(15);
  });

  it('retorna dailyPrice 0 quando override sem valor válido', () => {
    const result = resolveGamePricingForSave({
      totalCost: 150,
      maxPlayers: 10,
      dailyPrice: null,
      priceManualOverride: true,
    });
    expect(result.dailyPrice).toBe(0);
  });

  it('saneia totalCost inválido (NaN) para 0', () => {
    const result = resolveGamePricingForSave({ totalCost: NaN, maxPlayers: 10 });
    expect(result.totalCost).toBe(0);
    expect(result.dailyPrice).toBe(0);
  });

  it('saneia totalCost negativo para 0', () => {
    const result = resolveGamePricingForSave({ totalCost: -50, maxPlayers: 10 });
    expect(result.totalCost).toBe(0);
  });

  it('saneia dailyPrice inválido (negativo) para 0 no override', () => {
    const result = resolveGamePricingForSave({
      totalCost: 150,
      maxPlayers: 10,
      dailyPrice: -5,
      priceManualOverride: true,
    });
    expect(result.dailyPrice).toBe(0);
  });

  it('arredonda totalCost para 2 casas decimais', () => {
    const result = resolveGamePricingForSave({ totalCost: 100.456, maxPlayers: 4 });
    expect(result.totalCost).toBe(100.46);
  });

  it('retorna 0 por jogador quando maxPlayers é 0', () => {
    const result = resolveGamePricingForSave({ totalCost: 150, maxPlayers: 0 });
    expect(result.dailyPrice).toBe(0);
  });

  it('priceManualOverride default é false', () => {
    const result = resolveGamePricingForSave({ totalCost: 100, maxPlayers: 4 });
    expect(result.priceManualOverride).toBe(false);
  });
});
