import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockAuthUser = { id: 'owner-123', role: 'FIELD_OWNER' } as const;

let mockLocationDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
let mockGameDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
let mockFieldDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

const firestoreMocks = vi.hoisted(() => {
  const collectionMock = vi.fn((...segments: unknown[]) => ({
    kind: 'collection',
    path: segments
      .filter((segment): segment is string => typeof segment === 'string')
      .join('/'),
  }));
  const collectionGroupMock = vi.fn((_: unknown, name: string) => ({
    kind: 'collectionGroup',
    path: name,
  }));
  const whereMock = vi.fn((field: string, op: string, value: unknown) => ({
    kind: 'where',
    field,
    op,
    value,
  }));
  const orderByMock = vi.fn((field: string, direction?: string) => ({
    kind: 'orderBy',
    field,
    direction,
  }));
  const limitMock = vi.fn((value: number) => ({ kind: 'limit', value }));
  const queryMock = vi.fn((source: { path: string }, ...constraints: Array<Record<string, unknown>>) => ({
    source,
    constraints,
  }));
  const onSnapshotMock = vi.fn((queryArg: { source?: { path?: string } }, onNext: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) => {
    const path = queryArg?.source?.path || '';
    if (path.endsWith('locations')) {
      onNext({ docs: mockLocationDocs });
    } else if (path.endsWith('games')) {
      onNext({ docs: mockGameDocs });
    } else {
      onNext({ docs: [] });
    }
    return vi.fn();
  });
  const getDocsMock = vi.fn(async (queryArg: { source?: { path?: string } }) => {
    const path = queryArg?.source?.path || '';
    if (path.endsWith('fields')) {
      return { docs: mockFieldDocs };
    }
    return { docs: [] };
  });

  return {
    collectionMock,
    collectionGroupMock,
    whereMock,
    orderByMock,
    limitMock,
    queryMock,
    onSnapshotMock,
    getDocsMock,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
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

vi.mock('../../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: () => 'erro firestore',
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('../../services/firebaseStorage', () => ({
  storage: {},
}));

vi.mock('../../services/cloudFunctions', () => ({
  submitLocationSubscriptionReceipt: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collectionMock,
  collectionGroup: firestoreMocks.collectionGroupMock,
  getDocs: firestoreMocks.getDocsMock,
  limit: firestoreMocks.limitMock,
  onSnapshot: firestoreMocks.onSnapshotMock,
  orderBy: firestoreMocks.orderByMock,
  query: firestoreMocks.queryMock,
  Timestamp: class FakeTimestamp {
    toDate() {
      return new Date();
    }
  },
  where: firestoreMocks.whereMock,
}));

import { FieldOwnerDashboardScreen } from './FieldOwnerDashboardScreen';

const theme = createTheme();

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/owner/dashboard']}>
        <FieldOwnerDashboardScreen />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('FieldOwnerDashboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationDocs = [];
    mockGameDocs = [];
    mockFieldDocs = [];
  });

  it('renderiza o estado guiado quando o dono ainda nao cadastrou quadras', async () => {
    renderScreen();

    expect((await screen.findAllByText('Sua operação começa no primeiro cadastro')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Cadastrar primeira quadra' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Primeiros passos para monetizar sua quadra')).toBeInTheDocument();
  });

  it('renderiza cards, status e atalhos quando existem quadras cadastradas', async () => {
    mockLocationDocs = [
      {
        id: 'loc-1',
        data: () => ({
          name: 'Arena Parças',
          address: 'Rua Bola 10',
          cep: '01000-000',
          street: 'Rua Bola',
          number: '10',
          district: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          neighborhood: 'Centro',
          region: 'Zona Sul',
          ownerId: 'owner-123',
          managers: [],
          isVerified: true,
          isActive: true,
          publicationStatus: 'PUBLISHED',
          subscriptionStatus: 'ACTIVE',
          monthlyFeeCents: 19990,
          billingDueDay: 10,
          currentBillingCycleStatus: 'OVERDUE',
          currentBillingOpenBalanceCents: 19990,
          rating: 4.8,
          ratingCount: 12,
          description: 'Quadra pronta para jogos.',
          photoUrl: 'https://example.com/location.jpg',
          photos: ['https://example.com/location.jpg'],
          amenities: ['parking', 'bathroom'],
          phone: '11999999999',
          openingTime: '08:00',
          closingTime: '23:00',
          operatingDays: [1, 2, 3, 4, 5, 6],
          minGameDurationMinutes: 60,
          fieldCount: 2,
          fieldType: 'SOCIETY',
          primaryFieldType: 'SOCIETY',
          playersPerTeam: 7,
          hasActiveFields: true,
        }),
      },
    ];

    mockFieldDocs = [
      {
        id: 'field-1',
        data: () => ({
          locationId: 'loc-1',
          name: 'Campo 1',
          type: 'SOCIETY',
          isActive: true,
          hourlyPrice: 18000,
          photos: [],
          managers: [],
          isCovered: false,
        }),
      },
      {
        id: 'field-2',
        data: () => ({
          locationId: 'loc-1',
          name: 'Campo 2',
          type: 'SOCIETY',
          isActive: true,
          hourlyPrice: 22000,
          photos: [],
          managers: [],
          isCovered: false,
        }),
      },
    ];

    mockGameDocs = [
      {
        id: 'game-1',
        data: () => ({
          location_id: 'loc-1',
          status: 'SCHEDULED',
          date_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        }),
      },
    ];

    renderScreen();

    expect(await screen.findByText('Arena Parças')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Preço médio por hora').length).toBeGreaterThan(0);
      expect(screen.getByText(/Mensalidade em aberto/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Comprovantes e pagamentos' })).toBeInTheDocument();
      expect(screen.getByText('Checklist comercial')).toBeInTheDocument();
    });
  });
});
