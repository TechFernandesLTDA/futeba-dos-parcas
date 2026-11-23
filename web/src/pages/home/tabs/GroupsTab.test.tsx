import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const groupsState = vi.hoisted(() => ({
  groups: [] as Array<Record<string, unknown>>,
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
}));

vi.mock('../../../hooks/useGroups', () => ({
  useGroups: () => groupsState,
}));

// Contagem de jogos finalizados por grupo, no servidor (#4629, item 13).
const countState = vi.hoisted(() => ({
  byGroup: {} as Record<string, number | Error>,
  where: [] as Array<[string, string, unknown]>,
}));

vi.mock('../../../services/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  where: vi.fn((field: string, op: string, value: unknown) => {
    countState.where.push([field, op, value]);
    return { field, op, value };
  }),
  query: vi.fn((_ref: unknown, ...filters: Array<{ field: string; value: unknown }>) => ({ filters })),
  getCountFromServer: vi.fn(async (q: { filters: Array<{ field: string; value: unknown }> }) => {
    const groupId = q.filters.find((f) => f.field === 'group_id')?.value as string;
    const result = countState.byGroup[groupId];
    if (result instanceof Error) throw result;
    return { data: () => ({ count: result ?? 0 }) };
  }),
}));

vi.mock('../../../components/common/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/layout', () => ({
  ScreenFab: () => null,
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string, opts?: { count?: number }) =>
    key === 'groups.gamesCount' ? `${key}:${opts?.count}` : key;
  return { useTranslation: () => ({ t }) };
});

import { GroupsTab } from './GroupsTab';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const theme = createTheme();

const mockGroups = [
  {
    id: 'g1',
    name: 'Pelada de Terça',
    description: 'Pelada semanal de terça',
    role: 'OWNER',
    type: 'PUBLIC',
    memberCount: 15,
    totalGamesPlayed: 30,
  },
  {
    id: 'g2',
    name: 'Futebol Sábado',
    description: 'Arena sport',
    role: 'MEMBER',
    type: 'PRIVATE',
    memberCount: 22,
    totalGamesPlayed: 10,
  },
];

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <GroupsTab />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const searchField = () => screen.getByLabelText('groups.search.ariaLabel');

describe('GroupsTab', () => {
  beforeEach(() => {
    groupsState.groups = mockGroups;
    groupsState.loading = false;
    groupsState.error = null;
    groupsState.refetch.mockClear();
    countState.byGroup = {};
    countState.where = [];
    queryClient.clear();
  });

  it('renderiza a lista de grupos do usuário', () => {
    renderScreen();
    expect(screen.getByText('Pelada de Terça')).toBeInTheDocument();
    expect(screen.getByText('Futebol Sábado')).toBeInTheDocument();
    expect(screen.getByText('groups.myGroups')).toBeInTheDocument();
    expect(screen.getAllByText('groups.owner').length).toBe(1);
  });

  it('mostra skeletons durante loading', () => {
    groupsState.loading = true;
    renderScreen();
    expect(screen.queryByText('Pelada de Terça')).not.toBeInTheDocument();
  });

  it('mostra ErrorState em caso de erro', () => {
    groupsState.error = 'Falha ao carregar grupos';
    renderScreen();
    expect(screen.getByText('Falha ao carregar grupos')).toBeInTheDocument();
  });

  it('filtra grupos pela busca', async () => {
    renderScreen();
    fireEvent.change(searchField(), { target: { value: 'Sábado' } });
    await waitFor(() => {
      expect(screen.queryByText('Pelada de Terça')).not.toBeInTheDocument();
      expect(screen.getByText('Futebol Sábado')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('mostra empty state de busca sem resultado', async () => {
    renderScreen();
    fireEvent.change(searchField(), { target: { value: 'zzz-nada' } });
    await waitFor(() => {
      expect(screen.getByText('groups.noResultsSearch')).toBeInTheDocument();
      expect(screen.queryByText('Pelada de Terça')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('mostra empty state com CTA de criação quando não há grupos', () => {
    groupsState.groups = [];
    renderScreen();
    expect(screen.getByText('groups.noResults')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'groups.createGroup' }).length).toBeGreaterThan(0);
  });

  it('conta os jogos finalizados do grupo em vez de total_games_played', async () => {
    countState.byGroup = { g1: 13, g2: 0 };
    renderScreen();
    expect(await screen.findByText('groups.gamesCount:13')).toBeInTheDocument();
    expect(screen.getByText('groups.gamesCount:0')).toBeInTheDocument();
    // O campo do grupo (30) não é atualizado por nenhuma função.
    expect(screen.queryByText('groups.gamesCount:30')).not.toBeInTheDocument();
    expect(countState.where).toContainEqual(['group_id', '==', 'g1']);
    expect(countState.where).toContainEqual(['status', '==', 'FINISHED']);
  });

  it('esconde o número quando a contagem do grupo falha', async () => {
    countState.byGroup = { g1: 5, g2: new Error('permission-denied') };
    renderScreen();
    expect(await screen.findByText('groups.gamesCount:5')).toBeInTheDocument();
    expect(screen.queryByText('groups.gamesCount:0')).not.toBeInTheDocument();
    expect(screen.queryByText('groups.gamesCount:10')).not.toBeInTheDocument();
  });
});
