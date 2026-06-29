import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockSearchAdminUsers = vi.fn();

vi.mock('../../services/cloudFunctions', () => ({
  setUserRole: vi.fn().mockResolvedValue(undefined),
  searchAdminUsers: (...args: unknown[]) => mockSearchAdminUsers(...args),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../utils/firebaseErrors', () => ({
  getFunctionsErrorMessage: () => 'Erro ao atualizar role',
}));

vi.mock('../../components/common/GameCard', () => ({
  LoadingState: ({ shimmerCount }: { shimmerCount: number }) => <div data-testid="loading-state">{shimmerCount} itens</div>,
  EmptyState: ({ title, description, action }: { title: string; description?: string; action?: { label: string; onClick: () => void } }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {description && <span>{description}</span>}
      {action && <button onClick={action.onClick}>{action.label}</button>}
    </div>
  ),
  PlayerAvatar: ({ name }: { name: string }) => <div data-testid="player-avatar">{name}</div>,
}));

mockSearchAdminUsers.mockResolvedValue({
  data: {
    users: [
      {
        id: 'user-1',
        name: 'João',
        email: 'joao@test.com',
        role: 'PLAYER',
        photoUrl: null,
        gamesPlayed: 10,
        level: 5,
        createdAtIso: new Date().toISOString(),
        ownerSummary: {
          totalLocations: 0,
          publishedLocations: 0,
          pendingLocations: 0,
          overdueLocations: 0,
          incompleteLocations: 0,
          activeSubscriptionLocations: 0,
          monthlyFeeTotalCents: 0,
          managersTotal: 0,
        },
        phone: null,
        updatedAtIso: null,
        lastLoginAtIso: null,
        ownerLocations: [],
      },
      {
        id: 'user-2',
        name: 'Admin',
        email: 'admin@test.com',
        role: 'ADMIN',
        photoUrl: null,
        gamesPlayed: 50,
        level: 10,
        createdAtIso: new Date().toISOString(),
        ownerSummary: {
          totalLocations: 1,
          publishedLocations: 1,
          pendingLocations: 0,
          overdueLocations: 0,
          incompleteLocations: 0,
          activeSubscriptionLocations: 1,
          monthlyFeeTotalCents: 15000,
          managersTotal: 2,
        },
        phone: '+5511999999999',
        updatedAtIso: '2026-06-27T10:15:00.000Z',
        lastLoginAtIso: '2026-06-28T12:30:00.000Z',
        ownerLocations: [
          {
            id: 'loc-1',
            name: 'Arena Teste',
            city: 'São Paulo',
            state: 'SP',
            publicationStatus: 'PUBLISHED',
            subscriptionStatus: 'ACTIVE',
            monthlyFeeCents: 15000,
            billingDueDay: 10,
            fieldCount: 2,
            managersCount: 2,
            managersPreview: ['manager-1', 'manager-2'],
            updatedAtIso: null,
          },
        ],
      },
    ],
    nextPageToken: null,
    totalMatched: 2,
    scannedUsers: 2,
    scannedLocations: 0,
    scanComplete: true,
  },
});

import { UserManagementScreen } from './UserManagementScreen';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('UserManagementScreen', () => {
  beforeEach(() => {
    mockSearchAdminUsers.mockClear();
  });

  it('renderiza título', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('Gerenciar Usuários')).toBeInTheDocument();
  });

  it('renderiza ícone de busca', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByTestId('SearchIcon')).toBeInTheDocument();
  });

  it('mostra campo de busca', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByLabelText('Buscar usuário')).toBeInTheDocument();
  });

  it('mostra seletor de role filter', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('Todos os roles')).toBeInTheDocument();
  });

  it('mostra role filter dropdown', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('Todos os roles')).toBeInTheDocument();
  });

  it('busca usuários pela callable server-side', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('Gerenciar Usuários')).toBeInTheDocument();
    expect(mockSearchAdminUsers).toHaveBeenCalledWith({
      search: null,
      role: 'ALL',
      ownerFilter: 'ALL',
      pageSize: 50,
      pageToken: null,
    });
  });

  it('mostra filtro comercial', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('Todos')).toBeInTheDocument();
  });

  it('mostra resumo comercial de dono de quadra na lista', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('R$ 150,00')).toBeInTheDocument();
  });

  it('mostra último login separado da última atualização na ficha comercial', async () => {
    const user = userEvent.setup();
    renderWithTheme(<UserManagementScreen />);

    await user.click(await screen.findByText(/admin@test\.com/));

    expect(await screen.findByText('Ficha comercial do usuário')).toBeInTheDocument();
    expect(screen.getByText('Última atualização')).toBeInTheDocument();
    expect(screen.getByText('Último login')).toBeInTheDocument();
    expect(screen.getByText(/27\/06\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/28\/06\/2026/)).toBeInTheDocument();
  });
});
