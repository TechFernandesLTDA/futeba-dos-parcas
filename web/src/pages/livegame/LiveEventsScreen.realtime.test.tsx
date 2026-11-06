import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface EventDocument {
  id: string;
  ref: { kind: 'event'; id: string; deleted?: boolean };
  data: () => Record<string, unknown>;
}

interface EventSnapshot {
  docs: EventDocument[];
  size: number;
  docChanges: () => Array<{ type: 'added' | 'modified' | 'removed'; doc: EventDocument }>;
}

interface EventSubscription {
  next: (snapshot: EventSnapshot) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const mockOnSnapshot = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockOrderBy = vi.fn((field?: unknown, direction?: string) => ({ field, direction }));
const mockLimit = vi.fn((value?: unknown) => ({ limit: value }));
const mockStartAfter = vi.fn((cursor?: unknown) => ({ cursor }));
const eventSubscriptions: EventSubscription[] = [];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  documentId: vi.fn(() => '__name__'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  query: vi.fn((base: { path: string }, ...constraints: unknown[]) => ({ base, constraints })),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  where: vi.fn((...parts: unknown[]) => ({ where: parts })),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/cloudFunctions', () => ({ submitLiveGameEvent: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer-1' } }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showError: vi.fn() }) }));
vi.mock('../../hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));
vi.mock('../../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (error: unknown, fallback?: string) =>
    error instanceof Error ? error.message : fallback ?? 'Erro',
}));
vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (raw: Record<string, unknown>) => ({
    eventType: raw.event_type,
    playerId: raw.player_id,
    playerName: raw.player_name,
    teamId: raw.team_id,
    ownerId: raw.owner_id,
    name: raw.name,
    color: raw.color,
    score: raw.score,
  }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ gameId: 'game-1' }) };
});

import { LiveEventsScreen } from './LiveEventsScreen';
import { submitLiveGameEvent } from '../../services/cloudFunctions';

function eventDoc(id: string, playerName = `Jogador ${id}`): EventDocument {
  return {
    id,
    ref: { kind: 'event', id },
    data: () => ({
      game_id: 'game-1',
      event_type: 'GOAL',
      player_id: `player-${id}`,
      player_name: playerName,
      minute: 10,
      created_at: { toDate: () => new Date(1_000) },
    }),
  };
}

function snapshot(
  docs: EventDocument[],
  changes: EventSnapshot['docChanges'] extends () => infer T ? T : never = [],
): EventSnapshot {
  return { docs, size: docs.length, docChanges: () => changes };
}

function renderScreen() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <LiveEventsScreen />
    </ThemeProvider>,
  );
}

