import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage, getFirestoreErrorMessage } from './firebaseErrors';

describe('getAuthErrorMessage', () => {
  it('retorna mensagem PT-BR para auth/invalid-credential', () => {
    const error = { code: 'auth/invalid-credential' };
    expect(getAuthErrorMessage(error)).toBe('Email ou senha inválidos');
  });

  it('retorna mensagem PT-BR para auth/email-already-in-use', () => {
    const error = { code: 'auth/email-already-in-use' };
    expect(getAuthErrorMessage(error)).toBe('Este email já está em uso');
  });

  it('retorna mensagem PT-BR para auth/too-many-requests', () => {
    const error = { code: 'auth/too-many-requests' };
    expect(getAuthErrorMessage(error)).toBe('Muitas tentativas. Tente novamente mais tarde');
  });

  it('retorna mensagem PT-BR para auth/popup-closed-by-user', () => {
    const error = { code: 'auth/popup-closed-by-user' };
    expect(getAuthErrorMessage(error)).toBe('Login cancelado');
  });

  it('retorna mensagem PT-BR para auth/weak-password', () => {
    const error = { code: 'auth/weak-password' };
    expect(getAuthErrorMessage(error)).toBe('Senha muito fraca. Use pelo menos 6 caracteres');
  });

  it('retorna mensagem PT-BR para auth/network-request-failed', () => {
    const error = { code: 'auth/network-request-failed' };
    expect(getAuthErrorMessage(error)).toBe('Erro de conexão. Verifique sua internet');
  });

  it('retorna fallback para código desconhecido', () => {
    const error = { code: 'auth/unknown-error' };
    expect(getAuthErrorMessage(error, 'Erro personalizado')).toBe('Erro personalizado');
  });

  it('retorna mensagem padrão quando não há fallback', () => {
    const error = { code: 'auth/unknown-error' };
    expect(getAuthErrorMessage(error)).toBe('Erro inesperado. Tente novamente');
  });

  it('lida com erro sem code', () => {
    expect(getAuthErrorMessage({})).toBe('Erro inesperado. Tente novamente');
    expect(getAuthErrorMessage(null)).toBe('Erro inesperado. Tente novamente');
    expect(getAuthErrorMessage(undefined)).toBe('Erro inesperado. Tente novamente');
  });
});

describe('getFirestoreErrorMessage', () => {
  it('retorna mensagem PT-BR para permission-denied', () => {
    const error = { code: 'permission-denied' };
    expect(getFirestoreErrorMessage(error)).toBe('Sem permissão para realizar esta ação');
  });

  it('retorna mensagem PT-BR para not-found', () => {
    const error = { code: 'not-found' };
    expect(getFirestoreErrorMessage(error)).toBe('Dado não encontrado');
  });

  it('retorna mensagem PT-BR para unavailable', () => {
    const error = { code: 'unavailable' };
    expect(getFirestoreErrorMessage(error)).toBe('Serviço temporariamente indisponível. Tente novamente');
  });

  it('retorna fallback para código desconhecido', () => {
    const error = { code: 'unknown' };
    expect(getFirestoreErrorMessage(error, 'Erro custom')).toBe('Erro custom');
  });

  it('retorna mensagem padrão sem fallback', () => {
    const error = { code: 'unknown' };
    expect(getFirestoreErrorMessage(error)).toBe('Erro ao acessar dados. Tente novamente');
  });
});
