import { describe, expect, it } from 'vitest';
import {
  isAdminRole,
  isFieldOwnerOrAdminRole,
  isOnboardingPath,
  onboardingStepFor,
} from './routeGuards';

describe('routeGuards', () => {
  describe('isAdminRole', () => {
    it('libera apenas ADMIN', () => {
      expect(isAdminRole('ADMIN')).toBe(true);
    });

    it('nega FIELD_OWNER e PLAYER', () => {
      expect(isAdminRole('FIELD_OWNER')).toBe(false);
      expect(isAdminRole('PLAYER')).toBe(false);
    });

    it('nega role ausente (fail-closed)', () => {
      expect(isAdminRole(null)).toBe(false);
      expect(isAdminRole(undefined)).toBe(false);
    });
  });

  describe('isFieldOwnerOrAdminRole', () => {
    it('libera FIELD_OWNER e ADMIN', () => {
      expect(isFieldOwnerOrAdminRole('FIELD_OWNER')).toBe(true);
      expect(isFieldOwnerOrAdminRole('ADMIN')).toBe(true);
    });

    it('nega PLAYER', () => {
      expect(isFieldOwnerOrAdminRole('PLAYER')).toBe(false);
    });

    it('nega role ausente (fail-closed)', () => {
      expect(isFieldOwnerOrAdminRole(null)).toBe(false);
      expect(isFieldOwnerOrAdminRole(undefined)).toBe(false);
    });
  });

  describe('onboardingStepFor', () => {
    it('avança para o CPF quando já há telefone', () => {
      expect(onboardingStepFor('+5511999999999')).toBe('/onboarding/cpf');
    });

    it('começa pelo telefone quando não há telefone', () => {
      expect(onboardingStepFor(null)).toBe('/onboarding/phone');
      expect(onboardingStepFor(undefined)).toBe('/onboarding/phone');
    });

    it('trata string vazia como telefone ausente', () => {
      expect(onboardingStepFor('')).toBe('/onboarding/phone');
    });
  });

  describe('isOnboardingPath', () => {
    it('reconhece as rotas de onboarding', () => {
      expect(isOnboardingPath('/onboarding/phone')).toBe(true);
      expect(isOnboardingPath('/onboarding/cpf')).toBe(true);
    });

    it('não confunde o prefixo sem barra final', () => {
      expect(isOnboardingPath('/onboarding')).toBe(false);
    });

    it('nega rotas comuns', () => {
      expect(isOnboardingPath('/game/create')).toBe(false);
      expect(isOnboardingPath('/')).toBe(false);
    });
  });
});
