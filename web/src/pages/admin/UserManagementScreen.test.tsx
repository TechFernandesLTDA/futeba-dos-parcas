import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { join } from 'path';
import i18n from 'i18next';

const mockSearchAdminUsers = vi.fn();
const mockUpsertVenueAccount = vi.fn();

vi.mock('../../services/cloudFunctions', () => ({
  setUserRole: vi.fn().mockResolvedValue(undefined),
  searchAdminUsers: (...args: unknown[]) => mockSearchAdminUsers(...args),
  upsertVenueAccount: (...args: unknown[]) => mockUpsertVenueAccount(...args),
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
        ownerOnboarding: null,
        venueAccount: null,
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
        ownerOnboarding: {
          status: 'APPROVED',
          submittedAtIso: null,
          reviewedAtIso: null,
          contactName: 'Financeiro Arena',
          contactEmail: 'financeiro@arena.test',
          phone: '+5511988887777',
          businessName: 'Arena Teste LTDA',
          notes: null,
          reviewReason: null,
        },
        venueAccount: null,
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
    mockUpsertVenueAccount.mockReset();
    mockUpsertVenueAccount.mockResolvedValue({
      data: {
        success: true,
        accountId: 'user-2',
        ownerUid: 'user-2',
        linkedLocationIds: ['loc-1'],
        linkedLocationsCount: 1,
        publishedLocationsCount: 1,
        activeFieldCount: 2,
        computedMonthlyFeeCents: 19990,
        status: 'ACTIVE',
        billingScope: 'OWNER',
      },
    });
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

  it('sinaliza contas prováveis de QA na lista', async () => {
    mockSearchAdminUsers.mockResolvedValueOnce({
      data: {
        users: [
          {
            id: 'qa-1',
            name: 'Admin QA Futeba',
            email: 'test.admin@futeba.test',
            role: 'ADMIN',
            photoUrl: null,
            gamesPlayed: 0,
            level: 1,
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
            ownerOnboarding: null,
            venueAccount: null,
          },
        ],
        nextPageToken: null,
        totalMatched: 1,
        scannedUsers: 1,
        scannedLocations: 0,
        scanComplete: true,
      },
    });

    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('QA/teste')).toBeInTheDocument();
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

  it('permite configurar conta comercial agregada do dono de quadra', async () => {
    const user = userEvent.setup();
    renderWithTheme(<UserManagementScreen />);

    await user.click(await screen.findByText(/admin@test\.com/));
    await user.click(await screen.findByRole('button', { name: 'Criar conta' }));
    await user.clear(await screen.findByLabelText('Mensalidade final manual (R$)'));
    await user.type(screen.getByLabelText('Mensalidade final manual (R$)'), '199.90');
    await user.clear(await screen.findByLabelText('Dia de vencimento'));
    await user.type(screen.getByLabelText('Dia de vencimento'), '10');
    await user.click(screen.getByRole('button', { name: 'Salvar conta comercial' }));

    expect(mockUpsertVenueAccount).toHaveBeenCalledWith(expect.objectContaining({
      ownerUid: 'user-2',
      status: 'TRIAL',
      billingScope: 'OWNER',
      monthlyFeeOverrideCents: 19990,
      billingDueDay: 10,
      linkedLocationIds: ['loc-1'],
      billingContactName: 'Financeiro Arena',
      billingContactEmail: 'financeiro@arena.test',
    }));
  }, 15000);
  describe('i18n (#4339)', () => {
    afterEach(async () => {
      await i18n.changeLanguage('pt-BR');
    });

    it.each([
      ['en', 'Manage Users', 'All roles', 'Todos os roles'],
      ['es', 'Administrar Usuarios', 'Todos los roles', 'Todos os roles'],
    ])('traduz título e filtros em %s', async (lng, title, allRoles, ptText) => {
      await i18n.changeLanguage(lng);
      renderWithTheme(<UserManagementScreen />);
      expect(await screen.findByText(title)).toBeInTheDocument();
      expect(await screen.findByText(allRoles)).toBeInTheDocument();
      expect(screen.queryByText(ptText)).not.toBeInTheDocument();
      expect(screen.queryByText('Gerenciar Usuários')).not.toBeInTheDocument();
    });

    it('não mantém textos PT-BR fixos no JSX da tela', () => {
      const source = readFileSync(join(__dirname, 'UserManagementScreen.tsx'), 'utf8');
      const forbidden = [
        'Gerenciar Usuários', 'Todos os roles', 'Donos de quadra', 'Com quadras', 'Com publicada',
        'Com pendência', 'Cadastro incompleto', 'Tentar novamente', 'Criado em', 'Ficha comercial do usuário',
        'Contato e atividade', 'Última atualização', 'Último login', 'Onboarding comercial',
        'Salvar conta comercial', 'Alterar role em lote', 'Confirmar alteração de role',
      ];
      const found = forbidden.filter((text) => new RegExp(`(>|["'\`]|^\s+)${text}(<|["'\`]|\s*$)`, 'm').test(source));
      expect(found).toEqual([]);
    });
  });
});
