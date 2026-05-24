import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  DocumentSnapshot: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));

vi.mock('../../services/cloudFunctions', () => ({
  setUserRole: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (obj: Record<string, unknown>) => obj,
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

mockGetDocs.mockResolvedValue({
  docs: [
    {
      id: 'user-1',
      data: () => ({ name: 'João', email: 'joao@test.com', role: 'PLAYER', gamesPlayed: 10, level: 5, createdAt: new Date() }),
    },
    {
      id: 'user-2',
      data: () => ({ name: 'Admin', email: 'admin@test.com', role: 'ADMIN', gamesPlayed: 50, level: 10, createdAt: new Date() }),
    },
  ],
  size: 2,
  length: 2,
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

  it('mostra role filter dropdown', async () => {
    renderWithTheme(<UserManagementScreen />);
    expect(await screen.findByText('Todos os roles')).toBeInTheDocument();
  });
});