describe('LiveEventsScreen realtime pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventSubscriptions.length = 0;
    mockGetDoc.mockImplementation(async (reference: { path?: string; kind?: string; deleted?: boolean }) => {
      if (reference.kind === 'event') return { exists: () => !reference.deleted };
      return { exists: () => false };
    });
    mockOnSnapshot.mockImplementation(
      (
        reference: { base?: { path?: string }; path?: string },
        next: (value: EventSnapshot) => void,
        error: (reason: Error) => void,
      ) => {
        const unsubscribe = vi.fn();
        const path = reference.base?.path ?? reference.path;
        if (path === 'game_events') {
          eventSubscriptions.push({ next, error, unsubscribe });
        } else {
          next(snapshot([]));
        }
        return unsubscribe;
      },
    );
  });

  it('pagina além de 50, preserva cursor e faz merge de create/update/delete sem duplicatas', async () => {
    const initialDocs = Array.from({ length: 50 }, (_, index) => eventDoc(`live-${50 - index}`));
    const olderDocs = Array.from({ length: 50 }, (_, index) => eventDoc(`old-${50 - index}`));
    mockGetDocs
      .mockResolvedValueOnce(snapshot(olderDocs))
      .mockResolvedValueOnce(snapshot([]));

    const { unmount } = renderScreen();
    expect(eventSubscriptions).toHaveLength(1);
    await act(async () => {
      eventSubscriptions[0].next(snapshot(initialDocs));
    });

    const eventList = screen.getByRole('list', { name: /eventos do jogo/i });
    const initialNames = within(eventList).getAllByText(/Jogador live-/);
    expect(initialNames).toHaveLength(50);
    expect(initialNames[0]).toHaveTextContent('Jogador live-50');
    expect(initialNames[1]).toHaveTextContent('Jogador live-49');
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
    expect(mockOrderBy).toHaveBeenCalledWith('__name__', 'desc');

    const loadMoreButton = screen.getByRole('button', { name: /carregar mais/i });
    await act(async () => {
      fireEvent.click(loadMoreButton);
    });
    expect(screen.getByText('Jogador old-1')).toBeInTheDocument();
    expect(mockStartAfter).toHaveBeenNthCalledWith(1, initialDocs[initialDocs.length - 1]);

    const shiftedDoc = eventDoc('live-1');
    shiftedDoc.ref.deleted = false;
    const deletedDoc = eventDoc('live-25');
    deletedDoc.ref.deleted = true;
    const nextLiveDocs = [
      eventDoc('live-51'),
      ...Array.from({ length: 25 }, (_, index) => {
        const id = `live-${50 - index}`;
        return eventDoc(id, id === 'live-30' ? 'Jogador live-30 atualizado' : undefined);
      }),
      ...Array.from({ length: 23 }, (_, index) => eventDoc(`live-${24 - index}`)),
      olderDocs[0],
    ];
    await act(async () => {
      eventSubscriptions[0].next(snapshot(nextLiveDocs, [
        { type: 'removed', doc: shiftedDoc },
        { type: 'removed', doc: deletedDoc },
      ]));
    });

    expect(screen.getByText('Jogador live-51')).toBeInTheDocument();
    expect(screen.getByText('Jogador live-30 atualizado')).toBeInTheDocument();
    expect(screen.queryByText('Jogador live-25')).not.toBeInTheDocument();
    expect(screen.getByText('Jogador live-1')).toBeInTheDocument();
    expect(screen.getAllByText('Jogador old-50')).toHaveLength(1);

    await act(async () => {
      fireEvent.click(loadMoreButton);
    });
    expect(mockStartAfter).toHaveBeenNthCalledWith(2, olderDocs[olderDocs.length - 1]);
    expect(screen.queryByRole('button', { name: /carregar mais/i })).not.toBeInTheDocument();

    unmount();
    expect(eventSubscriptions[0].unsubscribe).toHaveBeenCalledOnce();
  });

  it('exibe erro, reconecta por retry e limpa os dois listeners', async () => {
    const { unmount } = renderScreen();
    const firstSubscription = eventSubscriptions[0];
    await act(async () => {
      firstSubscription.error(new Error('offline'));
    });

    expect(screen.getByText('offline')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    });
    expect(eventSubscriptions).toHaveLength(2);
    expect(firstSubscription.unsubscribe).toHaveBeenCalledOnce();

    await act(async () => {
      eventSubscriptions[1].next(snapshot([eventDoc('reconnected')]));
    });
    expect(screen.getByText('Jogador reconnected')).toBeInTheDocument();
    expect(screen.queryByText('offline')).not.toBeInTheDocument();

    unmount();
    expect(eventSubscriptions[1].unsubscribe).toHaveBeenCalledOnce();
  });

  it('reutiliza o requestId quando o envio falha e o usuario tenta novamente', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ owner_id: 'viewer-1' }),
    });
    mockOnSnapshot.mockImplementation(
      (
        reference: { base?: { path?: string }; path?: string },
        next: (value: EventSnapshot) => void,
        error: (reason: Error) => void,
      ) => {
        const unsubscribe = vi.fn();
        const path = reference.base?.path ?? reference.path;
        if (path === 'game_events') {
          eventSubscriptions.push({ next, error, unsubscribe });
          next(snapshot([]));
        } else if (path === 'teams') {
          next(snapshot([{
            id: 'team-1',
            ref: { kind: 'event', id: 'team-1' },
            data: () => ({ game_id: 'game-1', name: 'Time A', player_ids: ['player-1'] }),
          }]));
        } else if (path === 'confirmations') {
          next(snapshot([{
            id: 'game-1_player-1',
            ref: { kind: 'event', id: 'game-1_player-1' },
            data: () => ({
              game_id: 'game-1',
              user_id: 'player-1',
              user_name: 'Jogador Um',
              status: 'CONFIRMED',
              team_id: 'team-1',
            }),
          }]));
        }
        return unsubscribe;
      },
    );
    vi.mocked(submitLiveGameEvent)
      .mockRejectedValueOnce(new Error('resposta perdida'))
      .mockResolvedValueOnce({ success: true } as never);

    await act(async () => {
      renderScreen();
    });
    const [openButton] = screen.getAllByRole('button', { name: /adicionar evento/i });
    await act(async () => {
      fireEvent.click(openButton);
    });
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Jogador confirmado' }));
    fireEvent.click(await screen.findByRole('option', { name: /Jogador Um/ }));
    const submit = within(dialog).getByRole('button', { name: /^adicionar$/i });

    await act(async () => {
      fireEvent.click(submit);
    });
    expect(submitLiveGameEvent).toHaveBeenCalledTimes(1);
    expect(submit).toBeEnabled();
    await act(async () => {
      fireEvent.click(submit);
    });
    expect(submitLiveGameEvent).toHaveBeenCalledTimes(2);

    const firstId = vi.mocked(submitLiveGameEvent).mock.calls[0]?.[0]?.requestId;
    const retryId = vi.mocked(submitLiveGameEvent).mock.calls[1]?.[0]?.requestId;
    expect(firstId).toBeTruthy();
    expect(retryId).toBe(firstId);
  });
});
