import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime } from './dateUtils';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 10, 0, 0)); // 14/03/2026 10:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna string vazia para null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('retorna string vazia para data inválida', () => {
    expect(formatRelativeTime('nao-uma-data')).toBe('');
  });

  it('retorna string vazia para Date inválida', () => {
    expect(formatRelativeTime(new Date(NaN))).toBe('');
  });

  it('retorna "agora" para menos de 60 segundos', () => {
    const date = new Date(2026, 2, 14, 9, 59, 30);
    expect(formatRelativeTime(date)).toBe('agora');
  });

  it('retorna "agora" no limite exato de 59 segundos', () => {
    const date = new Date(2026, 2, 14, 9, 59, 1);
    expect(formatRelativeTime(date)).toBe('agora');
  });

  it('retorna minutos entre 1 e 59 minutos', () => {
    const date = new Date(2026, 2, 14, 9, 30, 0);
    expect(formatRelativeTime(date)).toBe('30 min');
  });

  it('aceita string ISO como entrada', () => {
    expect(formatRelativeTime(new Date(2026, 2, 14, 9, 45, 0).toISOString())).toBe('15 min');
  });

  it('aceita timestamp numérico como entrada', () => {
    expect(formatRelativeTime(new Date(2026, 2, 14, 9, 0, 0).getTime())).toBe('1h');
  });

  it('retorna horas entre 1h e 23h', () => {
    const date = new Date(2026, 2, 14, 8, 0, 0);
    expect(formatRelativeTime(date)).toBe('2h');
  });

  it('retorna dias entre 1d e 6d', () => {
    const date = new Date(2026, 2, 12, 10, 0, 0);
    expect(formatRelativeTime(date)).toBe('2d');
  });

  it('usar formato de data para 7 dias ou mais', () => {
    const date = new Date(2026, 2, 4, 10, 0, 0); // 10 dias antes
    const result = formatRelativeTime(date);
    // pt-BR day 2-digit + month short → contém o dia e não é relativo
    expect(result).toContain('04');
    expect(result).toMatch(/mar/);
    expect(result).not.toBe('10d');
    expect(result).not.toMatch(/^\d+d$/);
  });

  it('retorna "agora" para data no futuro (diff negativo)', () => {
    const date = new Date(2026, 2, 14, 10, 30, 0);
    expect(formatRelativeTime(date)).toBe('agora');
  });
});
