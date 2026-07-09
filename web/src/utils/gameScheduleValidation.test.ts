import { describe, expect, it } from 'vitest';
import {
  hasDuplicateScheduleSlot,
  isScheduledDateTimeInPast,
  parseLocalGameDateTime,
} from './gameScheduleValidation';

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

  it('bloqueia slot ativo com mesmo dia e horario', () => {
    const schedules = [
      { dayOfWeek: 2, time: '20:00', isActive: true },
      { dayOfWeek: 4, time: '21:00', isActive: true },
    ];

    expect(hasDuplicateScheduleSlot(schedules, 2, '20:00')).toBe(true);
    expect(hasDuplicateScheduleSlot(schedules, 2, '21:00')).toBe(false);
  });

  it('permite reutilizar slot inativo', () => {
    expect(
      hasDuplicateScheduleSlot([{ dayOfWeek: 2, time: '20:00', isActive: false }], 2, '20:00'),
    ).toBe(false);
  });
});
