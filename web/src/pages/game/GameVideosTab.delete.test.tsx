import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';

// Regressão #4480: a falha na exclusão da miniatura não pode abortar a exclusão do vídeo.
const mockDeleteDoc = vi.fn();
const mockDeleteObject = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: vi.fn((_db, _col, id) => ({ id })),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((_query, next) => {
    next({
      docs: [{
        id: 'video-1',
        data: () => ({
          game_id: 'game-1',
          url: 'https://example.com/video.mp4',
          storage_path: 'games/game-1/videos/video.mp4',
          thumbnail_path: 'games/game-1/video_thumbnails/thumb.jpg',
          uploaded_by: 'user-1',
          uploaded_by_name: 'Ana',
          status: 'READY',
          reactions: {},
        }),
      }],
    });
    return vi.fn();
  }),
}));

vi.mock('firebase/storage', () => ({
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  getDownloadURL: vi.fn().mockResolvedValue('https://example.com/thumb.jpg'),
  // O ref devolve o próprio caminho para identificar qual objeto está sendo apagado
  ref: vi.fn((_storage, path: string) => path),
  uploadBytesResumable: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/firebaseStorage', () => ({ storage: {} }));
vi.mock('../../services/cloudFunctions', () => ({ createGameVideo: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'user-1', displayName: 'Ana' } }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    // Confirma a exclusão automaticamente, como se o usuário clicasse em "Confirmar"
    showWithAction: (_msg: string, action: { onClick: () => void }) => action.onClick(),
  }),
}));
vi.mock('../../components/reactions/ReactionBar', () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: (...args: unknown[]) => mockLoggerWarn(...args) }),
}));

import { GameVideosTab } from './GameVideosTab';

function renderTab() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <GameVideosTab gameId="game-1" isFinished isConfirmedPlayer isOwner={false} canManage={false} />
    </ThemeProvider>,
  );
}

async function clickDelete() {
  const user = userEvent.setup();
  // O único botão com ícone de lixeira é o de exclusão (aria-label do i18n)
  const button = (await screen.findAllByRole('button')).find(
    (el) => el.querySelector('[data-testid="DeleteIcon"]'),
  );
  expect(button).toBeDefined();
  await user.click(button as HTMLElement);
}

describe('GameVideosTab exclusão de vídeo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteDoc.mockResolvedValue(undefined);
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it('segue apagando vídeo e documento quando a miniatura falha', async () => {
    mockDeleteObject.mockImplementation((path: string) =>
      path.includes('video_thumbnails')
        ? Promise.reject({ code: 'storage/object-not-found' })
        : Promise.resolve(),
    );
    renderTab();
    await clickDelete();

    await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledTimes(1));
    expect(mockDeleteObject).toHaveBeenCalledWith('games/game-1/videos/video.mp4');
    expect(mockDeleteObject).toHaveBeenCalledWith('games/game-1/video_thumbnails/thumb.jpg');
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('também ignora falha de permissão na miniatura', async () => {
    mockDeleteObject.mockImplementation((path: string) =>
      path.includes('video_thumbnails')
        ? Promise.reject({ code: 'storage/unauthorized' })
        : Promise.resolve(),
    );
    renderTab();
    await clickDelete();

    await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledTimes(1));
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('para e mostra erro quando o vídeo principal falha', async () => {
    mockDeleteObject.mockImplementation((path: string) =>
      path.includes('videos/video.mp4')
        ? Promise.reject({ code: 'storage/unauthorized' })
        : Promise.resolve(),
    );
    renderTab();
    await clickDelete();

    await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
