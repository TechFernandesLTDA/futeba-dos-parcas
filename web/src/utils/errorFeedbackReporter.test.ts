import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorInfo } from 'react';

const {
  addDocMock,
  collectionMock,
  serverTimestampMock,
  firebaseMock,
} = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  collectionMock: vi.fn((...args: unknown[]) => ({ kind: 'collection', args })),
  serverTimestampMock: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  firebaseMock: {
    db: {},
    // Mutável por teste: { currentUser: { uid, email } } ou null
    auth: { currentUser: null as unknown },
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  addDoc: addDocMock,
  serverTimestamp: serverTimestampMock,
}));

vi.mock('../services/firebase', () => firebaseMock);

import {
  submitErrorFeedbackReport,
  type ErrorFeedbackInput,
} from './errorFeedbackReporter';
import { addBreadcrumb, clearBreadcrumbs } from './errorContext';

const DEFAULT_PATHNAME = window.location.pathname;

function makeInput(overrides: Partial<ErrorFeedbackInput> = {}): ErrorFeedbackInput {
  return {
    errorId: 'abc12345',
    error: new Error('tela quebrou'),
    errorInfo: null,
    logEntry: null,
    ...overrides,
  };
}

describe('errorFeedbackReporter', () => {
  beforeEach(() => {
    addDocMock.mockReset().mockResolvedValue({ id: 'fb-1' });
    collectionMock.mockClear();
    serverTimestampMock.mockClear();
    firebaseMock.auth.currentUser = null;
    clearBreadcrumbs();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', DEFAULT_PATHNAME);
  });

  it('recusa sem usuário autenticado e não grava nada', async () => {
    const result = await submitErrorFeedbackReport(makeInput());

    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('grava documento user_feedback completo e devolve o feedbackId', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: 'u@x.com' };
    window.history.replaceState({}, '', '/tela-bug');
    addDocMock.mockResolvedValue({ id: 'fb-9' });

    const result = await submitErrorFeedbackReport(makeInput({ errorId: 'err00001' }));

    expect(result).toEqual({ ok: true, feedbackId: 'fb-9' });
    expect(collectionMock).toHaveBeenCalledWith(firebaseMock.db, 'user_feedback');

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown> & { context: Record<string, unknown> };
    expect(doc.user_id).toBe('u-1');
    expect(doc.user_email).toBe('u@x.com');
    expect(doc.type).toBe('bug');
    expect(doc.severity).toBe('high');
    expect(doc.status).toBe('open');
    expect(doc.title).toBe('Erro inesperado em /tela-bug (err00001)');
    expect(doc.description).toContain('Rota: /tela-bug');
    expect(doc.description).toContain('Codigo: err00001');
    expect(doc.description).toContain('Mensagem: tela quebrou');
    expect(doc.created_at).toEqual({ __sentinel: 'serverTimestamp' });
    expect(doc.updated_at).toEqual({ __sentinel: 'serverTimestamp' });
    expect(doc.context).toMatchObject({
      platform: 'web',
      source: 'error_boundary',
      errorId: 'err00001',
      route: '/tela-bug',
    });
    expect(doc.context.error).toMatchObject({ name: 'Error', message: 'tela quebrou' });
  });

  it('addDoc falhando devolve { ok: false, reason: "failed" } (nunca lança)', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };
    addDocMock.mockRejectedValue(new Error('unavailable'));

    const result = await submitErrorFeedbackReport(makeInput());

    expect(result).toEqual({ ok: false, reason: 'failed' });
  });

  it('sem error e sem logEntry usa defaults: sem-codigo / Erro inesperado', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };

    await submitErrorFeedbackReport({ errorId: null, error: null, errorInfo: null, logEntry: null });

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown> & { context: Record<string, unknown> };
    expect(doc.title).toContain('sem-codigo');
    expect(doc.description).toContain('Mensagem: Erro inesperado');
    expect(doc.context.error).toMatchObject({ name: 'Error', message: 'Erro inesperado' });
    // stack vazio é removido por removeUndefinedDeep
    expect((doc.context.error as Record<string, unknown>).stack).toBeUndefined();
    expect(doc.context.componentStack).toBeUndefined();
  });

  it('errorId cai para logEntry.errorId quando input.errorId é null', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };
    const logEntry = {
      errorId: 'log99999',
      message: 'do log',
      name: 'TypeError',
      stack: 'st-do-log',
      context: { kind: 'render' as const, componentStack: 'cs-do-log' },
    };

    await submitErrorFeedbackReport({ errorId: null, error: null, errorInfo: null, logEntry });

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown> & { context: Record<string, unknown> };
    expect(doc.title).toContain('log99999');
    expect(doc.description).toContain('Mensagem: do log');
    expect(doc.context.error).toMatchObject({ name: 'TypeError', message: 'do log', stack: 'st-do-log' });
    expect(doc.context.componentStack).toBe('cs-do-log');
  });

  it('errorInfo do input prevalece sobre o componentStack do logEntry', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };
    const logEntry = {
      errorId: 'x',
      context: { kind: 'render' as const, componentStack: 'cs-do-log' },
    };
    const errorInfo = { componentStack: 'cs-react' } as unknown as ErrorInfo;

    await submitErrorFeedbackReport({ errorId: 'x', error: null, errorInfo, logEntry });

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown> & { context: Record<string, unknown> };
    expect(doc.context.componentStack).toBe('cs-react');
  });

  it('trunca title/description/stack/componentStack nos limites', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };
    const err = new Error('m');
    err.stack = 's'.repeat(7000);
    const errorInfo = { componentStack: 'c'.repeat(7000) } as unknown as ErrorInfo;

    await submitErrorFeedbackReport(
      makeInput({ errorId: 'x'.repeat(120), error: err, errorInfo }),
    );

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown> & { context: Record<string, unknown> };
    expect((doc.title as string).length).toBeLessThanOrEqual(80);
    expect((doc.description as string).length).toBeLessThanOrEqual(2000);
    expect((doc.context.error as Record<string, unknown>).stack).toHaveLength(5999);
    expect(doc.context.componentStack).toHaveLength(5999);
  });

  it('limita breadcrumbs aos 10 mais recentes', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };
    for (let i = 0; i < 14; i += 1) {
      addBreadcrumb('ui', `acao-${i}`);
    }

    await submitErrorFeedbackReport(makeInput());

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown> & { context: Record<string, unknown> };
    const breadcrumbs = doc.context.breadcrumbs as Array<{ message: string }>;
    expect(breadcrumbs).toHaveLength(10);
    expect(breadcrumbs[0].message).toBe('acao-4');
    expect(breadcrumbs[9].message).toBe('acao-13');
  });

  it('context captura dados de ambiente do navegador', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: '' };

    await submitErrorFeedbackReport(makeInput());

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown>;
    const context = doc.context as Record<string, unknown>;
    expect(context.url).toBe(window.location.href);
    expect(typeof context.userAgent).toBe('string');
    expect(typeof context.language).toBe('string');
    expect(context.viewport).toMatch(/^\d+x\d+$/);
    expect(typeof context.appVersion).toBe('string');
    expect((context.appVersion as string).length).toBeGreaterThan(0);
  });

  it('user_email vazio quando o usuário não tem email', async () => {
    firebaseMock.auth.currentUser = { uid: 'u-1', email: null };

    await submitErrorFeedbackReport(makeInput());

    const doc = addDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(doc.user_email).toBe('');
  });
});
