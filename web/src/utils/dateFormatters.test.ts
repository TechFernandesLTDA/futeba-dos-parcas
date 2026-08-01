import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import i18n from 'i18next';
import { formatGameDate, formatGameDateLong, formatTimeAgo, formatDateShort } from './dateFormatters';

describe('formatGameDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 10, 0, 0)); // 14/03/2026 10:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna string vazia para undefined', () => {
    expect(formatGameDate(undefined)).toBe('');
  });

  it('retorna "Hoje" para a data de hoje (formato DD/MM/YYYY)', () => {
    expect(formatGameDate('14/03/2026')).toBe('Hoje');
  });

  it('retorna "Amanhã" para a data de amanhã (formato DD/MM/YYYY)', () => {
    expect(formatGameDate('15/03/2026')).toBe('Amanhã');
  });

  it('formata datas futuras com weekday curto (formato DD/MM/YYYY)', () => {
    const result = formatGameDate('20/03/2026');
    expect(result).toContain('20');
  });

  it('retorna string vazia para string vazia', () => {
    expect(formatGameDate('')).toBe('');
  });
});

describe('formatGameDateLong', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna "Hoje" para hoje (DD/MM/YYYY)', () => {
    expect(formatGameDateLong('14/03/2026')).toBe('Hoje');
  });

  it('retorna "Amanhã" para amanhã (DD/MM/YYYY)', () => {
    expect(formatGameDateLong('15/03/2026')).toBe('Amanhã');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatGameDateLong(undefined)).toBe('');
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna "Agora" para menos de 1 minuto', () => {
    const date = new Date(2026, 2, 14, 9, 59, 45);
    expect(formatTimeAgo(date)).toBe('Agora');
  });

  it('retorna minutos para menos de 1 hora', () => {
    const date = new Date(2026, 2, 14, 9, 30, 0);
    expect(formatTimeAgo(date)).toBe('Há 30 min');
  });

  it('retorna horas para menos de 24 horas', () => {
    const date = new Date(2026, 2, 14, 7, 0, 0);
    expect(formatTimeAgo(date)).toBe('Há 3h');
  });

  it('retorna "Ontem" para 1 dia atrás', () => {
    const date = new Date(2026, 2, 13, 10, 0, 0);
    expect(formatTimeAgo(date)).toBe('Ontem');
  });

  it('retorna dias para menos de 7 dias', () => {
    const date = new Date(2026, 2, 11, 10, 0, 0);
    expect(formatTimeAgo(date)).toBe('Há 3 dias');
  });

  it('retorna data formatada para 7+ dias', () => {
    const date = new Date(2026, 2, 1, 10, 0, 0);
    const result = formatTimeAgo(date);
    expect(result).toContain('1');
  });
});

describe('formatDateShort', () => {
  it('retorna string vazia para undefined', () => {
    expect(formatDateShort(undefined)).toBe('');
  });

  it('formata Date object corretamente', () => {
    const date = new Date(2026, 2, 14);
    const result = formatDateShort(date);
    expect(result).toContain('14');
  });
});

describe('dateFormatters i18n (#3945)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formatGameDate traduz Today/Tomorrow em EN', () => {
    expect(formatGameDate('14/03/2026')).toBe('Today');
    expect(formatGameDate('15/03/2026')).toBe('Tomorrow');
  });

  it('formatGameDateLong traduz Today/Tomorrow em EN', () => {
    expect(formatGameDateLong('14/03/2026')).toBe('Today');
    expect(formatGameDateLong('15/03/2026')).toBe('Tomorrow');
  });

  it('formatTimeAgo usa strings EN', () => {
    expect(formatTimeAgo(new Date(2026, 2, 14, 9, 59, 45))).toBe('Now');
    expect(formatTimeAgo(new Date(2026, 2, 14, 9, 30, 0))).toBe('30 min ago');
    expect(formatTimeAgo(new Date(2026, 2, 14, 7, 0, 0))).toBe('3h ago');
    expect(formatTimeAgo(new Date(2026, 2, 13, 10, 0, 0))).toBe('Yesterday');
    expect(formatTimeAgo(new Date(2026, 2, 11, 10, 0, 0))).toBe('3 days ago');
  });

  it('respeita locale informado para formatação Intl', () => {
    const result = formatDateShort(new Date(2026, 2, 14), 'pt-BR');
    expect(result).toContain('14');
  });
});
