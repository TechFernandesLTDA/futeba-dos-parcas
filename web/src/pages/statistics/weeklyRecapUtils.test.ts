import { describe, expect, it } from 'vitest';
import { isInLastWeek, resolveWeeklyGameDate } from './weeklyRecapUtils';

const now = new Date(2026, 10, 23, 12, 0, 0); // 23/11/2026 12:00

describe('resolveWeeklyGameDate', () => {
  it('prefere o dateTime gravado pelos apps', () => {
    const dateTime = new Date(2026, 10, 20, 19, 0);
    expect(resolveWeeklyGameDate({ dateTime: { toDate: () => dateTime }, date: '2026-01-01' })).toBe(dateTime);
  });

  it('sem dateTime, usa date + time no dia local (não meia-noite UTC)', () => {
    const date = resolveWeeklyGameDate({ date: '2026-11-25', time: '20:30' });
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(25);
    expect(date?.getHours()).toBe(20);
  });

  it('devolve null sem data', () => {
    expect(resolveWeeklyGameDate({})).toBeNull();
  });
});

describe('isInLastWeek', () => {
  it('aceita jogo de 3 dias atrás', () => {
    expect(isInLastWeek(new Date(2026, 10, 20, 19, 0), now)).toBe(true);
  });

  it('recusa jogo de 20 dias atrás, que antes aparecia no resumo da semana', () => {
    expect(isInLastWeek(new Date(2026, 10, 3, 19, 0), now)).toBe(false);
  });

  it('recusa jogo futuro e data ausente', () => {
    expect(isInLastWeek(new Date(2026, 10, 25, 19, 0), now)).toBe(false);
    expect(isInLastWeek(null, now)).toBe(false);
  });
});
