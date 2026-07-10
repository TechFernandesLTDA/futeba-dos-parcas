import { act, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  snapshotNext: undefined as undefined | ((snapshot: unknown) => void),
  unsubscribe: vi.fn(),
  navigate: vi.fn(),
  getUsersByIds: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id })),
  onSnapshot: vi.fn((_ref: unknown, next: (snapshot: unknown) => void) => {
    mocks.snapshotNext = next;
    return mocks.unsubscribe;
  }),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../hooks/useNavigateBack', () => ({ useNavigateBack: () => mocks.navigate }));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'viewer-1' } }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));
vi.mock('../../utils/userBatch', () => ({
  getUsersByIds: (...args: unknown[]) => mocks.getUsersByIds(...args),
}));
vi.mock('../../components/reactions/ReactionBar', () => ({ ReactionBar: () => null }));
vi.mock('./GameCommentsPanel', () => ({ GameCommentsPanel: () => null }));
vi.mock('../../components/common/GameCard', () => ({
  LoadingState: () => <div>Carregando</div>,
  PlayerAvatar: ({ name }: { name: string }) => <div aria-label={`avatar-${name}`} />,
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ gameId: 'game-1' }),
  };
});

import { VoteResultScreen } from './VoteResultScreen';

function emitGame(data: Record<string, unknown>) {
  act(() => {
    mocks.snapshotNext?.({
      exists: () => true,
      data: () => data,
    });
  });
}

describe('VoteResultScreen realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.snapshotNext = undefined;
    mocks.getUsersByIds.mockImplementation(async (ids: string[]) => new Map(
      ids.map((id) => [id, { id, name: `Jogador ${id}`, photoUrl: `${id}.jpg` }]),
    ));
  });

  it('atualiza placar e agregados autoritativos quando o snapshot do jogo muda', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <VoteResultScreen />
        </ThemeProvider>
      </MemoryRouter>,
    );

    emitGame({
      team1_score: 1,
      team2_score: 0,
      winner_team: 'A',
      mvp_id: 'mvp-1',
      mvp_votes: 2,
      voting_concluded_at: { toDate: () => new Date() },
    });

    expect(await screen.findByText('Jogador mvp-1')).toBeInTheDocument();
    expect(screen.getByText('2 votos')).toBeInTheDocument();

    emitGame({
      team1_score: 1,
      team2_score: 2,
      winner_team: 'B',
      mvp_id: 'mvp-2',
      mvp_votes: 3,
      best_gk_id: 'gk-1',
      best_gk_votes: 2,
      worst_player_id: 'worst-1',
      worst_player_votes: 4,
      voting_concluded_at: { toDate: () => new Date() },
    });

    await waitFor(() => expect(screen.getByText('Jogador mvp-2')).toBeInTheDocument());
    expect(screen.queryByText('Jogador mvp-1')).not.toBeInTheDocument();
    expect(screen.getByText('Jogador gk-1')).toBeInTheDocument();
    expect(screen.getByText('Jogador worst-1')).toBeInTheDocument();
    expect(screen.getByText('4 votos')).toBeInTheDocument();
  });

  it('remove o listener ao desmontar', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <VoteResultScreen />
        </ThemeProvider>
      </MemoryRouter>,
    );

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
