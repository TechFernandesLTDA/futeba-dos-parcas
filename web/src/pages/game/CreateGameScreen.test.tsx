import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-id', name: 'Test User', level: 1 },
    firebaseUser: { uid: 'test-uid', displayName: 'Test User' },
    loading: false,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useGroups', () => ({
  useGroupDetail: () => ({
    group: null,
    members: [],
    loading: false,
    error: null,
  }),
  useGroups: () => ({
    groups: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useGames', () => ({
  useCreateGame: () => ({
    createGame: vi.fn().mockResolvedValue('new-game-id'),
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useLocations', () => ({
  useLocations: () => ({
    locations: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (obj: Record<string, unknown>) => obj as Record<string, unknown>,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  doc: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
  limit: vi.fn((...args) => args[0]),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
  // useFieldGames usa onSnapshot para disponibilidade de campo em tempo real
  onSnapshot: vi.fn(() => vi.fn()),
}));

import { CreateGameScreen } from './CreateGameScreen';

const theme = createTheme();

// CreateGameScreen usa useRecentLocations() -> useQuery, que exige um
// QueryClientProvider na árvore. O wrapper global do setup.ts (configure({ wrapper }))
// é no-op para render() no RTL v16, então o provider precisa ser explícito aqui. #2330
function renderCreateGameScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/game/create']}>
          <CreateGameScreen />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('CreateGameScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o título "Criar Jogo" no header', () => {
    renderCreateGameScreen();
    // O FormScaffold renderiza o título como heading (h1); o texto "Criar Jogo"
    // também aparece no botão de submit, então usamos role=heading para isolar.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Criar Jogo' }),
    ).toBeInTheDocument();
  });

  it('exibe as seções do formulário de página única', () => {
    renderCreateGameScreen();
    // Formulário single-page (#2250): seções em vez de stepper, agora com resumo vivo.
    expect(screen.getByText('Monte o jogo sem deixar ponta solta.')).toBeInTheDocument();
    expect(screen.getAllByText('Local')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Data e horário')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Configurações')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Pagamento')[0]).toBeInTheDocument();
    expect(screen.getByText('Regras')).toBeInTheDocument();
    expect(screen.getAllByText('Resumo do jogo')[0]).toBeInTheDocument();
  });

  it('exibe o botão de submit "Criar Jogo"', () => {
    renderCreateGameScreen();
    // Botão sticky de submit no rodapé do formulário.
    expect(
      screen.getByRole('button', { name: 'Criar Jogo' }),
    ).toBeInTheDocument();
  });

  it('renderiza o seletor de quadra/local na seção de local', () => {
    renderCreateGameScreen();
    // Seletor "Quadra / Local" (games.create.fieldOrLocation) — único combobox
    // com esse rótulo já que useGroups está mockado vazio (sem select de grupo).
    expect(
      screen.getByRole('combobox', { name: /quadra \/ local/i }),
    ).toBeInTheDocument();
  });

  it('avisa quando não há quadras publicadas com mensalidade válida', () => {
    renderCreateGameScreen();
    expect(
      screen.getByText(/nenhuma quadra publicada e com mensalidade válida/i),
    ).toBeInTheDocument();
  });
});
