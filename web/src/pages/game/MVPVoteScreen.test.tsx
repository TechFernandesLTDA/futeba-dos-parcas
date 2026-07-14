import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showError: vi.fn(),
  submitMvpVotes: vi.fn(),
  voteDocs: {} as Record<string, string>,
}));

const confirmations = [
  { status: 'CONFIRMED', userId: 'voter-1', userName: 'Eleitor', position: 'FIELD' },
  { status: 'CONFIRMED', userId: 'player-a', userName: 'Jogador A', position: 'GOALKEEPER' },
  { status: 'CONFIRMED', userId: 'player-b', userName: 'Jogador B', position: 'FIELD' },
];

vi.mock('@mui/icons-material', () => ({
  ArrowBack: () => null,
  HowToVote: () => null,
  EmojiEvents: () => null,
  SentimentVeryDissatisfied: () => null,
  PersonOff: () => null,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    kind: 'doc',
    collectionName,
    id,
  })),
  collection: vi.fn((_db: unknown, collectionName: string) => ({
    kind: 'collection',
    collectionName,
  })),
  where: vi.fn(() => ({ kind: 'where' })),
  query: vi.fn((ref: unknown) => ref),
  onSnapshot: vi.fn((
    ref: { collectionName: string; id?: string },
    next: (snapshot: unknown) => void,
  ) => {
    if (ref.collectionName === 'games') {
      next({
        exists: () => true,
        id: ref.id,
        data: () => ({
          status: 'FINISHED',
          votingStatus: 'OPEN',
          ownerId: 'owner-1',
          dateTime: new Date(),
        }),
      });
    } else if (ref.collectionName === 'confirmations') {
      next({
        docs: confirmations.map((data, index) => ({
          id: `confirmation-${index}`,
          data: () => data,
        })),
      });
    } else if (ref.collectionName === 'mvp_votes') {
      const votedPlayerId = mocks.voteDocs[ref.id ?? ''];
      next({
        exists: () => Boolean(votedPlayerId),
        data: () => ({ voted_player_id: votedPlayerId }),
      });
    }
    return vi.fn();
  }),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/cloudFunctions', () => ({
  concludeMvpVoting: vi.fn(),
  submitMvpVotes: (...args: unknown[]) => mocks.submitMvpVotes(...args),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'voter-1' },
    user: { id: 'voter-1', role: 'PLAYER' },
  }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: mocks.showError }),
}));
vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => mocks.navigate,
}));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
vi.mock('../../utils/firestoreHelpers', () => ({ snakeToCamel: (value: unknown) => value }));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../components/common/GameCard', () => ({
  PlayerAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));
vi.mock('../../components/team/TeamBadge', () => ({ TeamBadge: () => null }));
vi.mock('../../components/common/EmptyState', () => ({ EmptyState: () => null }));
vi.mock('../../components/layout', () => ({
  FixedBottomBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../components/common/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../../components/common/PageContainer', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-1' }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    const translations = {
      'a11y.mvpCandidates': 'Candidatos a MVP',
      'a11y.bestGoalkeeperCandidates': 'Candidatos a melhor goleiro',
      'a11y.worstPlayerCandidates': 'Candidatos a Bola Murcha',
      'mvp.conflictingVotesHelp': 'O mesmo jogador não pode ser destaque e Bola Murcha.',
      'mvp.conflictingCandidate': 'Indisponível porque já foi escolhido na categoria oposta',
      'mvp.submitVote': 'Enviar voto',
    } as Record<string, string>;
    const t = (key: string) => translations[key] || key;
    return () => ({ t });
  })(),
}));

import { MVPVoteScreen } from './MVPVoteScreen';
import { hasContradictoryVoteSelection } from './mvpVoteSemantics';

const renderScreen = () => render(
  <ThemeProvider theme={createTheme()}>
    <MVPVoteScreen />
  </ThemeProvider>,
);

describe('MVPVoteScreen ballot semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.voteDocs = {};
    mocks.submitMvpVotes.mockResolvedValue({ data: { ballotComplete: true } });
  });

  it('desabilita Bola Murcha para quem já foi escolhido como MVP', async () => {
    const user = userEvent.setup();
    renderScreen();

    const mvpList = await screen.findByRole('list', { name: 'Candidatos a MVP' });
    const worstList = screen.getByRole('list', { name: 'Candidatos a Bola Murcha' });
    await user.click(within(mvpList).getByRole('radio', { name: 'Jogador A' }));

    const conflictingRadio = within(worstList).getByRole('radio', { name: 'Jogador A' });
    expect(conflictingRadio).toBeDisabled();
    expect(conflictingRadio).toHaveAttribute('aria-describedby', 'vote-conflict-help');
    expect(screen.getByText('Indisponível porque já foi escolhido na categoria oposta')).toBeInTheDocument();
  });

  it('preserva a escolha do mesmo goleiro como MVP e melhor goleiro', async () => {
    const user = userEvent.setup();
    renderScreen();

    const mvpList = await screen.findByRole('list', { name: 'Candidatos a MVP' });
    const goalkeeperList = screen.getByRole('list', { name: 'Candidatos a melhor goleiro' });
    await user.click(within(mvpList).getByRole('radio', { name: 'Jogador A' }));

    const goalkeeperRadio = within(goalkeeperList).getByRole('radio', { name: 'Jogador A' });
    expect(goalkeeperRadio).toBeEnabled();
    await user.click(goalkeeperRadio);
    expect(goalkeeperRadio).toBeChecked();
  });

  it('identifica defensivamente combinações contraditórias', () => {
    expect(hasContradictoryVoteSelection('player-a', '', 'player-a')).toBe(true);
    expect(hasContradictoryVoteSelection('player-a', 'player-a', 'player-b')).toBe(false);
  });

  it('envia somente um ballot coerente', async () => {
    const user = userEvent.setup();
    renderScreen();

    const mvpList = await screen.findByRole('list', { name: 'Candidatos a MVP' });
    const worstList = screen.getByRole('list', { name: 'Candidatos a Bola Murcha' });
    await user.click(within(mvpList).getByRole('radio', { name: 'Jogador A' }));
    await user.click(within(worstList).getByRole('radio', { name: 'Jogador B' }));
    await user.click(screen.getByRole('button', { name: 'Enviar voto' }));

    await waitFor(() => expect(mocks.submitMvpVotes).toHaveBeenCalledWith({
      gameId: 'game-1',
      votes: [
        { category: 'MVP', votedPlayerId: 'player-a' },
        { category: 'WORST', votedPlayerId: 'player-b' },
      ],
    }));
  });
});
