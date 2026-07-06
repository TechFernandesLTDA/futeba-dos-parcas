import { describe, expect, it } from 'vitest';
import { isScheduledDateTimeInPast, parseLocalGameDateTime } from './gameScheduleValidation';

describe('gameScheduleValidation', () => {
  it('bloqueia horario passado no mesmo dia', () => {
    const now = new Date(2026, 6, 6, 19, 30);

    expect(isScheduledDateTimeInPast('2026-07-06', '19:00', now)).toBe(true);
  });

  it('permite horario futuro no mesmo dia', () => {
    const now = new Date(2026, 6, 6, 19, 30);

    expect(isScheduledDateTimeInPast('2026-07-06', '20:00', now)).toBe(false);
  });

  it('permite datas futuras', () => {
    const now = new Date(2026, 6, 6, 19, 30);

    expect(isScheduledDateTimeInPast('2026-07-07', '09:00', now)).toBe(false);
  });

  it('rejeita data ou horario invalido ao parsear', () => {
    expect(parseLocalGameDateTime('2026-02-31', '19:00')).toBeNull();
    expect(parseLocalGameDateTime('2026-07-06', '25:00')).toBeNull();
  });
});
