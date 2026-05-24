import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockUnlockedIds = new Set<string>();

vi.mock('../../hooks/useBadges', () => ({
  useBadges: () => ({
    unlockedIds: mockUnlockedIds,
    loading: false,
    error: null,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'badges.title': 'Conquistas',
        'common.back': 'Voltar',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../types/gamification', () => ({
  BADGE_DEFINITIONS: [
    { id: 'badge-1', name: 'Primeiro Jogo', description: 'Participe do seu primeiro jogo', category: 'participation', rarity: 'COMUM', icon: '🏅', xpReward: 50, requirement: 'Jogue 1 partida' },
    { id: 'badge-2', name: 'MVP da Galera', description: 'Seja MVP 5 vezes', category: 'mvp', rarity: 'RARO', icon: '🌟', xpReward: 200, requirement: '5 MVPs' },
    { id: 'badge-3', name: 'Artilheiro', description: 'Marque 10 gols', category: 'goals', rarity: 'RARO', icon: '⚽', xpReward: 150, requirement: '10 gols' },
  ],
  rarityColors: { COMUM: '#8f8f8f', RARO: '#4fc3f7' },
}));

vi.mock('../../components/common/GameCard', () => ({
  LoadingState: ({ shimmerCount }: { shimmerCount: number }) => <div data-testid="loading-state">{shimmerCount}</div>,
}));

vi.mock('../../theme', () => ({
  rarityColors: { COMUM: '#8f8f8f', RARO: '#4fc3f7' },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { BadgesScreen } from './BadgesScreen';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('BadgesScreen', () => {
  it('renderiza título Conquistas', () => {
    renderWithTheme(<BadgesScreen />);
    expect(screen.getByText('Conquistas')).toBeInTheDocument();
  });

  it('mostra progresso de badges desbloqueadas', () => {
    renderWithTheme(<BadgesScreen />);
    expect(screen.getByText(/0 \/ 3/)).toBeInTheDocument();
  });

  it('renderiza grid de badges', () => {
    renderWithTheme(<BadgesScreen />);
    expect(screen.getByText('Primeiro Jogo')).toBeInTheDocument();
    expect(screen.getByText('MVP da Galera')).toBeInTheDocument();
  });

  it('mostra filtro por categorias', () => {
    renderWithTheme(<BadgesScreen />);
    expect(screen.getByText('Todas')).toBeInTheDocument();
  });

  it('badges bloqueadas mostram cadeado', () => {
    renderWithTheme(<BadgesScreen />);
    expect(screen.getAllByTestId('LockIcon').length).toBeGreaterThan(0);
  });

  it('badges desbloqueadas mostram recompensa XP', () => {
    mockUnlockedIds.add('badge-1');
    renderWithTheme(<BadgesScreen />);

    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('mostra raridade das badges', () => {
    renderWithTheme(<BadgesScreen />);
    expect(screen.getAllByText('COMUM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RARO').length).toBeGreaterThan(0);
  });
});
