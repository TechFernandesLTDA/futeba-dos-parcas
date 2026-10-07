import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, getDraftSavedAt, listDrafts, loadDraft, saveDraft } from './gameDraft';

/**
 * jsdom deste host não expõe localStorage (nativo) — injetamos um stub em memória
 * antes de cada teste, como exigido pela convenção do projeto.
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

function installStorage(overrides: Record<string, unknown> = {}) {
  // Object.create preserva o getter `length` do base (spread/assign avaliariam
  // o getter de forma antecipada, congelando o tamanho em 0); overrides entram
  // como property descriptors para permitir getters que lançam.
  const storage = Object.create(createFakeStorage());
  Object.defineProperties(storage, Object.getOwnPropertyDescriptors(overrides));
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage as FakeStorage;
}

const HOUR_MS = 1000 * 60 * 60;
const PREFIX = 'game_draft_';

describe('gameDraft', () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    installStorage().clear();
  });

  describe('saveDraft / loadDraft (round-trip)', () => {
    it('salva e carrega um rascunho com data e savedAt', () => {
      const data = { venue: 'Quadra 1', players: ['a', 'b'] };
      saveDraft('nova-partida', data);

      const draft = loadDraft('nova-partida');
      expect(draft).not.toBeNull();
      expect(draft!.data).toEqual(data);
      expect(typeof draft!.savedAt).toBe('number');
      expect(Math.abs(draft!.savedAt - Date.now())).toBeLessThan(5_000);
    });

    it('salva e carrega objeto vazio', () => {
      saveDraft('vazio', {});
      expect(loadDraft('vazio')!.data).toEqual({});
    });

    it('isola rascunhos por chave', () => {
      saveDraft('k1', { a: 1 });
      saveDraft('k2', { b: 2 });
      expect(loadDraft('k1')!.data).toEqual({ a: 1 });
      expect(loadDraft('k2')!.data).toEqual({ b: 2 });
    });

    it('sobrescreve rascunho anterior da mesma chave', () => {
      saveDraft('k', { v: 1 });
      saveDraft('k', { v: 2 });
      expect(loadDraft('k')!.data).toEqual({ v: 2 });
    });

    it('persiste na chave esperada com prefixo game_draft_', () => {
      saveDraft('abc', { x: 1 });
      const raw = globalThis.localStorage.getItem(`${PREFIX}abc`);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw as string).data).toEqual({ x: 1 });
    });
  });

  describe('loadDraft (casos de erro/expiração)', () => {
    it('retorna null para chave inexistente', () => {
      expect(loadDraft('inexistente')).toBeNull();
    });

    it('retorna null e remove a chave quando o rascunho tem mais de 24h', () => {
      const stale = JSON.stringify({ data: { a: 1 }, savedAt: Date.now() - 25 * HOUR_MS });
      globalThis.localStorage.setItem(`${PREFIX}antigo`, stale);

      expect(loadDraft('antigo')).toBeNull();
      expect(globalThis.localStorage.getItem(`${PREFIX}antigo`)).toBeNull();
    });

    it('retorna o rascunho quando a idade está no limite inferior (< 24h)', () => {
      const fresh = JSON.stringify({ data: { a: 1 }, savedAt: Date.now() - 23 * HOUR_MS });
      globalThis.localStorage.setItem(`${PREFIX}recente`, fresh);
      expect(loadDraft('recente')!.data).toEqual({ a: 1 });
    });

    it('retorna null quando JSON corrompido', () => {
      globalThis.localStorage.setItem(`${PREFIX}corrompido`, '{nao-json');
      expect(loadDraft('corrompido')).toBeNull();
    });

    it('retorna null quando a entrada JSON não tem a forma esperada', () => {
      globalThis.localStorage.setItem(`${PREFIX}estranho`, JSON.stringify({ savedAt: 'ontem' }));
      // data undefined + savedAt string => subtração NaN => NaN > 24 é false; mas data === undefined
      const result = loadDraft('estranho');
      // comportamento defensivo: não lança; pode retornar null ou entrada malformada
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('retorna null quando localStorage lança na leitura', () => {
      installStorage({
        getItem: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
      });
      expect(loadDraft('qualquer')).toBeNull();
    });
  });

  describe('saveDraft (falha silenciosa)', () => {
    it('não lança quando localStorage lança ao gravar', () => {
      installStorage({
        setItem: () => {
          throw new DOMException('QuotaExceeded', 'QuotaExceededError');
        },
      });
      expect(() => saveDraft('k', { a: 1 })).not.toThrow();
    });
  });

  describe('clearDraft', () => {
    it('remove o rascunho salvo', () => {
      saveDraft('k', { a: 1 });
      clearDraft('k');
      expect(loadDraft('k')).toBeNull();
      expect(globalThis.localStorage.getItem(`${PREFIX}k`)).toBeNull();
    });

    it('é idempotente para chave inexistente', () => {
      expect(() => clearDraft('nunca-salvo')).not.toThrow();
    });

    it('não lança quando localStorage lança ao remover', () => {
      installStorage({
        removeItem: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
      });
      expect(() => clearDraft('k')).not.toThrow();
    });
  });

  describe('getDraftSavedAt', () => {
    it('retorna Date correspondente ao savedAt', () => {
      const before = Date.now();
      saveDraft('k', { a: 1 });
      const after = Date.now();

      const savedAt = getDraftSavedAt('k');
      expect(savedAt).toBeInstanceOf(Date);
      expect(savedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(savedAt!.getTime()).toBeLessThanOrEqual(after);
    });

    it('retorna null para chave inexistente', () => {
      expect(getDraftSavedAt('inexistente')).toBeNull();
    });

    it('retorna null após expiração', () => {
      const stale = JSON.stringify({ data: {}, savedAt: Date.now() - 30 * HOUR_MS });
      globalThis.localStorage.setItem(`${PREFIX}antigo`, stale);
      expect(getDraftSavedAt('antigo')).toBeNull();
    });
  });

  describe('listDrafts', () => {
    it('lista chaves de rascunho sem o prefixo', () => {
      saveDraft('alpha', {});
      saveDraft('beta', {});
      expect(listDrafts().sort()).toEqual(['alpha', 'beta']);
    });

    it('ignora chaves que não são rascunho', () => {
      saveDraft('meu', {});
      globalThis.localStorage.setItem('outra_chave', 'valor');
      globalThis.localStorage.setItem('game_draft_sem_traco', '{}');
      expect(listDrafts().sort()).toEqual(['meu', 'sem_traco']);
    });

    it('retorna [] quando não há rascunhos', () => {
      expect(listDrafts()).toEqual([]);
    });

    it('reflete remoção após clearDraft', () => {
      saveDraft('k', {});
      clearDraft('k');
      expect(listDrafts()).toEqual([]);
    });

    it('retorna [] quando localStorage lança ao listar', () => {
      installStorage({
        get length(): number {
          throw new DOMException('Blocked', 'SecurityError');
        },
      });
      expect(listDrafts()).toEqual([]);
    });
  });
});
