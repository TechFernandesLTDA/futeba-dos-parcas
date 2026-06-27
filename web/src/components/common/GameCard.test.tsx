import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { GameCard } from './GameCard';
import { Game } from '../../types/game';

vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../contexts/TeamsContext', () => ({
  useTeams: () => ({
    teams: [],
    teamsById: new Map(),
    loading: false,
    error: null,
  }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('../../utils/dateFormatters', () => ({
  formatGameDate: (date: string) => date === '15/03/2026' ? 'Hoje' : date,
}));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const mockGame: Game = {
  id: 'game-1',
  date: '15/03/2026',
  time: '20:00',
  status: 'SCHEDULED',
  visibility: 'GROUP_ONLY',
  isPublic: false,
  maxPlayers: 20,
  maxGoalkeepers: 2,
  playersCount: 14,
  goalkeepersCount: 1,
  players: [],
  gameType: 'regular',
  fieldType: 'SOCIETY',
  recurrence: 'weekly',
  locationId: 'loc-1',
  locationName: 'Arena Soccer',
  locationAddress: 'Rua Teste, 123',
  dailyPrice: 25.00,
  totalCost: 500,
  pixKey: '',
  pixKeyType: 'CPF',
  pixBeneficiaryName: '',
  pixPaymentEnabled: false,
  numberOfTeams: 2,
  team1Name: 'Time A',
  team2Name: 'Time B',
  team1Score: 0,
  team2Score: 0,
  groupId: 'group-1',
  groupName: 'Pelada de Terça',
  ownerId: 'owner-1',
  ownerName: 'João',
  coOrganizers: [],
  confirmationDeadlineHours: 24,
  autoClosed: false,
  rules: '',
  requireCheckin: false,
  checkinRadiusMeters: 100,
  waitlistAutoPromoteMinutes: 30,
  votingConcluded: false,
  xpProcessed: false,
  postGameReportGenerated: false,
};

describe('GameCard', () => {
  it('renderiza o nome do local do jogo', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    expect(screen.getByText('Arena Soccer')).toBeInTheDocument();
  });

  it('renderiza a data do jogo formatada', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    // formatGameDate mockado retorna "Hoje" para "15/03/2026"
    expect(screen.getByText(/Hoje/)).toBeInTheDocument();
  });

  it('renderiza a contagem de jogadores', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    expect(screen.getByText('14/20 jogadores')).toBeInTheDocument();
  });

  it('exibe badge de status (Aberto para SCHEDULED)', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    expect(screen.getByText('Aberto')).toBeInTheDocument();
  });

  it('chama onClick quando clicado', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithTheme(<GameCard game={mockGame} onClick={onClick} />);

    await user.click(screen.getByText('Arena Soccer'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renderiza o endereço do local', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    expect(screen.getByText('Rua Teste, 123')).toBeInTheDocument();
  });

  it('exibe preço quando dailyPrice > 0', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    expect(screen.getByText('R$ 25.00')).toBeInTheDocument();
  });

  it('renderiza nome do grupo quando disponível', () => {
    renderWithTheme(<GameCard game={mockGame} />);
    expect(screen.getByText('Pelada de Terça')).toBeInTheDocument();
  });
});
