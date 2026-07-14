import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';

const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteObject = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((_query, next) => {
    next({
      docs: [{
        id: 'photo-1',
        data: () => ({
          game_id: 'game-1',
          url: 'https://example.com/photo.jpg',
          storage_path: 'games/game-1/photo.jpg',
          uploaded_by: 'user-1',
          uploaded_by_name: 'Ana',
          reactions: {},
        }),
      }],
    });
    return vi.fn();
  }),
}));

vi.mock('firebase/storage', () => ({
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/firebaseStorage', () => ({ storage: {} }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1', displayName: 'Ana' },
    user: { name: 'Ana' },
  }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock('../../components/reactions/ReactionBar', () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}));

import { GamePhotosTab } from './GamePhotosTab';

const theme = createTheme();

function renderTab() {
  return render(
    <ThemeProvider theme={theme}>
      <GamePhotosTab
        gameId="game-1"
        isFinished={false}
        isConfirmedPlayer={false}
        isOwner
      />
    </ThemeProvider>,
  );
}

describe('GamePhotosTab keyboard accessibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('abre com Enter, fecha com Escape e devolve o foco ao thumbnail', async () => {
    const user = userEvent.setup();
    renderTab();
    const thumbnail = await screen.findByRole('button', { name: 'Foto enviada por Ana' });

    thumbnail.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Foto enviada por Ana' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(thumbnail).toHaveFocus();

    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: 'Foto enviada por Ana' })).toBeInTheDocument();
  });

  it('mantém excluir como ação irmã sem abrir o lightbox', async () => {
    const user = userEvent.setup();
    renderTab();
    const thumbnail = await screen.findByRole('button', { name: 'Foto enviada por Ana' });
    const deleteButton = screen.getByRole('button', { name: 'Excluir foto' });

    expect(thumbnail).not.toContainElement(deleteButton);
    await user.click(deleteButton);

    await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
