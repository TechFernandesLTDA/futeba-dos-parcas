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
  doc: vi.fn(() => ({})),
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
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
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
});
