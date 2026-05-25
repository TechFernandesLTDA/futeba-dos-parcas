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

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Carlos Teste',
      nickname: 'Carlão',
      email: 'carlos@test.com',
      level: 5,
      experiencePoints: 850,
      totalGames: 42,
      totalGoals: 15,
      mvpCount: 3,
      currentStreak: 5,
      bestStreak: 10,
      strikerRating: 3.5,
      midRating: 4.0,
      defenderRating: 2.0,
      gkRating: 1.0,
    },
    firebaseUser: {
      uid: 'user-1',
      email: 'carlos@test.com',
    },
    logout: vi.fn().mockResolvedValue(undefined),
    loading: false,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../../../types/user', () => ({
  getLevelColor: () => '#00C853',
}));

vi.mock('../../../utils/levelBadge', () => ({
  getLevelBadgeImage: () => '/images/badge-5.png',
  getLevelBadgeDescription: (level: number, name: string) => `Nível ${level} - ${name}`,
}));

vi.mock('../../../types/gamification', () => ({
  getLevelForXp: () => 5,
  getXpProgress: () => 0.65,
  getXpRemaining: () => 150,
  getLevelEntry: (level: number) => ({
    level,
    name: 'Craque',
    xpRequired: level === 5 ? 500 : 1000,
  }),
}));

vi.mock('../../../hooks/useGamificationColors', () => ({
  useGamificationColors: () => ({
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    xp: '#9C27B0',
    level: '#00BCD4',
    mvp: '#FFD700',
    streak: '#FF5722',
  }),
}));

vi.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

import { ProfileTab } from './ProfileTab';

const theme = createTheme();

function renderProfileTab() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ProfileTab />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('ProfileTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o nome do usuário', () => {
    renderProfileTab();
    expect(screen.getByText('Carlos Teste')).toBeInTheDocument();
  });

  it('renderiza as iniciais no avatar', () => {
    renderProfileTab();
    expect(screen.getByText('CT')).toBeInTheDocument();
  });

  it('renderiza badge de nível com imagem', () => {
    renderProfileTab();
    const badgeImg = screen.getByAltText(/nível 5/i);
    expect(badgeImg).toBeInTheDocument();
  });

  it('renderiza barra de progresso XP', () => {
    renderProfileTab();
    // LinearProgress renderiza com role="progressbar"
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('renderiza resumo de estatísticas (jogos, gols, MVPs)', () => {
    renderProfileTab();
    expect(screen.getByText('42')).toBeInTheDocument(); // totalGames
    expect(screen.getByText('15')).toBeInTheDocument(); // totalGoals
    expect(screen.getByText('3')).toBeInTheDocument();  // mvpCount
    expect(screen.getByText('Jogos')).toBeInTheDocument();
    expect(screen.getByText('Gols')).toBeInTheDocument();
    expect(screen.getByText('MVPs')).toBeInTheDocument();
  });

  it('exibe botão Editar Perfil', () => {
    renderProfileTab();
    expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
  });

  it('navega para editar perfil ao clicar no botão', async () => {
    const user = userEvent.setup();
    renderProfileTab();

    await user.click(screen.getByText('Editar Perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/edit');
  });

  it('possui menu com aria-label acessível', () => {
    renderProfileTab();
    expect(screen.getByRole('list', { name: /menu do perfil/i })).toBeInTheDocument();
  });
});
