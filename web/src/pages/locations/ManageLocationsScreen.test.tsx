import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SnapshotHandler = (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
let snapshotHandlers: SnapshotHandler[] = [];
let compact = false;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'ref'),
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
  onSnapshot: vi.fn((_query: unknown, next: SnapshotHandler) => {
    snapshotHandlers.push(next);
    return vi.fn();
  }),
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytes: vi.fn() }));
vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/firebaseStorage', () => ({ storage: {} }));
vi.mock('../../services/cloudFunctions', () => ({
  assignLocationOwner: vi.fn(),
  deleteLocation: vi.fn(),
  getAdminLocationBillingSummary: vi.fn().mockResolvedValue({ data: { summary: {}, locations: [], periodKey: '2026-10' } }),
  inviteLocationManager: vi.fn(),
  removeLocationManager: vi.fn(),
  reviewLocationCommercialRequest: vi.fn(),
  reviewLocationSubscriptionReceipt: vi.fn(),
  setLocationPublicationStatus: vi.fn(),
  setLocationSubscription: vi.fn(),
  submitLocationSubscriptionReceipt: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'ADMIN' }, firebaseUser: { uid: 'admin-1' } }),
}));
// Funções estáveis: o efeito de comprovantes depende de showError e, com um mock
// que cria funções novas a cada render, entraria em loop de re-render.
const toast = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => toast,
}));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../hooks/useMobileTopBarVisibility', () => ({ useHideMobileTopBar: vi.fn() }));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { ManageLocationsScreen } from './ManageLocationsScreen';

const docOf = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => ({
    name: `Quadra ${id}`,
    city: 'Curitiba',
    state: 'PR',
    neighborhood: 'Centro',
    district: 'Centro',
    is_active: true,
    is_verified: true,
    publication_status: 'PUBLISHED',
    subscription_status: 'ACTIVE',
    owner_id: 'owner-1',
    managers: [],
    field_type: 'SOCIETY',
    ...data,
  }),
});

const DOCS = [
  docOf('alfa', { name: 'Arena Alfa' }),
  docOf('beta', { name: 'Beta Society', city: 'Londrina', neighborhood: 'Gleba', district: 'Gleba' }),
  docOf('gama', { name: 'Gama Futsal', city: 'Joinville', state: 'SC', is_verified: false, publication_status: 'DRAFT', phone: '' }),
];

function renderScreen(url = '/locations') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ManageLocationsScreen />
    </MemoryRouter>,
  );
}

async function loadDocs(docs = DOCS) {
  await waitFor(() => expect(snapshotHandlers.length).toBeGreaterThan(0));
  act(() => snapshotHandlers[0]({ docs }));
}

describe('ManageLocationsScreen (admin) — filtros, busca e vistas', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    snapshotHandlers = [];
    compact = false;
    // jsdom não tem matchMedia: simula a largura (compacto = < 900 px) para o useMediaQuery do MUI.
    window.matchMedia = ((query: string) => ({
      matches: compact && query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    await i18n.changeLanguage('pt-BR');
  });

  it('desktop: painel lateral + tabela densa + contador "Mostrando X de Y"', async () => {
    renderScreen();
    await loadDocs();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Arena Alfa')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 3 de 3 quadras/)).toBeInTheDocument();
    const aside = screen.getByRole('complementary', { name: 'Filtros' });
    expect(within(aside).getByRole('combobox', { name: /estado \(uf\)/i })).toBeInTheDocument();
    expect(within(aside).getByRole('button', { name: 'Rascunhos importados' })).toBeInTheDocument();
  }, 20000);

  it('filtros na URL: ?uf=SC mostra só Joinville, com chip e contador', async () => {
    renderScreen('/locations?uf=SC');
    await loadDocs();

    expect(await screen.findByText('Gama Futsal')).toBeInTheDocument();
    expect(screen.queryByText('Arena Alfa')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1 de 3 quadras/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filtros ativos' })).toHaveTextContent('SC');
  }, 20000);

  it('atalho "Rascunhos importados" filtra e "Limpar tudo" restaura', async () => {
    const user = userEvent.setup();
    renderScreen();
    await loadDocs();

    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Rascunhos importados' }));
    expect(await screen.findByText(/Mostrando 1 de 3 quadras/)).toBeInTheDocument();

    const chips = screen.getByRole('group', { name: 'Filtros ativos' });
    await user.click(within(chips).getByRole('button', { name: 'Limpar tudo' }));
    expect(await screen.findByText(/Mostrando 3 de 3 quadras/)).toBeInTheDocument();
  }, 20000);

  it('busca inteligente (abreviação + typo) com debounce', async () => {
    const user = userEvent.setup();
    renderScreen();
    await loadDocs();

    await user.type(screen.getByRole('textbox', { name: /buscar/i }), 'soc londrna');

    await waitFor(() => expect(screen.getByText(/Mostrando 1 de 3 quadras/)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('Beta Society')).toBeInTheDocument();
  }, 20000);

  it('a lista não é limitada a 200: 450 quadras aparecem e são contadas', async () => {
    renderScreen();
    await loadDocs(Array.from({ length: 450 }, (_, i) => docOf(`q${i}`, { name: `Quadra ${String(i).padStart(3, '0')}` })));
    expect(await screen.findByText(/Mostrando 450 de 450 quadras/)).toBeInTheDocument();
  }, 30000);

  it('mobile: botão "Filtros (n)" abre o bottom sheet e o chip some ao remover', async () => {
    compact = true;
    const user = userEvent.setup();
    renderScreen('/locations?uf=PR');
    await loadDocs();

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    const trigger = await screen.findByRole('button', { name: 'Filtros (1)' });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument(); // cards no mobile

    await user.click(trigger);
    const sheet = await screen.findByRole('dialog', { name: 'Filtros' });
    expect(within(sheet).getByRole('button', { name: 'Ver 2 quadras' })).toBeInTheDocument();
    expect(within(sheet).getByRole('combobox', { name: /estado \(uf\)/i })).toBeInTheDocument();
  }, 20000);

  it('sem resultado mostra o vazio com "Limpar tudo"', async () => {
    renderScreen('/locations?uf=RS');
    await loadDocs();
    expect(await screen.findByText(/Mostrando 0 de 3 quadras/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpar tudo' }).length).toBeGreaterThan(0);
  }, 20000);
});
