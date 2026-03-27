import { describe, it, expect } from 'vitest';
import {
  MOBILE_MAX_WIDTH,
  FIRESTORE_BATCH_LIMIT,
  FIRESTORE_WHERE_IN_LIMIT,
  DEBOUNCE_SEARCH_MS,
  MIN_PASSWORD_LENGTH,
  STALE_TIME_MS,
  XP_PARTICIPATION,
  XP_MVP,
  ROUTES,
} from './constants';

describe('constants', () => {
  it('MOBILE_MAX_WIDTH é 480', () => {
    expect(MOBILE_MAX_WIDTH).toBe(480);
  });

  it('FIRESTORE_BATCH_LIMIT é 400 (margem segura)', () => {
    expect(FIRESTORE_BATCH_LIMIT).toBeLessThan(500);
    expect(FIRESTORE_BATCH_LIMIT).toBe(400);
  });

  it('FIRESTORE_WHERE_IN_LIMIT é 10', () => {
    expect(FIRESTORE_WHERE_IN_LIMIT).toBe(10);
  });

  it('DEBOUNCE_SEARCH_MS é 300', () => {
    expect(DEBOUNCE_SEARCH_MS).toBe(300);
  });

  it('MIN_PASSWORD_LENGTH é 6', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
  });

  it('STALE_TIME_MS é 5 minutos', () => {
    expect(STALE_TIME_MS).toBe(5 * 60 * 1000);
  });

  it('XP values estão corretos', () => {
    expect(XP_PARTICIPATION).toBe(10);
    expect(XP_MVP).toBe(50);
  });

  it('ROUTES contém rotas principais', () => {
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.LOGIN).toBe('/login');
    expect(ROUTES.GAMES).toBe('/games');
    expect(ROUTES.PROFILE).toBe('/profile');
  });
});
