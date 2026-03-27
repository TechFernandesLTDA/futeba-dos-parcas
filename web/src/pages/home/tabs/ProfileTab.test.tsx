import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    logout: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../../theme', () => ({
  gamificationColors: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    xp: '#9C27B0',
    level: '#00BCD4',
    mvp: '#FFD700',
    streak: '#FF5722',
  },
}));

vi.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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

  describe('Logout', () => {
    it('exibe botão Sair', () => {
      renderProfileTab();
      expect(screen.getByText('Sair')).toBeInTheDocument();
    });

    it('abre diálogo de confirmação ao clicar em Sair', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      await user.click(screen.getByText('Sair'));
      expect(screen.getByText('Sair da conta?')).toBeInTheDocument();
      expect(screen.getByText(/Você será desconectado/)).toBeInTheDocument();
    });

    it('fecha diálogo ao clicar em Cancelar', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      await user.click(screen.getByText('Sair'));
      expect(screen.getByText('Sair da conta?')).toBeInTheDocument();

      await user.click(screen.getByText('Cancelar'));
      await waitFor(() => {
        expect(screen.queryByText('Sair da conta?')).not.toBeInTheDocument();
      });
    });

    it('executa logout e navega para /login ao confirmar', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      // Abre o diálogo
      await user.click(screen.getByText('Sair'));

      // Clica no botão "Sair" dentro do diálogo (botão de confirmação)
      const dialogActions = screen.getByRole('dialog');
      const confirmButton = dialogActions.querySelector('button.MuiButton-containedError') ||
        screen.getAllByText('Sair').find(el => el.closest('.MuiDialogActions-root'));
      expect(confirmButton).toBeTruthy();
      await user.click(confirmButton!);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Menu de navegação', () => {
    it('renderiza todos os itens do menu', () => {
      renderProfileTab();
      expect(screen.getByText('Rumo ao Estrelato')).toBeInTheDocument();
      expect(screen.getByText('Badges')).toBeInTheDocument();
      expect(screen.getByText('Estatísticas')).toBeInTheDocument();
      expect(screen.getByText('Configurações')).toBeInTheDocument();
    });

    it('navega para /level-journey ao clicar em Rumo ao Estrelato', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      await user.click(screen.getByText('Rumo ao Estrelato'));
      expect(mockNavigate).toHaveBeenCalledWith('/level-journey');
    });

    it('navega para /badges ao clicar em Badges', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      await user.click(screen.getByText('Badges'));
      expect(mockNavigate).toHaveBeenCalledWith('/badges');
    });

    it('navega para /statistics ao clicar em Estatísticas', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      await user.click(screen.getByText('Estatísticas'));
      expect(mockNavigate).toHaveBeenCalledWith('/statistics');
    });

    it('navega para /settings ao clicar em Configurações', async () => {
      const user = userEvent.setup();
      renderProfileTab();

      await user.click(screen.getByText('Configurações'));
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });
  });

  describe('Dados de posição e streak', () => {
    it('renderiza seção de habilidades por posição', () => {
      renderProfileTab();
      expect(screen.getByText('Habilidades por Posição')).toBeInTheDocument();
      expect(screen.getByText('Atacante')).toBeInTheDocument();
      expect(screen.getByText('Meia')).toBeInTheDocument();
      expect(screen.getByText('Zagueiro')).toBeInTheDocument();
      expect(screen.getByText('Goleiro')).toBeInTheDocument();
    });

    it('renderiza valores de rating formatados', () => {
      renderProfileTab();
      expect(screen.getByText('3.5')).toBeInTheDocument(); // strikerRating
      expect(screen.getByText('4.0')).toBeInTheDocument(); // midRating
      expect(screen.getByText('2.0')).toBeInTheDocument(); // defenderRating
      expect(screen.getByText('1.0')).toBeInTheDocument(); // gkRating
    });

    it('renderiza card de streak quando currentStreak > 0', () => {
      renderProfileTab();
      expect(screen.getByText('5 jogos seguidos!')).toBeInTheDocument();
      expect(screen.getByText(/Recorde: 10 jogos/)).toBeInTheDocument();
    });
  });
});
