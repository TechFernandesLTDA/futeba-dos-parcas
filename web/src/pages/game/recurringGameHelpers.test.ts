import { describe, expect, it } from 'vitest';
import { calculateNextOccurrence, getNextRecurringDate } from './recurringGameHelpers';

describe('recurringGameHelpers', () => {
  it('respeita a recorrência semanal, quinzenal e mensal ao calcular a próxima ocorrência', () => {
    const now = new Date(2026, 6, 9, 21, 30);

    expect(calculateNextOccurrence('19:00', 'weekly', now)).toEqual({
      date: '2026-07-16',
      time: '19:00',
    });
    expect(calculateNextOccurrence('19:00', 'biweekly', now)).toEqual({
      date: '2026-07-23',
      time: '19:00',
    });
    expect(calculateNextOccurrence('19:00', 'monthly', now)).toEqual({
      date: '2026-08-09',
      time: '19:00',
    });
  });

  it('mantém o mesmo dia quando o horário ainda não passou', () => {
    const now = new Date(2026, 6, 9, 18, 0);

    expect(calculateNextOccurrence('19:00', 'biweekly', now)).toEqual({
      date: '2026-07-09',
      time: '19:00',
    });
  });

  it('avança a data-base pelo intervalo correto da recorrência', () => {
    expect(getNextRecurringDate('2026-07-09', 'weekly')).toBe('2026-07-16');
    expect(getNextRecurringDate('2026-07-09', 'biweekly')).toBe('2026-07-23');
    expect(getNextRecurringDate('2026-07-09', 'monthly')).toBe('2026-08-09');
  });
});
