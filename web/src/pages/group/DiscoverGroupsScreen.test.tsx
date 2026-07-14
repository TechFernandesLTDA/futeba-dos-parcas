import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';

const mockOfficialGroups = [
  { id: 'g1', name: 'Pelada de Terça', description: 'Grupo legal', memberCount: 15, category: 'REGIAO', icon: '📍', createdAt: new Date() },
  { id: 'g2', name: 'Futebol Sábado', description: 'Arena sport', memberCount: 22, category: 'DIA_SEMANA', icon: '🗓️', createdAt: new Date() },
];

const officialGroupsState = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>>,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
}));

vi.mock('../../hooks/useOfficialGroups', () => ({
  useOfficialGroups: () => officialGroupsState,
  useJoinOfficialGroup: () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false }),
  useIsInOfficialGroup: () => ({ data: false, isLoading: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', name: 'Test' }, loading: false }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { DiscoverGroupsScreen } from './DiscoverGroupsScreen';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('DiscoverGroupsScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    officialGroupsState.data = mockOfficialGroups;
    officialGroupsState.isLoading = false;
    officialGroupsState.error = null;
    officialGroupsState.refetch.mockReset();
  });

  it('renderiza título', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Descobrir Grupos')).toBeInTheDocument();
  });

  it('renderiza campo de busca', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByPlaceholderText('Buscar por nome ou descrição')).toBeInTheDocument();
  });

  it('renderiza lista de grupos oficiais', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Pelada de Terça')).toBeInTheDocument();
    expect(screen.getByText('Futebol Sábado')).toBeInTheDocument();
  });

  it('filtra grupos por nome', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiscoverGroupsScreen />);
    const searchInput = screen.getByPlaceholderText('Buscar por nome ou descrição');
    await user.type(searchInput, 'Sábado');
    expect(screen.queryByText('Pelada de Terça')).not.toBeInTheDocument();
    expect(screen.getByText('Futebol Sábado')).toBeInTheDocument();
  });

  it('mostra contagem de membros', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('15 membros')).toBeInTheDocument();
    expect(screen.getByText('22 membros')).toBeInTheDocument();
  });

  it('renderiza botão de voltar', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });

  it('renderiza botão de atualizar', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByLabelText('Atualizar')).toBeInTheDocument();
  });

  it('mostra descrição do grupo quando disponível', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Grupo legal')).toBeInTheDocument();
    expect(screen.getByText('Arena sport')).toBeInTheDocument();
  });

  it('renderiza botão de entrada guiada nos grupos', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    const joinButtons = screen.getAllByText('Entrar guiado');
    expect(joinButtons.length).toBe(2);
  });

  it('traduz título, categorias e pluralização para inglês', async () => {
    await i18n.changeLanguage('en');
    renderWithProviders(<DiscoverGroupsScreen />);

    expect(screen.getByRole('heading', { name: 'Discover Groups' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'All' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Day of the Week' })).toBeVisible();
    expect(screen.getAllByText('Region').length).toBeGreaterThan(0);
    expect(screen.getByText('15 members')).toBeVisible();
  });

  it('traduz o erro sem expor a mensagem técnica recebida', async () => {
    await i18n.changeLanguage('en');
    officialGroupsState.error = new Error('permission-denied');
    renderWithProviders(<DiscoverGroupsScreen />);

    expect(screen.getByText('Could not load groups.')).toBeVisible();
    expect(screen.queryByText('permission-denied')).not.toBeInTheDocument();
  });

  it('traduz estados vazios geral e de busca', async () => {
    await i18n.changeLanguage('en');
    officialGroupsState.data = [];
    const { unmount } = renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('No official groups available')).toBeVisible();
    unmount();

    officialGroupsState.data = mockOfficialGroups;
    const user = userEvent.setup();
    renderWithProviders(<DiscoverGroupsScreen />);
    await user.type(screen.getByPlaceholderText('Search by name or description'), 'missing');
    expect(screen.getByText('No groups found')).toBeVisible();
  });
});
