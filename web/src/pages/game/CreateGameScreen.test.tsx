import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  snakeToCamel: (obj: any) => obj,
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
}));

import { CreateGameScreen } from './CreateGameScreen';

const theme = createTheme();

function renderCreateGameScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/game/create']}>
        <CreateGameScreen />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('CreateGameScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o título "Criar Jogo"', () => {
    renderCreateGameScreen();
    expect(screen.getByText('Criar Jogo')).toBeInTheDocument();
  });

  it('exibe as etapas do stepper', () => {
    renderCreateGameScreen();
    expect(screen.getByText('Local e Data')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Pagamento')).toBeInTheDocument();
    expect(screen.getByText('Regras')).toBeInTheDocument();
  });

  it('exibe botão de próximo na primeira etapa', () => {
    renderCreateGameScreen();
    expect(screen.getByRole('button', { name: /próximo/i })).toBeInTheDocument();
  });

  it('renderiza campos da primeira etapa: data, horário, local', () => {
    renderCreateGameScreen();
    expect(screen.getByRole('combobox', { name: /quadra/i })).toBeInTheDocument();
    expect(screen.getByText('Próximo')).toBeInTheDocument();
  });
});
