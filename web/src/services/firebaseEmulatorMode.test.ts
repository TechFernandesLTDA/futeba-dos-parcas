import { describe, expect, it } from 'vitest';
import { isFirebaseEmulatorMode } from './firebaseEmulatorMode';

describe('isFirebaseEmulatorMode', () => {
  it('habilita em desenvolvimento com opt-in explícito', () => {
    expect(
      isFirebaseEmulatorMode(
        { DEV: true, MODE: 'development', VITE_USE_EMULATOR: 'true' },
        true,
      ),
    ).toBe(true);
  });

  it('habilita preview otimizado somente no modo e2e', () => {
    expect(
      isFirebaseEmulatorMode(
        { DEV: false, MODE: 'e2e', VITE_USE_EMULATOR: 'true' },
        true,
      ),
    ).toBe(true);
  });

  it('mantém build normal imune ao opt-in vazado', () => {
    expect(
      isFirebaseEmulatorMode(
        { DEV: false, MODE: 'production', VITE_USE_EMULATOR: 'true' },
        true,
      ),
    ).toBe(false);
  });

  it('exige opt-in e contexto de browser', () => {
    expect(isFirebaseEmulatorMode({ DEV: true, MODE: 'development' }, true)).toBe(false);
    expect(
      isFirebaseEmulatorMode(
        { DEV: false, MODE: 'e2e', VITE_USE_EMULATOR: 'true' },
        false,
      ),
    ).toBe(false);
  });
});
