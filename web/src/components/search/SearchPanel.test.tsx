import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (obj: unknown) => obj,
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../types/gamification', () => ({
  getLevelForXp: () => 1,
}));

vi.mock('../../utils/dateFormatters', () => ({
  formatGameDate: () => 'Hoje',
}));

vi.mock('../../contexts', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

vi.mock('../common/GameCard', () => ({
  LoadingState: () => <div data-testid="loading-state">Carregando...</div>,
}));

import { SearchPanel } from './SearchPanel';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('SearchPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renderiza input de busca', () => {
    renderWithTheme(<SearchPanel />);
    expect(screen.getByLabelText('Buscar jogadores, grupos ou jogos')).toBeInTheDocument();
  });

  it('mostra ações rápidas quando sem busca', () => {
    renderWithTheme(<SearchPanel />);
    expect(screen.getByText('Criar jogo')).toBeInTheDocument();
    expect(screen.getByText('Criar grupo')).toBeInTheDocument();
    expect(screen.getByText('Ir para perfil')).toBeInTheDocument();
    expect(screen.getByText('Ver ranking')).toBeInTheDocument();
  });

  it('navega ao clicar em ação rápida', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithTheme(<SearchPanel onClose={onClose} />);

    await user.click(screen.getByText('Criar jogo'));

    expect(mockNavigate).toHaveBeenCalledWith('/game/create');
  });

  it('chama onClose ao navegar para ação rápida', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithTheme(<SearchPanel onClose={onClose} />);

    await user.click(screen.getByText('Criar jogo'));

    expect(onClose).toHaveBeenCalled();
  });

  it('mostra dicas de teclado', () => {
    renderWithTheme(<SearchPanel />);
    expect(screen.getByText('↑↓')).toBeInTheDocument();
    expect(screen.getByText('navegar')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
    expect(screen.getByText('fechar')).toBeInTheDocument();
  });

  it('mostra placeholder customizado', () => {
    renderWithTheme(<SearchPanel placeholder="Buscar times..." />);
    expect(screen.getByPlaceholderText('Buscar times...')).toBeInTheDocument();
  });

  it('mostra seção Buscas recentes vazia inicialmente', () => {
    renderWithTheme(<SearchPanel />);
    expect(screen.queryByText('Buscas recentes')).not.toBeInTheDocument();
  });
});
