import { describe, expect, it } from 'vitest';
import { getEndOfToday, isLookingForGameToday } from './lookingForGameToday';

describe('lookingForGameToday', () => {
  it('calcula a expiracao no fim do dia local', () => {
    const end = getEndOfToday(new Date(2026, 5, 27, 10, 30, 0));

    expect(end).toEqual(new Date(2026, 5, 27, 23, 59, 59, 999));
  });

  it('fica ativo somente quando flag e expiracao futura existem', () => {
    const now = new Date(2026, 5, 27, 20, 0, 0);

    expect(isLookingForGameToday({
      lookingForGameToday: true,
      lookingForGameTodayUntil: new Date(2026, 5, 27, 23, 59, 59),
    }, now)).toBe(true);
    expect(isLookingForGameToday({
      lookingForGameToday: true,
      lookingForGameTodayUntil: new Date(2026, 5, 27, 19, 59, 59),
    }, now)).toBe(false);
    expect(isLookingForGameToday({
      lookingForGameToday: false,
      lookingForGameTodayUntil: new Date(2026, 5, 27, 23, 59, 59),
    }, now)).toBe(false);
  });

  it('aceita objetos Timestamp-like vindos do Firestore', () => {
    const now = new Date(2026, 5, 27, 20, 0, 0);

    expect(isLookingForGameToday({
      lookingForGameToday: true,
      lookingForGameTodayUntil: { toDate: () => new Date(2026, 5, 27, 23, 59, 59) },
    }, now)).toBe(true);
  });
});
