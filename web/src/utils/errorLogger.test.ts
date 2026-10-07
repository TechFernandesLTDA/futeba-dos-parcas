import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';

const {
  addDocMock,
  collectionMock,
  serverTimestampMock,
  firebaseMock,
  loggerMock,
} = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  collectionMock: vi.fn((...args: unknown[]) => ({ kind: 'collection', args })),
  serverTimestampMock: vi.fn(() => ({ __sentinel: 'serverTimestamp' })),
  firebaseMock: {
    db: {},
    // Mutável por teste: { currentUser: { uid } } ou null
    auth: { currentUser: null as unknown },
  },
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  addDoc: addDocMock,
  serverTimestamp: serverTimestampMock,
}));

vi.mock('../services/firebase', () => firebaseMock);

vi.mock('./logger', () => ({ createLogger: () => loggerMock }));

import { getLocalErrorLogs, logError } from './errorLogger';
import { addBreadcrumb, clearBreadcrumbs } from './errorContext';

/**
 * jsdom deste host não expõe localStorage (nativo) — stub em memória,
 * como na convenção dos demais testes do projeto (gameDraft.test.ts).
 */
function createFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string): void => void store.set(key, String(value)),
    removeItem: (key: string): void => void store.delete(key),
    key: (index: number): string | null =>
      index >= 0 && index < store.size ? (Array.from(store.keys())[index] as string) : null,
    get length(): number {
      return store.size;
    },
    clear: (): void => void store.clear(),
  };
}

type FakeStorage = ReturnType<typeof createFakeStorage>;

function installStorage(): FakeStorage {
  const storage = Object.create(createFakeStorage());
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage as FakeStorage;
}

const STORAGE_KEY = 'futeba_error_logs';

