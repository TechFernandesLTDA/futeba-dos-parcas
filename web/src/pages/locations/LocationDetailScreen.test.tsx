import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const authState = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    name: string;
    photoUrl: string;
    role: 'PLAYER';
  },
}));

let mockReviewDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

const firestoreMocks = vi.hoisted(() => {
  const serverTimestampValue = { __type: 'server-timestamp' };
  const setDocMock = vi.fn().mockResolvedValue(undefined);
  const updateDocMock = vi.fn().mockResolvedValue(undefined);
  const docMock = vi.fn((...segments: unknown[]) => ({
    kind: 'doc',
    path: segments.filter((segment): segment is string => typeof segment === 'string').join('/'),
  }));
  const collectionMock = vi.fn((...segments: unknown[]) => ({
    kind: 'collection',
    path: segments.filter((segment): segment is string => typeof segment === 'string').join('/'),
  }));
  const queryMock = vi.fn((source: { path: string }, ...constraints: unknown[]) => ({
    kind: 'query',
    source,
    constraints,
  }));
  const orderByMock = vi.fn((field: string, direction?: string) => ({ field, direction }));
  const limitMock = vi.fn((value: number) => ({ value }));
  const onSnapshotMock = vi.fn((
    target: { kind: string; path?: string; source?: { path: string } },
    onNext: (snapshot: unknown) => void,
  ) => {
    const path = target.kind === 'query' ? target.source?.path : target.path;
    if (path === 'locations/loc-1') {
      onNext({
        id: 'loc-1',
        exists: () => true,
        data: () => ({
          name: 'Arena Parças',
          owner_id: 'field-owner-1',
          managers: [],
          is_active: true,
          is_verified: true,
          publication_status: 'PUBLISHED',
          subscription_status: 'ACTIVE',
          address: 'Rua da Bola, 10',
          city: 'São Paulo',
          state: 'SP',
          description: 'Local público para peladas.',
          amenities: [],
          photos: [],
        }),
      });
    } else if (path === 'locations/loc-1/reviews') {
      onNext({ docs: mockReviewDocs });
    } else if (path === 'locations/loc-1/fields') {
      onNext({
        docs: [{
          id: 'field-1',
          data: () => ({
            name: 'Campo Society',
            type: 'SOCIETY',
            is_active: true,
            hourly_price: 20000,
            photos: [],
          }),
        }],
      });
    } else {
      onNext({ docs: [] });
    }
    return vi.fn();
  });

  return {
    serverTimestampValue,
    setDocMock,
    updateDocMock,
    docMock,
    collectionMock,
    queryMock,
    orderByMock,
    limitMock,
    onSnapshotMock,
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ locationId: 'loc-1' }),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/cloudFunctions', () => ({ getCallable: () => vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collectionMock,
  doc: firestoreMocks.docMock,
  limit: firestoreMocks.limitMock,
  onSnapshot: firestoreMocks.onSnapshotMock,
  orderBy: firestoreMocks.orderByMock,
  query: firestoreMocks.queryMock,
  serverTimestamp: () => firestoreMocks.serverTimestampValue,
  setDoc: firestoreMocks.setDocMock,
  updateDoc: firestoreMocks.updateDocMock,
}));

import { LocationDetailScreen } from './LocationDetailScreen';

const theme = createTheme();
const authenticatedUser = {
  id: 'player-1',
  name: 'Jogador Um',
  photoUrl: 'https://example.com/player.jpg',
  role: 'PLAYER' as const,
};

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/location/loc-1']}>
        <LocationDetailScreen />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function subscribedPaths(): string[] {
  return firestoreMocks.onSnapshotMock.mock.calls.map(([target]) => (
    target.kind === 'query' ? target.source?.path ?? '' : target.path ?? ''
  ));
}

describe('LocationDetailScreen — acesso público', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    mockReviewDocs = [];
  });

  it('mantém o documento público sem iniciar listeners privados para visitante anônimo', async () => {
    renderScreen();

    expect((await screen.findAllByText('Arena Parças')).length).toBeGreaterThan(0);
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
    authState.user = authenticatedUser;
    mockReviewDocs = [{
      id: 'player-2',
      data: () => ({
        user_id: 'player-2',
        user_name: 'Jogador Teste',
        rating: 5,
        comment: 'Ótima quadra',
        created_at: { toDate: () => new Date('2026-07-14T12:00:00Z') },
      }),
    }];
    renderScreen();

    expect(await screen.findByText('Campo Society')).toBeInTheDocument();
    expect(screen.getByText('Ótima quadra')).toBeInTheDocument();
    expect(subscribedPaths()).toEqual(expect.arrayContaining([
      'locations/loc-1',
      'locations/loc-1/reviews',
      'locations/loc-1/fields',
    ]));
    expect(screen.queryByText('Entre para ver quadras e avaliações')).not.toBeInTheDocument();
  });
});

describe('LocationDetailScreen — avaliações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = authenticatedUser;
    mockReviewDocs = [];
  });

  it('cria a primeira avaliação com created_at do servidor', async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole('button', { name: 'Avaliar' }));
    fireEvent.change(await screen.findByRole('textbox', { name: /Comentário/ }), {
      target: { value: 'Ótima quadra' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(firestoreMocks.setDocMock).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.updateDocMock).not.toHaveBeenCalled();
    expect(firestoreMocks.setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'locations/loc-1/reviews/player-1' }),
      {
        user_id: 'player-1',
        user_name: 'Jogador Um',
        user_photo: 'https://example.com/player.jpg',
        rating: 5,
        comment: 'Ótima quadra',
        created_at: firestoreMocks.serverTimestampValue,
      },
    );
  });

  it('pré-preenche e atualiza a avaliação sem reenviar created_at', async () => {
    mockReviewDocs = [{
      id: 'player-1',
      data: () => ({
        user_id: 'player-1',
        user_name: 'Jogador Um',
        user_photo: 'https://example.com/player.jpg',
        rating: 4,
        comment: 'Comentário anterior',
        created_at: { toDate: () => new Date('2026-07-01T12:00:00Z') },
      }),
    }];
    renderScreen();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar avaliação' }));
    const comment = await screen.findByRole('textbox', { name: /Comentário/ });
    expect(comment).toHaveValue('Comentário anterior');
    fireEvent.change(comment, { target: { value: 'Comentário revisado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(firestoreMocks.updateDocMock).toHaveBeenCalledTimes(1));
    expect(firestoreMocks.setDocMock).not.toHaveBeenCalled();
    const payload = firestoreMocks.updateDocMock.mock.calls[0][1];
    expect(payload).toEqual({
      user_name: 'Jogador Um',
      user_photo: 'https://example.com/player.jpg',
      rating: 4,
      comment: 'Comentário revisado',
      updated_at: firestoreMocks.serverTimestampValue,
    });
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('user_id');
  });
});
