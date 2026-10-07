import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

const {
  getDocsMock,
  collectionMock,
  queryMock,
  whereMock,
  limitMock,
  dbMock,
} = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  collectionMock: vi.fn((...args: unknown[]) => ({ kind: 'collection', args })),
  queryMock: vi.fn((...args: unknown[]) => ({ kind: 'query', args })),
  whereMock: vi.fn((...args: unknown[]) => ({ kind: 'where', args })),
  limitMock: vi.fn((n: number) => ({ kind: 'limit', n })),
  dbMock: { app: 'test-db' },
}));

// Mantém o Timestamp REAL (mapFirestoreDoc usa `instanceof Timestamp`);
// só substituímos as funções de consulta.
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: collectionMock,
    getDocs: getDocsMock,
    limit: limitMock,
    query: queryMock,
    where: whereMock,
  };
});

vi.mock('./firebase', () => ({ db: dbMock }));

import { fetchReleaseNotes, WEB_PLATFORM } from './releaseNotes';

const fetchMock = vi.fn();

function givenFallbackBundle(bundle: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => bundle });
}

function givenRemoteDocs(docs: Array<Record<string, unknown>>) {
  getDocsMock.mockResolvedValue({ docs: docs.map((d) => ({ data: () => d })) });
}

function bundledNote(overrides: Record<string, unknown> = {}) {
  return { version: '1.0.0', published: true, headline: 'h', ...overrides };
}

