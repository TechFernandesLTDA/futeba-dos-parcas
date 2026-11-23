import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

const getDocMock = vi.fn();
const getDocsMock = vi.fn();
const showErrorMock = vi.fn();
const translations: Record<string, string> = {
  'page.title.evolution': 'Evolução',
  'a11y.back': 'Voltar',
  'a11y.evolutionPeriod': 'Período da evolução',
  'empty.noDataAvailable': 'Sem dados',
  'statistics.loadEvolutionError': 'Erro ao carregar evolução',
};
const translateMock = (key: string) => translations[key] || key;

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Renan' } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: showErrorMock }),
}));

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../contexts/BreadcrumbEntityContext', () => ({
  useBreadcrumbEntityLabel: vi.fn(),
}));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: <T,>(value: T) => value,
}));

vi.mock('../../components/common/GameCard', () => ({
  LoadingState: () => <div data-testid="loading-state">loading</div>,
}));

vi.mock('../../components/common/ErrorState', () => ({
  ErrorState: ({ message }: { message: string }) => <div data-testid="error-state">{message}</div>,
}));

vi.mock('../../components/common/EmptyState', () => ({
  EmptyState: ({ title, actionLabel }: { title: string; actionLabel?: string }) => (
    <div data-testid="empty-state">
      {title}
      {actionLabel ? <button type="button">{actionLabel}</button> : null}
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translateMock,
  }),
}));

import { EvolutionScreen } from './EvolutionScreen';

const theme = createTheme();

function renderWithTheme(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type FakeDoc = { exists: () => boolean; data: () => Record<string, unknown> };
const fakeDoc = (data?: Record<string, unknown>): FakeDoc => ({
  exists: () => data !== undefined,
  data: () => data ?? {},
});

/** getDoc por coleção: users/{uid} e statistics/{uid}. */
function mockDocs(byCollection: Record<string, Record<string, unknown> | undefined>) {
  getDocMock.mockImplementation((ref: { col: string }) => Promise.resolve(fakeDoc(byCollection[ref.col])));
}

describe('EvolutionScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantém o header visível durante loading', () => {
    const userDoc = deferred<{ exists: () => boolean; data: () => Record<string, unknown> }>();
    getDocMock.mockReturnValue(userDoc.promise);
    getDocsMock.mockResolvedValue({ docs: [] });

    renderWithTheme(<EvolutionScreen />);

    expect(screen.getByRole('heading', { name: 'Evolução' })).toBeInTheDocument();
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('mantém o header visível no empty state', async () => {
    getDocMock.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    getDocsMock.mockResolvedValue({ docs: [] });

    renderWithTheme(<EvolutionScreen />);

    expect(await screen.findByTestId('empty-state')).toHaveTextContent('Sem dados');
    expect(screen.getByRole('heading', { name: 'Evolução' })).toBeInTheDocument();
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });

  it('mantém o header visível no error state', async () => {
    getDocMock.mockRejectedValue(new Error('boom'));
    getDocsMock.mockResolvedValue({ docs: [] });

    renderWithTheme(<EvolutionScreen />);

    expect(await screen.findByTestId('error-state')).toHaveTextContent('Erro ao carregar evolução');
    expect(screen.getByRole('heading', { name: 'Evolução' })).toBeInTheDocument();
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
    expect(showErrorMock).toHaveBeenCalledWith('Erro ao carregar evolução');
  });

  it('resumo lê statistics/{uid}, não os campos zerados de users/{uid}', async () => {
    mockDocs({
      users: { name: 'Renan', gamesPlayed: 0, goals: 0, wins: 0 },
      statistics: { totalGames: 13, totalGoals: 9, totalAssists: 4, gamesWon: 7 },
    });
    getDocsMock.mockResolvedValue({ docs: [] });

    renderWithTheme(<EvolutionScreen />);

    expect(await screen.findByText('13')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('53.8%')).toBeInTheDocument();
  });

  it('sem jogo finalizado mostra estado vazio com ação', async () => {
    mockDocs({ users: { name: 'Renan' }, statistics: undefined });
    getDocsMock.mockResolvedValue({ docs: [] });

    renderWithTheme(<EvolutionScreen />);

    const empty = await screen.findByTestId('empty-state');
    expect(empty).toHaveTextContent('statistics.evolutionEmptyTitle');
    expect(screen.getByRole('button', { name: 'statistics.evolutionEmptyAction' })).toBeInTheDocument();
  });
});
