import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';

const mockNavigate = vi.fn();
let mockUserRole: 'PLAYER' | 'FIELD_OWNER' | 'ADMIN' | undefined;
let mockExperiencePoints = 850;
let mockPersistedLevel = 5;
let mockDerivedLevel = 5;
let mockXpProgress = 0.65;
vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

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
      role: mockUserRole,
      level: mockPersistedLevel,
      experiencePoints: mockExperiencePoints,
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

// handleBadgeImageError foi adicionado ao levelBadge em refactor recente. #2330
vi.mock('../../../utils/levelBadge', () => ({
  getLevelBadgeImage: () => '/images/badge-5.png',
  getLevelBadgeDescription: (level: number, name: string) => `Nível ${level} - ${name}`,
  handleBadgeImageError: vi.fn(),
}));

vi.mock('../../../types/gamification', () => ({
  getLevelForXp: () => mockDerivedLevel,
  getXpProgress: () => mockXpProgress,
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

vi.mock('../../../hooks/useLookingForGameToday', () => ({
  useLookingForGameToday: () => ({
    setLookingForGameToday: vi.fn().mockResolvedValue(undefined),
    loading: false,
    error: null,
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

// TeamBadge (usado em ProfileTab para exibir time favorito) chama useTeams. #2330
vi.mock('../../../contexts/TeamsContext', () => ({
  useTeams: () => ({ teams: [], teamsById: new Map(), loading: false, error: null }),
  TeamsProvider: ({ children }: { children: React.ReactNode }) => children,
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
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt-BR');
    mockUserRole = undefined;
    mockExperiencePoints = 850;
    mockPersistedLevel = 5;
    mockDerivedLevel = 5;
    mockXpProgress = 0.65;
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

  it('deriva o nível exibido do XP em vez do nível persistido', () => {
    mockPersistedLevel = 2;
    mockDerivedLevel = 3;

    renderProfileTab();

    expect(screen.getByAltText(/nível 3/i)).toBeInTheDocument();
    expect(screen.getByText('Nível 3')).toBeInTheDocument();
  });

  it('exibe estado terminal sem denominador zero no nível máximo', () => {
    mockExperiencePoints = 100_000;
    mockPersistedLevel = 19;
    mockDerivedLevel = 20;
    mockXpProgress = 1;

    renderProfileTab();

    expect(screen.getByText('Nível máximo!')).toBeInTheDocument();
    expect(screen.queryByText(/\/\s*0 XP/)).not.toBeInTheDocument();
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
    const editButton = screen.getByRole('button', { name: 'Editar Perfil' });
    const levelAction = screen.getByRole('button', {
      name: 'Ver jornada de nível - Nível 5',
    });

    expect(editButton).toBeInTheDocument();
    expect(editButton.compareDocumentPosition(levelAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('navega para editar perfil ao clicar no botão', async () => {
    const user = userEvent.setup();
    renderProfileTab();

    await user.click(screen.getByText('Editar Perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/edit');
  });

  it('abre a jornada de nível por Enter e Espaço com nome acessível', async () => {
    const user = userEvent.setup();
    renderProfileTab();
    const levelAction = screen.getByRole('button', {
      name: 'Ver jornada de nível - Nível 5',
    });

    levelAction.focus();
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenLastCalledWith('/level-journey');

    mockNavigate.mockClear();
    levelAction.focus();
    await user.keyboard(' ');
    expect(mockNavigate).toHaveBeenLastCalledWith('/level-journey');
  });

  it('traduz o nome acessível da jornada de nível para inglês', async () => {
    await i18n.changeLanguage('en');
    renderProfileTab();

    expect(screen.getByRole('button', {
      name: 'View level journey - Level 5',
    })).toBeInTheDocument();
  });

  it('possui menu com aria-label acessível', () => {
    renderProfileTab();
    expect(screen.getByRole('list', { name: /menu do perfil/i })).toBeInTheDocument();
  });

  it('mostra Gerenciar Usuários para administradores', async () => {
    const user = userEvent.setup();
    mockUserRole = 'ADMIN';

    renderProfileTab();

    await user.click(screen.getByText('Gerenciar Usuários'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/users');
  });
});
