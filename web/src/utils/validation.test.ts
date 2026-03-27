import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePasswordMatch,
  validateRequired,
  validateNumberRange,
} from './validation';

describe('validateEmail', () => {
  it('aceita email válido', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true });
  });

  it('rejeita email vazio', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'E-mail é obrigatório' });
  });

  it('rejeita email apenas espaços', () => {
    expect(validateEmail('   ')).toEqual({ valid: false, error: 'E-mail é obrigatório' });
  });

  it('rejeita email inválido', () => {
    expect(validateEmail('invalid')).toEqual({ valid: false, error: 'E-mail inválido' });
    expect(validateEmail('user@')).toEqual({ valid: false, error: 'E-mail inválido' });
    expect(validateEmail('@domain.com')).toEqual({ valid: false, error: 'E-mail inválido' });
  });
});

describe('validatePassword', () => {
  it('aceita senha válida', () => {
    expect(validatePassword('123456')).toEqual({ valid: true });
  });

  it('rejeita senha vazia', () => {
    expect(validatePassword('')).toEqual({ valid: false, error: 'Senha é obrigatória' });
  });

  it('rejeita senha curta', () => {
    expect(validatePassword('123')).toEqual({
      valid: false,
      error: 'Senha deve ter pelo menos 6 caracteres',
    });
  });
});

describe('validateName', () => {
  it('aceita nome válido', () => {
    expect(validateName('João Silva')).toEqual({ valid: true });
  });

  it('rejeita nome vazio', () => {
    expect(validateName('')).toEqual({ valid: false, error: 'Nome é obrigatório' });
  });

  it('rejeita nome curto', () => {
    expect(validateName('J')).toEqual({
      valid: false,
      error: 'Nome deve ter pelo menos 2 caracteres',
    });
  });

  it('rejeita nome longo', () => {
    const longName = 'A'.repeat(51);
    expect(validateName(longName)).toEqual({
      valid: false,
      error: 'Nome deve ter no máximo 50 caracteres',
    });
  });
});

describe('validatePasswordMatch', () => {
  it('aceita senhas iguais', () => {
    expect(validatePasswordMatch('abc123', 'abc123')).toEqual({ valid: true });
  });

  it('rejeita senhas diferentes', () => {
    expect(validatePasswordMatch('abc123', 'xyz789')).toEqual({
      valid: false,
      error: 'As senhas não coincidem',
    });
  });
});

describe('validateRequired', () => {
  it('aceita campo preenchido', () => {
    expect(validateRequired('valor', 'Campo')).toEqual({ valid: true });
  });

  it('rejeita campo vazio', () => {
    expect(validateRequired('', 'Local')).toEqual({
      valid: false,
      error: 'Local é obrigatório',
    });
  });
});

describe('validateNumberRange', () => {
  it('aceita número dentro do range', () => {
    expect(validateNumberRange(10, 1, 20, 'Jogadores')).toEqual({ valid: true });
  });

  it('rejeita número abaixo do mínimo', () => {
    expect(validateNumberRange(0, 1, 20, 'Jogadores')).toEqual({
      valid: false,
      error: 'Jogadores deve estar entre 1 e 20',
    });
  });

  it('rejeita número acima do máximo', () => {
    expect(validateNumberRange(25, 1, 20, 'Jogadores')).toEqual({
      valid: false,
      error: 'Jogadores deve estar entre 1 e 20',
    });
  });
});