describe('errorLogger', () => {
  let storage: FakeStorage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = installStorage();
    addDocMock.mockReset().mockResolvedValue({ id: 'doc-1' });
    collectionMock.mockClear();
    serverTimestampMock.mockClear();
    loggerMock.warn.mockClear();
    firebaseMock.auth.currentUser = null;
    clearBreadcrumbs();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    installStorage().clear();
  });

  it('persiste entrada completa no localStorage e retorna errorId de 8 caracteres', async () => {
    const err = new Error('explosão na renderização');
    err.stack = 'Error: explosão\n  at Component';

    const errorId = await logError(err, { kind: 'render' });

    expect(errorId).toMatch(/^[a-z0-9]{8}$/);
    const logs = getLocalErrorLogs();
    expect(logs).toHaveLength(1);
    const entry = logs[0];
    expect(entry.errorId).toBe(errorId);
    expect(entry.kind).toBe('render');
    expect(entry.message).toBe('explosão na renderização');
    expect(entry.name).toBe('Error');
    expect(entry.stack).toContain('at Component');
    expect(entry.userId).toBeNull();
    expect(entry.userRole).toBeNull();
    expect(entry.route).toBe(window.location.pathname);
    expect(entry.url).toBe(window.location.href);
    expect(typeof entry.userAgent).toBe('string');
    expect(entry.viewport).toMatch(/^\d+x\d+$/);
    expect(typeof entry.createdAt).toBe('string');
    expect(new Date(entry.createdAt).getTime()).not.toBeNaN();
    expect(entry.appVersion.length).toBeGreaterThan(0);
  });

  it('grava no Firestore com serverTimestamp (sentinela) e contexto mapeado', async () => {
    await logError(new Error('x'), {
      kind: 'window-error',
      filename: 'app.js',
      lineno: 10,
    });

    expect(collectionMock).toHaveBeenCalledWith(firebaseMock.db, 'error_logs');
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = addDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.kind).toBe('window-error');
    expect(payload.createdAt).toEqual({ __sentinel: 'serverTimestamp' });
    // context sem errorInfo — componentStack ausente entra como undefined
    expect(payload.context).toEqual({ kind: 'window-error', filename: 'app.js', lineno: 10 });
  });

  it('erro em string vira message com defaults de name/stack', async () => {
    await logError('falhou rede', { kind: 'unknown' });
    expect(getLocalErrorLogs()[0]).toMatchObject({
      message: 'falhou rede',
      name: 'Error',
      stack: '',
    });
  });

  it('erro objeto (não-Error) extrai message/name/stack/code', async () => {
    await logError(
      { message: 'boom', name: 'HttpError', stack: 'st', code: 'ERR_1' },
      { kind: 'unknown' },
    );
    expect(getLocalErrorLogs()[0]).toMatchObject({
      message: 'boom',
      name: 'HttpError',
      stack: 'st',
      code: 'ERR_1',
    });
  });

  it('FirebaseError contribui com code para o log', async () => {
    await logError(
      new FirebaseError('permission-denied', 'negado'),
      { kind: 'firebase', functionName: 'criarGrupo' },
    );
    const entry = getLocalErrorLogs()[0];
    expect(entry.code).toBe('permission-denied');
    expect(entry.context.functionName).toBe('criarGrupo');
  });

  it('erro null/undefined usa mensagem padrão "Erro desconhecido"', async () => {
    await logError(null, { kind: 'unknown' });
    await logError(undefined, { kind: 'unknown' });
    const logs = getLocalErrorLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ message: 'Erro desconhecido', name: 'Error' });
    expect(logs[1]).toMatchObject({ message: 'Erro desconhecido', name: 'Error' });
  });

  it('trunca stack em 10.000 caracteres', async () => {
    const err = new Error('stack gigante');
    err.stack = 's'.repeat(11_000);
    await logError(err, { kind: 'render' });
    expect(getLocalErrorLogs()[0].stack).toHaveLength(10_000);
  });

  it('mensagem vazia em Error cai no default', async () => {
    const err = new Error('');
    await logError(err, { kind: 'render' });
    expect(getLocalErrorLogs()[0].message).toBe('Erro desconhecido');
  });

  it('uid do usuário logado vai no log; role permanece null (não é síncrono)', async () => {
    firebaseMock.auth.currentUser = { uid: 'user-42' };
    await logError(new Error('x'), { kind: 'render' });
    expect(getLocalErrorLogs()[0]).toMatchObject({ userId: 'user-42', userRole: null });
  });

  it('errorInfo vira componentStack e sai do context; extra é preservado', async () => {
    await logError(new Error('render crash'), {
      kind: 'render',
      errorInfo: { componentStack: '\n  em App' },
      extra: { tela: 'grupos' },
    });
    const entry = getLocalErrorLogs()[0];
    expect(entry.context.componentStack).toBe('\n  em App');
    expect((entry.context as Record<string, unknown>).errorInfo).toBeUndefined();
    expect(entry.context.extra).toEqual({ tela: 'grupos' });
  });

  it('inclui breadcrumbs atuais (com e sem data)', async () => {
    addBreadcrumb('ui', 'clique em salvar', { botao: 'salvar' });
    addBreadcrumb('navigation', 'abriu tela');
    await logError(new Error('x'), { kind: 'render' });

    const breadcrumbs = getLocalErrorLogs()[0].breadcrumbs;
    expect(breadcrumbs).toHaveLength(2);
    expect(breadcrumbs[0]).toMatchObject({
      category: 'ui',
      message: 'clique em salvar',
      data: { botao: 'salvar' },
    });
    expect(breadcrumbs[1]).toMatchObject({ category: 'navigation', message: 'abriu tela' });
    expect(breadcrumbs[1].data).toBeUndefined();
  });

  it('falha no Firestore não quebra logError nem perde o backup local', async () => {
    addDocMock.mockRejectedValue(new Error('permission-denied'));

    const errorId = await logError(new Error('x'), { kind: 'render' });

    expect(errorId).toMatch(/^[a-z0-9]{8}$/);
    expect(getLocalErrorLogs()).toHaveLength(1);
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
  });

  it('mantém no máximo 50 logs locais (descarta os mais antigos)', async () => {
    for (let i = 0; i < 55; i += 1) {
      await logError(new Error(`erro ${i}`), { kind: 'unknown' });
    }
    const logs = getLocalErrorLogs();
    expect(logs).toHaveLength(50);
    expect(logs[0].message).toBe('erro 5');
    expect(logs[49].message).toBe('erro 54');
  });

  it('QuotaExceededError aciona fallback que mantém metade + entrada nova', async () => {
    for (let i = 0; i < 3; i += 1) {
      await logError(new Error(`e${i}`), { kind: 'unknown' });
    }

    const originalSetItem = storage.setItem.bind(storage);
    let throwFirst = true;
    storage.setItem = ((key: string, value: string) => {
      if (throwFirst) {
        throwFirst = false;
        throw new Error('QuotaExceededError');
      }
      return originalSetItem(key, value);
    }) as typeof storage.setItem;

    await logError(new Error('com quota'), { kind: 'unknown' });

    // 3 antigas (< 25 da metade) + a nova
    const logs = getLocalErrorLogs();
    expect(logs).toHaveLength(4);
    expect(logs[3].message).toBe('com quota');
  });

  it('falha total de localStorage não lança e logError ainda retorna o id', async () => {
    storage.setItem = () => {
      throw new Error('quota');
    };

    const errorId = await logError(new Error('e'), { kind: 'unknown' });

    expect(errorId).toMatch(/^[a-z0-9]{8}$/);
    expect(getLocalErrorLogs()).toHaveLength(0);
  });

  describe('getLocalErrorLogs', () => {
    it('retorna [] quando não há logs', () => {
      expect(getLocalErrorLogs()).toEqual([]);
    });

    it('retorna [] com JSON corrompido (sem lançar)', () => {
      storage.setItem(STORAGE_KEY, '{json inválido');
      expect(getLocalErrorLogs()).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('lê de volta o que logError gravou', async () => {
      await logError(new Error('roundtrip'), { kind: 'route-not-found', attemptedPath: '/xyz' });
      const logs = getLocalErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].context.attemptedPath).toBe('/xyz');
    });
  });
});
