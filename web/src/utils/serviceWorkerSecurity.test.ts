import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const repoRoot = resolve(process.cwd(), '..');
const workerSource = readFileSync(resolve(repoRoot, 'web/public/sw.js'), 'utf8');
const APP_ORIGIN = 'https://futebadosparcas.com.br';

interface TestFetchEvent {
  request: {
    method: string;
    mode: string;
    url: string;
  };
  respondWith: ReturnType<typeof vi.fn>;
}

type FetchHandler = (event: TestFetchEvent) => void;

function loadFetchHandler(): FetchHandler {
  const listeners = new Map<string, (event: unknown) => void>();
  const response = {ok: true, clone: () => response};
  const cache = {addAll: vi.fn(), put: vi.fn()};

  runInNewContext(workerSource, {
    URL,
    Response,
    Promise,
    console,
    fetch: vi.fn().mockResolvedValue(response),
    caches: {
      delete: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue(response),
      open: vi.fn().mockResolvedValue(cache),
    },
    self: {
      location: {origin: APP_ORIGIN},
      clients: {claim: vi.fn()},
      skipWaiting: vi.fn(),
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners.set(type, handler);
      },
    },
  });

  const handler = listeners.get('fetch');
  if (!handler) throw new Error('fetch handler não registrado pelo service worker');
  return handler as FetchHandler;
}

function createEvent(url: string, mode = 'cors'): TestFetchEvent {
  return {
    request: {method: 'GET', mode, url},
    respondWith: vi.fn(),
  };
}

describe('service worker origin boundary', () => {
  it.each([
    'https://evilgoogleapis.com/assets/app.js',
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
    'https://cdn.example.com/assets/app.js',
    'chrome-extension://extension-id/assets/app.js',
    'not-a-url',
  ])('não intercepta recursos fora da origem do aplicativo: %s', (url) => {
    const event = createEvent(url);
    loadFetchHandler()(event);
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('mantém o cache de assets da origem exata do aplicativo', () => {
    const event = createEvent(`${APP_ORIGIN}/assets/app-123.js`);
    loadFetchHandler()(event);
    expect(event.respondWith).toHaveBeenCalledTimes(1);
  });

  it('mantém network-first para navegação da origem exata', () => {
    const event = createEvent(`${APP_ORIGIN}/game/123`, 'navigate');
    loadFetchHandler()(event);
    expect(event.respondWith).toHaveBeenCalledTimes(1);
  });
});
