import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';

const mockGroups = [
  { id: 'g1', name: 'Pelada de Terça', description: 'Grupo legal', memberCount: 15, photoUrl: null },
  { id: 'g2', name: 'Futebol Sábado', description: 'Arena sport', memberCount: 22, photoUrl: null },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../hooks/useGroups', () => ({
  useDiscoverPublicGroups: () => ({ groups: mockGroups, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { DiscoverGroupsScreen } from './DiscoverGroupsScreen';

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </BrowserRouter>
  );
}

describe('DiscoverGroupsScreen', () => {
  it('renderiza título', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByText('Descobrir Grupos')).toBeInTheDocument();
  });

  it('renderiza campo de busca', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    expect(screen.getByPlaceholderText('Buscar por nome ou descrição')).toBeInTheDocument();
  });

  it('renderiza lista de grupos', () => {
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

  it('mostra badge Público nos grupos', () => {
    renderWithProviders(<DiscoverGroupsScreen />);
    const publicChips = screen.getAllByText('Público');
    expect(publicChips.length).toBeGreaterThanOrEqual(2);
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
});
