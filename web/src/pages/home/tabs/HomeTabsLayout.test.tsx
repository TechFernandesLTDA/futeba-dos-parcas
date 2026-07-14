import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import type { Game } from '../../../types/game';

interface TestContainerProps {
  children: ReactNode;
  maxWidth?: string;
}

interface TestGridProps {
  children: ReactNode;
  container?: boolean;
  xs?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

let games: Game[] = [];
let groups: Array<Record<string, unknown>> = [];

vi.mock('../../../components/common/PageContainer', () => ({
  PageContainer: ({ children, maxWidth }: TestContainerProps) => (
    <section data-testid="page-container" data-max-width={maxWidth}>
      {children}
    </section>
  ),
}));

vi.mock('@mui/material/Unstable_Grid2', () => ({
  default: ({ children, container, xs, md, lg, xl }: TestGridProps) => (
    <div
      data-testid={container ? 'grid-container' : 'grid-item'}
      data-xs={xs}
      data-md={md}
      data-lg={lg}
      data-xl={xl}
    >
      {children}
    </div>
  ),
}));

vi.mock('../../../hooks/useGames', () => ({
  useGames: () => ({ games, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => ({ groups, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('../../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../../components/layout', () => ({
  ScreenFab: () => null,
}));

vi.mock('../../../components/common/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { GamesTab } from './GamesTab';
import { GroupsTab } from './GroupsTab';

const theme = createTheme();

function renderTab(tab: ReactNode) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{tab}</ThemeProvider>
    </MemoryRouter>,
  );
}

function scheduledGame(): Game {
  return {
    id: 'game-1',
    date: '2099-07-20',
    time: '20:00',
    status: 'SCHEDULED',
    visibility: 'GROUP_ONLY',
    isPublic: false,
    maxPlayers: 12,
    maxGoalkeepers: 2,
    playersCount: 4,
    goalkeepersCount: 1,
    players: [],
    gameType: 'FUTSAL',
    fieldType: 'FUTSAL',
    recurrence: 'none',
    locationId: 'location-1',
    locationName: 'Arena dos Parças',
    locationAddress: 'Rua do Futebol, 10',
    dailyPrice: 0,
    totalCost: 0,
    pixKey: '',
    pixKeyType: 'RANDOM',
    pixBeneficiaryName: '',
    pixPaymentEnabled: false,
    numberOfTeams: 2,
    team1Name: 'Time A',
    team2Name: 'Time B',
    team1Score: 0,
    team2Score: 0,
    ownerId: 'owner-1',
    ownerName: 'Organizador',
    coOrganizers: [],
    confirmationDeadlineHours: 2,
    autoClosed: false,
    rules: '',
    requireCheckin: false,
    checkinRadiusMeters: 100,
    waitlistAutoPromoteMinutes: 30,
    votingConcluded: false,
    xpProcessed: false,
    postGameReportGenerated: false,
  };
}

describe('Home tabs layout', () => {
  beforeEach(() => {
    games = [];
    groups = [];
  });

  it('usa PageContainer dashboard na aba Jogos (#3605)', () => {
    renderTab(<GamesTab />);

    expect(screen.getByTestId('page-container')).toHaveAttribute('data-max-width', 'dashboard');
  });

  it('usa PageContainer dashboard na aba Grupos (#3606)', () => {
    renderTab(<GroupsTab />);

    expect(screen.getByTestId('page-container')).toHaveAttribute('data-max-width', 'dashboard');
  });

  it('escala cards de jogos explicitamente em lg e xl (#3607)', () => {
    games = [scheduledGame()];

    renderTab(<GamesTab />);

    expect(screen.getByTestId('grid-item')).toHaveAttribute('data-xs', '12');
    expect(screen.getByTestId('grid-item')).toHaveAttribute('data-md', '6');
    expect(screen.getByTestId('grid-item')).toHaveAttribute('data-lg', '4');
    expect(screen.getByTestId('grid-item')).toHaveAttribute('data-xl', '3');
  });
});
