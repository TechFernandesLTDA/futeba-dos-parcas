import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'games.title': 'Jogos',
        'games.createGame': 'Criar Jogo',
        'games.tabs.all': 'Todos',
        'games.tabs.scheduled': 'Agendados',
        'games.tabs.confirmed': 'Confirmados',
        'games.tabs.live': 'Ao Vivo',
        'games.tabs.finished': 'Finalizados',
        'games.noGames': 'Nenhum jogo encontrado',
        'games.loadError': 'Erro ao carregar jogos',
        'games.allGroups': 'Todos os grupos',
        'games.filterByGroup': 'Filtrar por grupo',
        'common.back': 'Voltar',
        'common.retry': 'Tentar novamente',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));

vi.mock('../../hooks/useGames', () => ({
  useGames: () => ({ games: [], loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('../../hooks/useGroups', () => ({
  useGroups: () => ({ groups: [] }),
}));

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

vi.mock('../../hooks/usePerformanceMonitoring', () => ({
  usePerformanceMonitoring: () => ({ metrics: null }),
  PerformanceOverlay: () => null,
}));

import { GamesScreen } from './GamesScreen';

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </BrowserRouter>
  );
}

describe('GamesScreen', () => {
  it('renderiza título da página', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.getByText('Jogos')).toBeInTheDocument();
  });

  it('renderiza botão de voltar', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });

  it('renderiza abas de filtro', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Agendados')).toBeInTheDocument();
    expect(screen.getByText('Finalizados')).toBeInTheDocument();
  });

  it('renderiza estado vazio quando não há jogos', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.getByText('Nenhum jogo encontrado')).toBeInTheDocument();
  });

  it('renderiza FAB para criar jogo no mobile', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.getByLabelText('Criar novo jogo')).toBeInTheDocument();
  });

  it('não mostra filtro de grupo quando não há grupos', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.queryByText('Filtrar por grupo')).not.toBeInTheDocument();
  });

  it('renderiza botão de refresh', () => {
    renderWithProviders(<GamesScreen />);
    expect(screen.getByLabelText('Atualizar jogos')).toBeInTheDocument();
  });
});
