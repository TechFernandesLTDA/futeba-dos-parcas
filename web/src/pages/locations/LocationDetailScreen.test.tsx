import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const authState = vi.hoisted(() => ({
  user: null as null | { id: string; role: 'PLAYER' },
}));

const locationData = {
  name: 'Arena Pública',
  address: 'Rua das Bolas, 10',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  description: 'Local público para peladas.',
  isVerified: true,
  isActive: true,
  publicationStatus: 'PUBLISHED',
  subscriptionStatus: 'ACTIVE',
  ownerId: 'owner-1',
  managers: [],
  fieldType: 'SOCIETY',
  fieldCount: 2,
  photos: [],
  amenities: [],
};

const firestoreMocks = vi.hoisted(() => {
  const docMock = vi.fn((...segments: unknown[]) => ({
    kind: 'doc',
    path: segments.filter((segment): segment is string => typeof segment === 'string').join('/'),
  }));
  const collectionMock = vi.fn((...segments: unknown[]) => ({
    kind: 'collection',
    path: segments.filter((segment): segment is string => typeof segment === 'string').join('/'),
  }));
  const orderByMock = vi.fn((field: string, direction?: string) => ({ field, direction }));
  const limitMock = vi.fn((value: number) => ({ value }));
  const queryMock = vi.fn((source: { path: string }) => ({ source }));
  const onSnapshotMock = vi.fn((
    target: { path?: string; source?: { path?: string } },
    onNext: (snapshot: unknown) => void,
  ) => {
    const path = target.path ?? target.source?.path ?? '';
    if (path === 'locations/loc-1') {
      onNext({
        id: 'loc-1',
        exists: () => true,
        data: () => locationData,
      });
    } else if (path.endsWith('/reviews')) {
      onNext({
        docs: [{
          id: 'player-1',
          data: () => ({
            userId: 'player-1',
            userName: 'Jogador Teste',
            rating: 5,
            comment: 'Ótima quadra',
            createdAt: { toDate: () => new Date('2026-07-14T12:00:00Z') },
          }),
        }],
      });
    } else if (path.endsWith('/fields')) {
      onNext({
        docs: [{
          id: 'field-1',
          data: () => ({
            name: 'Campo Society',
            type: 'SOCIETY',
            isActive: true,
            hourlyPrice: 20000,
            photos: [],
          }),
        }],
      });
    }
    return vi.fn();
  });

  return {
    collectionMock,
    docMock,
    limitMock,
    onSnapshotMock,
    orderByMock,
    queryMock,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (value: Record<string, unknown>) => value,
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/cloudFunctions', () => ({ getCallable: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collectionMock,
  doc: firestoreMocks.docMock,
  limit: firestoreMocks.limitMock,
  onSnapshot: firestoreMocks.onSnapshotMock,
  orderBy: firestoreMocks.orderByMock,
  query: firestoreMocks.queryMock,
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));

import { LocationDetailScreen } from './LocationDetailScreen';

const theme = createTheme();

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/location/loc-1']}>
        <Routes>
          <Route path="/location/:locationId" element={<LocationDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function subscribedPaths(): string[] {
  return firestoreMocks.onSnapshotMock.mock.calls.map(([target]) => (
    target.path ?? target.source?.path ?? ''
  ));
}

describe('LocationDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
  });

  it('mantém o local público sem iniciar listeners privados para visitante anônimo', async () => {
    renderScreen();

    expect((await screen.findAllByText('Arena Pública')).length).toBeGreaterThan(0);
    expect(screen.getByText('Local público para peladas.')).toBeInTheDocument();
    expect(screen.getByText('Entre para ver quadras e avaliações')).toBeInTheDocument();
    expect(screen.queryByText('Quadras e preços')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Avaliações/)).not.toBeInTheDocument();

    expect(subscribedPaths()).toEqual(['locations/loc-1']);
    expect(mockShowError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2Flocation%2Floc-1');
  });

  it('mantém fields e reviews para usuário autenticado', async () => {
    authState.user = { id: 'player-1', role: 'PLAYER' };
    renderScreen();

    expect(await screen.findByText('Campo Society')).toBeInTheDocument();
    expect(screen.getByText('Ótima quadra')).toBeInTheDocument();

    await waitFor(() => {
      expect(subscribedPaths()).toEqual(expect.arrayContaining([
        'locations/loc-1',
        'locations/loc-1/reviews',
        'locations/loc-1/fields',
      ]));
    });
    expect(screen.queryByText('Entre para ver quadras e avaliações')).not.toBeInTheDocument();
    expect(mockShowError).not.toHaveBeenCalled();
  });
});