describe('releaseNotes (service)', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    collectionMock.mockClear();
    queryMock.mockClear();
    whereMock.mockClear();
    limitMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    // fallback padrão: bundle vazio — para não poluir testes que só olham o Firestore
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ platform: WEB_PLATFORM, notes: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consulta Firestore com filtro de plataforma e limite 30', async () => {
    givenRemoteDocs([]);

    await fetchReleaseNotes('web');

    expect(collectionMock).toHaveBeenCalledWith(dbMock, 'release_notes');
    expect(whereMock).toHaveBeenCalledWith('platform', '==', 'web');
    expect(limitMock).toHaveBeenCalledWith(30);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]).toHaveLength(3);
  });

  it('sem argumento usa a plataforma web', async () => {
    givenRemoteDocs([]);

    const notes = await fetchReleaseNotes();

    expect(WEB_PLATFORM).toBe('web');
    expect(whereMock).toHaveBeenCalledWith('platform', '==', 'web');
    expect(notes).toEqual([]);
  });

  it('mapeia documento aninhado pt-BR para ReleaseNote', async () => {
    givenRemoteDocs([
      {
        platform: 'web',
        version: '1.57.0',
        buildNumber: 42,
        releaseDate: Timestamp.fromMillis(1_750_000_000_000),
        type: 'MAJOR',
        published: true,
        issueRefs: [12, 'x', 34],
        displayConfig: { showPopup: true },
        content: {
          'pt-BR': {
            headline: 'Novidades de outubro',
            highlights: [{ icon: '🚀', title: 'Ranking', description: 'Novo ranking' }],
            sections: { added: ['A'], improved: ['I'], fixed: ['F'] },
          },
        },
      },
    ]);

    const [note] = await fetchReleaseNotes('web');

    expect(note).toEqual({
      platform: 'web',
      version: '1.57.0',
      buildNumber: 42,
      releaseDate: 1_750_000_000_000,
      type: 'major',
      headline: 'Novidades de outubro',
      highlights: [{ icon: '🚀', title: 'Ranking', description: 'Novo ranking' }],
      added: ['A'],
      improved: ['I'],
      fixed: ['F'],
      issueRefs: [12, 34],
      showPopup: true,
    });
  });

  it('documento mínimo cai em defaults seguros; published:false é descartado', async () => {
    givenRemoteDocs([
      { published: false, version: '0.0.1', platform: 'web' },
      {},
    ]);

    const notes = await fetchReleaseNotes('web');

    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual({
      platform: '',
      version: '',
      buildNumber: null,
      releaseDate: 0,
      type: 'minor',
      headline: '',
      highlights: [],
      added: [],
      improved: [],
      fixed: [],
      issueRefs: [],
      showPopup: false,
    });
  });

  it('releaseDate aceita Timestamp real, toDate(), seconds e lixo', async () => {
    givenRemoteDocs([
      { version: '4', releaseDate: Timestamp.fromMillis(1_000) },
      { version: '3', releaseDate: { toDate: () => new Date(2_000) } },
      { version: '2', releaseDate: { seconds: 5 } },
      { version: '1', releaseDate: 'não-sou-data' },
    ]);

    const notes = await fetchReleaseNotes('web');
    const byVersion = Object.fromEntries(notes.map((n) => [n.version, n.releaseDate]));

    expect(byVersion['4']).toBe(1_000);
    expect(byVersion['3']).toBe(2_000);
    expect(byVersion['2']).toBe(5_000);
    expect(byVersion['1']).toBe(0);
  });

  it('ordena por SemVer numérico (1.100.0 > 1.57.0 > 1.9.0; prefixo "v" é preservado)', async () => {
    givenRemoteDocs([{ version: '1.9.0' }, { version: '1.57.0' }, { version: 'v1.100.0' }]);

    const versions = (await fetchReleaseNotes('web')).map((n) => n.version);

    expect(versions).toEqual(['v1.100.0', '1.57.0', '1.9.0']);
  });

  it('usa Firestore como fonte e mergeia fallback sem duplicar versões', async () => {
    givenRemoteDocs([
      { platform: 'web', version: '2.0.0', published: true },
      { platform: 'web', version: '1.57.0', published: true },
    ]);
    givenFallbackBundle({
      platform: 'web',
      notes: [
        bundledNote({ version: '1.57.0' }), // duplicada — descartada
        bundledNote({ version: '1.40.0' }),
      ],
    });

    const notes = await fetchReleaseNotes('web');

    expect(notes.map((n) => n.version)).toEqual(['2.0.0', '1.57.0', '1.40.0']);
  });

  it('degrada para o fallback embarcado quando o Firestore falha', async () => {
    getDocsMock.mockRejectedValue(new Error('indisponível'));
    givenFallbackBundle({
      platform: 'web',
      notes: [bundledNote({ version: '1.2.0' }), bundledNote({ version: '1.10.0' })],
    });

    const notes = await fetchReleaseNotes('web');

    expect(notes.map((n) => n.version)).toEqual(['1.10.0', '1.2.0']);
    expect(notes[0].platform).toBe('web');
  });

  it('lança quando o Firestore falha e o fallback não tem notas', async () => {
    getDocsMock.mockRejectedValue(new Error('offline'));
    givenFallbackBundle({ platform: 'web', notes: [] });

    await expect(fetchReleaseNotes('web')).rejects.toThrow('offline');
  });

  it('fallback indisponível (fetch rejeita) não derruba o Firestore OK', async () => {
    fetchMock.mockRejectedValue(new Error('sem rede'));
    givenRemoteDocs([{ version: '1.0.0', platform: 'web' }]);

    const notes = await fetchReleaseNotes('web');

    expect(notes.map((n) => n.version)).toEqual(['1.0.0']);
  });

  it('HTTP não-ok no fallback devolve lista vazia sem lançar', async () => {
    givenRemoteDocs([]);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    const notes = await fetchReleaseNotes('web');

    expect(notes).toEqual([]);
  });

  it('ignora bundle de outra plataforma', async () => {
    givenRemoteDocs([{ version: '1.0.0', platform: 'web' }]);
    givenFallbackBundle({ platform: 'android', notes: [bundledNote({ version: '9.9.9' })] });

    const notes = await fetchReleaseNotes('web');

    expect(notes.map((n) => n.version)).toEqual(['1.0.0']);
  });

  it('filtra notas não publicadas do fallback', async () => {
    givenRemoteDocs([]);
    givenFallbackBundle({
      platform: 'web',
      notes: [bundledNote({ version: '2.0.0' }), bundledNote({ version: '1.0.0', published: false })],
    });

    const notes = await fetchReleaseNotes('web');

    expect(notes.map((n) => n.version)).toEqual(['2.0.0']);
  });

  it('normaliza highlights, listas mistas, tipo e datas do fallback', async () => {
    givenRemoteDocs([]);
    givenFallbackBundle({
      platform: 'web',
      notes: [
        {
          version: '1.0.0',
          type: 'PATCH',
          added: ['ok', 42, null, 'outro'],
          improved: 'não-lista',
          fixed: [1, 2],
          issueRefs: ['7', 8],
          highlights: [{ title: 'T' }, null],
          releaseDate: '2026-05-22',
          showPopup: true,
        },
      ],
    });

    const [note] = await fetchReleaseNotes('web');

    expect(note.type).toBe('patch');
    // Listas do fallback passam SEM filtro (diferente do caminho Firestore):
    expect(note.added).toEqual(['ok', 42, null, 'outro']);
    expect(note.improved).toEqual('não-lista');
    expect(note.fixed).toEqual([1, 2]);
    expect(note.issueRefs).toEqual(['7', 8]);
    expect(note.highlights).toEqual([
      { icon: '', title: 'T', description: '' },
      { icon: '', title: '', description: '' },
    ]);
    // ISO date-only → meia-noite UTC
    expect(note.releaseDate).toBe(Date.UTC(2026, 4, 22));
    expect(note.showPopup).toBe(true);
    expect(note.buildNumber).toBeNull();
  });

  it('buildNumber numérico do fallback é preservado; string vira null', async () => {
    givenRemoteDocs([]);
    givenFallbackBundle({
      platform: 'web',
      notes: [bundledNote({ version: '1.0.0', buildNumber: 7 }), bundledNote({ version: '0.9.0', buildNumber: '7' })],
    });

    const notes = await fetchReleaseNotes('web');

    expect(notes[0].buildNumber).toBe(7);
    expect(notes[1].buildNumber).toBeNull();
  });

  it('releaseDate inválida no fallback cai em 0', async () => {
    givenRemoteDocs([]);
    givenFallbackBundle({
      platform: 'web',
      notes: [bundledNote({ version: '1.0.0', releaseDate: 'data-quebrada' })],
    });

    const [note] = await fetchReleaseNotes('web');

    expect(note.releaseDate).toBe(0);
  });
});
