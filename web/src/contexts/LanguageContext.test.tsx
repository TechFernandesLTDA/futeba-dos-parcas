// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * jsdom deste host não expõe window.localStorage (nativo) — injetamos um stub
 * em memória antes de cada teste (convenção: ver web/src/utils/gameDraft.test.ts).
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

function installStorage(overrides: Record<string, unknown> = {}) {
  const storage = Object.create(createFakeStorage());
  Object.defineProperties(storage, Object.getOwnPropertyDescriptors(overrides));
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

const STORAGE_KEY = 'i18nextLng';

// Mocks do i18n do react-i18next — controlamos changeLanguage e os eventos.
const mockChangeLanguage = vi.fn(async () => {});
const mockI18nOn = vi.fn();
const mockI18nOff = vi.fn();
const mockI18n = { changeLanguage: mockChangeLanguage, on: mockI18nOn, off: mockI18nOff };

const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

// Handlers 'languageChanged' capturados durante o render do provider.
const languageChangeHandlers: Array<(lng: string) => void> = [];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: mockI18n }),
}));

// O '../i18n' real inicializa i18next com LanguageDetector (não determinístico
// em jsdom) — exportamos mock de loadLanguageResources para testar setLanguage.
vi.mock('../i18n', () => ({
  loadLanguageResources: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...segments: unknown[]) => ({
    id: String(segments[segments.length - 1]),
    path: segments.filter((s) => typeof s === 'string').join('/'),
  })),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
}));

import { LanguageProvider, useLanguage, syncLanguageToFirestore, loadLanguageFromFirestore } from './LanguageContext';

function renderLanguageHook() {
  return renderHook(() => useLanguage(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider>{children}</LanguageProvider>
    ),
  });
}

describe('LanguageContext — LanguageProvider / useLanguage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    languageChangeHandlers.length = 0;
    installStorage();
    mockI18nOn.mockImplementation((_event: string, handler: (lng: string) => void) => {
      languageChangeHandlers.push(handler);
    });
  });

  it('usa pt-BR como idioma padrão quando localStorage está vazio', () => {
    const { result } = renderLanguageHook();
    expect(result.current.language).toBe('pt-BR');
  });

  it('lê o idioma salvo em localStorage (i18nextLng)', () => {
    installStorage();
    globalThis.localStorage.setItem(STORAGE_KEY, 'es');
    const { result } = renderLanguageHook();
    expect(result.current.language).toBe('es');
  });

  it('faz fallback para pt-BR quando localStorage lança na leitura', () => {
    installStorage({
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    const { result } = renderLanguageHook();
    expect(result.current.language).toBe('pt-BR');
  });

  it('setLanguage atualiza o estado, troca o idioma do i18n e persiste', async () => {
    const { result } = renderLanguageHook();
    await act(async () => {
      await result.current.setLanguage('en');
    });
    expect(result.current.language).toBe('en');
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe('en');
  });

  it('setLanguage não lança quando localStorage lança ao gravar', async () => {
    installStorage({
      setItem: () => {
        throw new DOMException('QuotaExceeded', 'QuotaExceededError');
      },
    });
    const { result } = renderLanguageHook();
    await expect(act(async () => {
      await result.current.setLanguage('en');
    })).resolves.toBeUndefined();
    // O estado e o changeLanguage ainda são aplicados.
    expect(result.current.language).toBe('en');
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('setLanguage persiste com falha silenciosa (warn no console)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installStorage({
      setItem: () => {
        throw new Error('quota');
      },
    });
    const { result } = renderLanguageHook();
    await act(async () => {
      await result.current.setLanguage('en');
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('atualiza o idioma quando i18n emite languageChanged', () => {
    const { result } = renderLanguageHook();
    act(() => {
      for (const handler of languageChangeHandlers) handler('es');
    });
    expect(result.current.language).toBe('es');
  });

  it('remove o listener languageChanged no unmount', () => {
    const { unmount } = renderLanguageHook();
    expect(mockI18nOn).toHaveBeenCalledWith('languageChanged', expect.any(Function));
    const handler = mockI18nOn.mock.calls[0][1];
    unmount();
    expect(mockI18nOff).toHaveBeenCalledWith('languageChanged', handler);
  });

  it('reflete o idioma em document.documentElement.lang', async () => {
    const { result } = renderLanguageHook();
    expect(document.documentElement.lang).toBe('pt-BR');
    await act(async () => {
      await result.current.setLanguage('es');
    });
    expect(document.documentElement.lang).toBe('es');
  });

  it('lança erro ao usar useLanguage fora do provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function attempt() {
      renderHook(() => useLanguage());
    }
    expect(attempt).toThrow('useLanguage must be used within LanguageProvider');
    errorSpy.mockRestore();
  });
});

describe('syncLanguageToFirestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installStorage();
  });

  it('usa updateDoc no caminho users/{uid}/preferences/language', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await syncLanguageToFirestore('user-1', 'en');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/preferences/language' }),
      { language: 'en' },
    );
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('faz fallback para setDoc quando updateDoc falha (doc ainda não existe)', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('not-found'));
    mockSetDoc.mockResolvedValue(undefined);
    await syncLanguageToFirestore('user-1', 'es');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/preferences/language' }),
      { language: 'es' },
    );
  });

  it('falha silenciosamente quando updateDoc e setDoc falham (offline)', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('offline'));
    mockSetDoc.mockRejectedValue(new Error('offline'));
    await expect(syncLanguageToFirestore('user-1', 'en')).resolves.toBeUndefined();
  });
});

describe('loadLanguageFromFirestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installStorage();
  });

  it('retorna o idioma salvo no documento', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ language: 'en' }) });
    await expect(loadLanguageFromFirestore('user-1')).resolves.toBe('en');
  });

  it('retorna null quando o documento não existe', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    await expect(loadLanguageFromFirestore('user-1')).resolves.toBeNull();
  });

  it('retorna null em caso de erro (fallback para localStorage)', async () => {
    mockGetDoc.mockRejectedValue(new Error('offline'));
    await expect(loadLanguageFromFirestore('user-1')).resolves.toBeNull();
  });

  it('aguarda resolução antes de responder (não resolve vazio)', async () => {
    let resolveGetDoc!: (v: unknown) => void;
    mockGetDoc.mockReturnValue(
      new Promise((resolve) => {
        resolveGetDoc = resolve;
      }),
    );
    const promise = loadLanguageFromFirestore('user-1');
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveGetDoc({ exists: () => true, data: () => ({ language: 'es' }) });
    await waitFor(() => expect(settled).toBe(true));
    await expect(promise).resolves.toBe('es');
  });
});