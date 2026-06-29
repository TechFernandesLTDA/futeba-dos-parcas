import { describe, it, expect, vi } from 'vitest';

// Mock firebase/firestore e services/firebase para evitar erro "Missing Firebase config"
// que ocorre porque firebaseErrors.ts → errorLogger.ts → services/firebase.ts (#2330)
vi.mock('../services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  limit: vi.fn((...args) => args[0]),
}));

import { getAuthErrorMessage, getFirestoreErrorMessage, getFunctionsErrorMessage } from './firebaseErrors';

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

describe('getFunctionsErrorMessage', () => {
  it('retorna mensagem acionável para failed-precondition', () => {
    const error = { code: 'functions/failed-precondition' };
    expect(getFunctionsErrorMessage(error, 'searchAdminUsers')).toBe(
      'Operação temporariamente indisponível. Recarregue a página e tente novamente.'
    );
  });

  it('retorna mensagem acionável para unavailable sem prefixo', () => {
    const error = { code: 'unavailable' };
    expect(getFunctionsErrorMessage(error, 'searchAdminUsers')).toBe(
      'Servidor temporariamente indisponível. Recarregue a página e tente novamente.'
    );
  });

  it('retorna fallback para código desconhecido de Functions', () => {
    const error = { code: 'unknown' };
    expect(getFunctionsErrorMessage(error, 'searchAdminUsers', 'Erro custom')).toBe('Erro custom');
  });
});
