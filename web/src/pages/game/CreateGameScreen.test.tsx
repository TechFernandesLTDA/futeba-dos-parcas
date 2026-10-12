import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';

const mockNavigate = vi.fn();
const mockGetFieldAvailability = vi.fn();
let mockLocations: Array<Record<string, unknown> & { id: string }> = [];
let mockCity: { city: string; state: string } | null = { city: 'Curitiba', state: 'PR' };
const mockChangeCity = vi.fn();
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

// #4370: o seletor trabalha com a cidade atual; o hook de dados é mockado aqui
// (a lógica de cidade/ordenação/busca tem testes puros em utils/venue*.test.ts).
vi.mock('../../hooks/useLocations', () => ({
  useLocationDetail: (id?: string) => ({
    location: mockLocations.find((location) => location.id === id) ?? null,
    loading: false,
    error: null,
  }),
  useLocationsByIds: () => [],
}));

vi.mock('../../hooks/useVenueSelector', () => ({
  useVenueSelector: () => ({
    city: mockCity,
    citySource: mockCity ? 'geolocation' : null,
    resolvingCity: false,
    changeCity: mockChangeCity,
    cityVenues: mockLocations,
    inCity: mockLocations,
    otherCities: [],
    loading: false,
    loadingOtherCities: false,
    error: null,
  }),
  useStateCities: () => ({ cities: [], loading: false, error: null }),
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
  normalizeField: (obj: Record<string, unknown>) => obj as Record<string, unknown>,
}));

vi.mock('../../services/firebase', () => ({
  app: {},
  db: {},
}));

vi.mock('../../services/cloudFunctions', () => ({
  getFieldAvailability: (...args: unknown[]) => mockGetFieldAvailability(...args),
}));

vi.mock('firebase/functions', () => ({
  connectFunctionsEmulator: vi.fn(),
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
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
import { findAvailabilityConflict } from '../../utils/fieldAvailability';
import {
  calculateFieldRentalCost,
  formatGameDurationLabel,
  getGameDurationMinutes,
  normalizeHourlyPriceForGame,
  resolveGamePricingForSave,
} from '../../utils/gamePricing';

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
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    mockLocations = [];
    mockCity = { city: 'Curitiba', state: 'PR' };
    mockGetFieldAvailability.mockResolvedValue({ data: { slots: [] } });
    await i18n.changeLanguage('pt-BR');
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

  it('avisa quando a cidade atual ainda não tem quadras', () => {
    renderCreateGameScreen();
    expect(
      screen.getByText(/ainda não há quadras cadastradas em curitiba/i),
    ).toBeInTheDocument();
  });

  it('mostra a cidade atual e o botão "Trocar cidade"', () => {
    renderCreateGameScreen();
    expect(screen.getByText('Cidade: Curitiba - PR')).toBeInTheDocument();
    expect(screen.getByText('pela sua localização')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trocar cidade/i })).toBeInTheDocument();
  });

  it('sem cidade definida pede para escolher uma cidade', () => {
    mockCity = null;
    renderCreateGameScreen();
    expect(screen.getAllByText(/escolha uma cidade para ver as quadras/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /trocar cidade/i })).toBeInTheDocument();
  });

  it('marca quadras importadas em rascunho com o selo "Não verificada"', async () => {
    mockLocations = [
      { id: 'loc-draft', name: 'Quadra Importada', city: 'Curitiba', state: 'PR', isVerified: false, publicationStatus: 'DRAFT' },
      { id: 'loc-ok', name: 'Arena Oficial', city: 'Curitiba', state: 'PR', isVerified: true, publicationStatus: 'PUBLISHED' },
    ];
    const user = userEvent.setup();
    renderCreateGameScreen();

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));

    const draft = screen.getByRole('option', { name: /quadra importada/i });
    expect(within(draft).getByText('Não verificada')).toBeInTheDocument();
    const official = screen.getByRole('option', { name: /arena oficial/i });
    expect(within(official).queryByText('Não verificada')).not.toBeInTheDocument();
  }, 15000);

  it('expõe nome e estado acessíveis reativos ao favoritar um local', async () => {
    mockLocations = [{
      id: 'loc-1',
      name: 'Arena Teste',
      city: 'São Paulo',
      state: 'SP',
      address: 'Rua A, 123',
      status: 'ACTIVE',
      fields: [],
    }];
    const user = userEvent.setup();
    renderCreateGameScreen();

    await user.click(screen.getByRole('combobox', { name: /quadra \/ local/i }));
    await user.click(screen.getByRole('option', { name: /arena teste/i }));
    const addFavorite = screen.getByRole('button', {
      name: 'Adicionar local aos favoritos',
    });
    expect(addFavorite).toHaveAttribute('aria-pressed', 'false');

    await user.click(addFavorite);

    const removeFavorite = screen.getByRole('button', {
      name: 'Remover local dos favoritos',
    });
    expect(removeFavorite).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('favorite_locations')).toContain('loc-1');
    // Timeout ampliado (padrão do repo p/ testes de interação): userEvent +
    // combobox MUI excedem os 5s padrão em runners CI compartilhados.
  }, 15000);

  it('traduz o nome acessível do favorito para inglês', async () => {
    mockLocations = [{
      id: 'loc-1', name: 'Test Arena', city: 'London', status: 'ACTIVE', fields: [],
    }];
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    renderCreateGameScreen();

    await user.click(screen.getByRole('combobox', { name: /field \/ location/i }));
    await user.click(screen.getByRole('option', { name: /test arena/i }));
    expect(screen.getByRole('button', {
      name: 'Add location to favorites',
    })).toBeInTheDocument();
    // Timeout ampliado (padrão do repo p/ testes de interação): userEvent +
    // combobox MUI excedem os 5s padrão em runners CI compartilhados.
  }, 15000);
});

