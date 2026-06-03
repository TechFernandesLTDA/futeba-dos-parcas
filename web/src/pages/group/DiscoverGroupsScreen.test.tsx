import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockOfficialGroups = [
  { id: 'g1', name: 'Pelada de Terça', description: 'Grupo legal', memberCount: 15, category: 'REGIAO', icon: '📍', createdAt: new Date() },
  { id: 'g2', name: 'Futebol Sábado', description: 'Arena sport', memberCount: 22, category: 'DIA_SEMANA', icon: '🗓️', createdAt: new Date() },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../hooks/useOfficialGroups', () => ({
  useOfficialGroups: () => ({ data: mockOfficialGroups, isLoading: false, error: null, refetch: vi.fn() }),
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
  it('renderiza título', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Descobrir Grupos')).toBeInTheDocument();
  });

  it('renderiza campo de busca', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    // t() retorna a chave em ambiente de teste (mock passthrough)
    expect(screen.getByPlaceholderText('placeholder.searchNameOrDescription')).toBeInTheDocument();
  });

  it('renderiza lista de grupos oficiais', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Pelada de Terça')).toBeInTheDocument();
    expect(screen.getByText('Futebol Sábado')).toBeInTheDocument();
  });

  it('filtra grupos por nome', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiscoverGroupsScreen />);
    // t() retorna a chave em ambiente de teste (mock passthrough)
    const searchInput = screen.getByPlaceholderText('placeholder.searchNameOrDescription');
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
    // t() retorna a chave em ambiente de teste (mock passthrough) → 'a11y.back'
    expect(screen.getByLabelText('a11y.back')).toBeInTheDocument();
  });

  it('renderiza botão de atualizar', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    // t() retorna a chave em ambiente de teste (mock passthrough) → 'a11y.refresh'
    expect(screen.getByLabelText('a11y.refresh')).toBeInTheDocument();
  });

  it('mostra descrição do grupo quando disponível', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Grupo legal')).toBeInTheDocument();
    expect(screen.getByText('Arena sport')).toBeInTheDocument();
  });

  it('renderiza botão Entrar nos grupos', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    const joinButtons = screen.getAllByText('Entrar');
    expect(joinButtons.length).toBe(2);
  });
});
