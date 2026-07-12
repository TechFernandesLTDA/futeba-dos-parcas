import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCATION_TIME_ZONE,
  Location,
  isLocationOpenAt,
  isOpenNow,
  isValidLocationTimeZone,
} from './location';

const location = (overrides: Partial<Location> = {}) => ({
  isActive: true,
  openingTime: '08:00',
  closingTime: '23:00',
  operatingDays: [1, 2, 3, 4, 5, 6, 7],
  timeZone: DEFAULT_LOCATION_TIME_ZONE,
  ...overrides,
}) as Location;

afterEach(() => {
  vi.useRealTimers();
});

describe('isLocationOpenAt', () => {
  it('preserva os limites inclusivos de um intervalo no mesmo dia', () => {
    const venue = location({ operatingDays: [1], openingTime: '08:00', closingTime: '23:00' });

    expect(isLocationOpenAt(venue, new Date('2026-06-29T07:59:00-03:00'))).toBe(false);
    expect(isLocationOpenAt(venue, new Date('2026-06-29T08:00:00-03:00'))).toBe(true);
    expect(isLocationOpenAt(venue, new Date('2026-06-29T23:00:00-03:00'))).toBe(true);
    expect(isLocationOpenAt(venue, new Date('2026-06-29T23:01:00-03:00'))).toBe(false);
  });

  it('associa a madrugada overnight ao dia anterior', () => {
    const mondayNight = location({ operatingDays: [1], openingTime: '22:00', closingTime: '02:00' });

    expect(isLocationOpenAt(mondayNight, new Date('2026-06-29T22:00:00-03:00'))).toBe(true);
    expect(isLocationOpenAt(mondayNight, new Date('2026-06-30T01:30:00-03:00'))).toBe(true);
    expect(isLocationOpenAt(mondayNight, new Date('2026-06-30T02:00:00-03:00'))).toBe(true);
    expect(isLocationOpenAt(mondayNight, new Date('2026-06-30T02:01:00-03:00'))).toBe(false);
    expect(isLocationOpenAt(location({
      operatingDays: [2],
      openingTime: '22:00',
      closingTime: '02:00',
    }), new Date('2026-06-30T01:30:00-03:00'))).toBe(false);
  });

  it('faz corretamente a virada de domingo para segunda', () => {
    const sundayNight = location({ operatingDays: [7], openingTime: '22:00', closingTime: '02:00' });

    expect(isLocationOpenAt(sundayNight, new Date('2026-06-29T01:30:00-03:00'))).toBe(true);
    expect(isLocationOpenAt(sundayNight, new Date('2026-06-29T02:01:00-03:00'))).toBe(false);
  });

  it('usa o fuso IANA do local, incluindo UTC e extremos civis', () => {
    const instant = new Date('2026-06-29T10:30:00Z');

    expect(isLocationOpenAt(location({
      timeZone: 'UTC',
      operatingDays: [1],
      openingTime: '10:00',
      closingTime: '11:00',
    }), instant)).toBe(true);
    expect(isLocationOpenAt(location({
      timeZone: 'Pacific/Kiritimati',
      operatingDays: [2],
      openingTime: '00:00',
      closingTime: '01:00',
    }), instant)).toBe(true);
    expect(isLocationOpenAt(location({
      timeZone: 'America/Adak',
      operatingDays: [1],
      openingTime: '01:00',
      closingTime: '02:00',
    }), instant)).toBe(true);
  });

  it('usa Sao Paulo somente quando o fuso legado está ausente ou vazio', () => {
    const instant = new Date('2026-06-29T12:30:00-03:00');
    const schedule = { operatingDays: [1], openingTime: '12:00', closingTime: '13:00' };

    expect(isLocationOpenAt(location({ ...schedule, timeZone: undefined }), instant)).toBe(true);
    expect(isLocationOpenAt(location({ ...schedule, timeZone: '  ' }), instant)).toBe(true);
    expect(isLocationOpenAt(location({ ...schedule, timeZone: 'Mars/Olympus_Mons' }), instant)).toBe(false);
    expect(isLocationOpenAt(location({
      ...schedule,
      timeZone: 123 as unknown as string,
    }), instant)).toBe(false);
  });

  it('fecha com segurança para instante, horário, dias ou estado inválidos', () => {
    const instant = new Date('2026-06-29T12:30:00-03:00');

    expect(isLocationOpenAt(location(), new Date('invalid'))).toBe(false);
    expect(isLocationOpenAt(location({ openingTime: '8:00' }), instant)).toBe(false);
    expect(isLocationOpenAt(location({ closingTime: '24:00' }), instant)).toBe(false);
    expect(isLocationOpenAt(location({ openingTime: '12:00', closingTime: '12:00' }), instant)).toBe(false);
    expect(isLocationOpenAt(location({ operatingDays: [0, 1] }), instant)).toBe(false);
    expect(isLocationOpenAt(location({ isActive: false }), instant)).toBe(false);
  });

  it('mantém isOpenNow como wrapper da mesma regra canônica', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T12:30:00-03:00'));
    const venue = location({ operatingDays: [1], openingTime: '12:00', closingTime: '13:00' });

    expect(isOpenNow(venue)).toBe(isLocationOpenAt(venue, new Date()));
  });

  it('valida identificadores IANA sem aceitar aliases inexistentes', () => {
    expect(isValidLocationTimeZone(DEFAULT_LOCATION_TIME_ZONE)).toBe(true);
    expect(isValidLocationTimeZone('Pacific/Kiritimati')).toBe(true);
    expect(isValidLocationTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidLocationTimeZone('')).toBe(false);
  });
});