describe('CreateGameScreen pricing helpers', () => {
  it('detecta overlap somente pela projeção sanitizada de slots', () => {
    const slots = [
      { date: '2026-07-15', startMinutes: 19 * 60, endMinutes: 20 * 60 },
      { date: '2026-07-15', startMinutes: 21 * 60, endMinutes: 22 * 60 },
    ];

    expect(findAvailabilityConflict(slots, 19 * 60 + 30, 20 * 60 + 30)).toEqual(slots[0]);
    expect(findAvailabilityConflict(slots, 20 * 60, 21 * 60)).toBeUndefined();
  });

  it('calcula aluguel proporcional pela duração usando preço por hora em centavos', () => {
    expect(normalizeHourlyPriceForGame(35000)).toBe(350);
    expect(calculateFieldRentalCost(35000, '18:00', '20:00')).toBe(700);
    expect(calculateFieldRentalCost(35000, '18:00', '19:30')).toBe(525);
    expect(calculateFieldRentalCost(35000, '18:00', '18:30')).toBe(175);
  });

  it('mantém compatibilidade com quadras antigas que já vinham em reais', () => {
    expect(normalizeHourlyPriceForGame(350)).toBe(350);
    expect(calculateFieldRentalCost(350, '18:00', '19:30')).toBe(525);
  });

  it('usa duração padrão de uma hora quando o horário final ainda não foi preenchido', () => {
    expect(getGameDurationMinutes('18:00', '')).toBe(60);
    expect(formatGameDurationLabel(90)).toBe('1h30');
    expect(calculateFieldRentalCost(35000, '18:00')).toBe(350);
  });

  it('resolve preço automático para salvar a partir do custo total atual', () => {
    expect(resolveGamePricingForSave({
      totalCost: 525,
      maxPlayers: 14,
      dailyPrice: 21,
      priceManualOverride: false,
    })).toEqual({
      totalCost: 525,
      dailyPrice: 37.5,
      priceManualOverride: false,
    });
  });

  it('preserva preço manual quando o organizador opta por sobrescrever', () => {
    expect(resolveGamePricingForSave({
      totalCost: 525,
      maxPlayers: 14,
      dailyPrice: 21,
      priceManualOverride: true,
    })).toEqual({
      totalCost: 525,
      dailyPrice: 21,
      priceManualOverride: true,
    });
  });
});
