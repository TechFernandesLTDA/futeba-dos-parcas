import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const gamesState = vi.hoisted(() => ({
  games: [] as Array<Record<string, unknown>>,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
}));

const groupsState = vi.hoisted(() => ({
  groups: [] as Array<Record<string, unknown>>,
  loading: false,
}));

vi.mock('../../../hooks/useGames', () => ({
  useGames: () => gamesState,
}));

vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => groupsState,
}));

vi.mock('../../../components/layout', () => ({
  ScreenFab: () => null,
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { GamesTab } from './GamesTab';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const theme = createTheme();

const mockGames = [
  {
    id: 'game-1',
    status: 'SCHEDULED',
    date: '2026-12-01',
    time: '19:00',
    locationName: 'Arena Centro',
    locationAddress: 'Rua 1',
    playersCount: 3,
    maxPlayers: 10,
    groupName: 'Pelada de Terça',
  },
  {
    id: 'game-2',
    status: 'SCHEDULED',
    date: '2026-12-02',
    time: '20:00',
    locationName: 'Arena Sul',
    locationAddress: 'Rua 2',
    playersCount: 10,
    maxPlayers: 10,
    groupName: 'Futebol Sábado',
  },
];

const mockGroups = [
  { id: 'gr1', name: 'Pelada de Terça', role: 'OWNER', memberCount: 6 },
];

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <GamesTab />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GamesTab', () => {
  beforeEach(() => {
    gamesState.games = mockGames;
    gamesState.loading = false;
    gamesState.error = null;
    gamesState.refetch.mockClear();
    groupsState.groups = mockGroups;
    groupsState.loading = false;
  });

  it('renderiza a lista de jogos com local e contagem de jogadores', () => {
    renderScreen();
    expect(screen.getByText('Arena Centro')).toBeInTheDocument();
    expect(screen.getByText('Arena Sul')).toBeInTheDocument();
    expect(screen.getByText('3/10 jogadores')).toBeInTheDocument();
  });

  it('mostra skeletons durante loading', () => {
    gamesState.loading = true;
    renderScreen();
    expect(screen.queryByText('Arena Centro')).not.toBeInTheDocument();
  });

  it('mostra ErrorState em caso de erro', () => {
    gamesState.error = 'Falha ao carregar jogos';
    renderScreen();
    expect(screen.getByText('Falha ao carregar jogos')).toBeInTheDocument();
  });

  it('filtra jogos pela busca', async () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText('games.search.placeholder'), { target: { value: 'Centro' } });
    await waitFor(() => {
      expect(screen.queryByText('Arena Sul')).not.toBeInTheDocument();
      expect(screen.getByText('Arena Centro')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('trocar a aba de status para FINALIZADOS esvazia a lista', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('tab', { name: 'games.tabs.finished' }));
    await waitFor(() => {
      expect(screen.queryByText('Arena Centro')).not.toBeInTheDocument();
      expect(screen.getByText('games.empty.filteredTitle')).toBeInTheDocument();
    });
  });
});
