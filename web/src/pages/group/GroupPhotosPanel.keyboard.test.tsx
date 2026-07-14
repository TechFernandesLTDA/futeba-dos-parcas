import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [{
      id: 'photo-1',
      data: () => ({
        game_id: 'game-1',
        url: 'https://example.com/photo.jpg',
        uploaded_by_name: 'Ana',
        caption: 'Final do campeonato',
        created_at: { toDate: () => new Date('2026-07-13T12:00:00Z') },
      }),
    }],
  }),
}));
vi.mock('../../services/firebase', () => ({
  app: {},
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
}));
vi.mock('../../services/firebaseStorage', () => ({ storage: {} }));
vi.mock('../../services/firebaseFunctions', () => ({ functions: {} }));
vi.mock('../../services/cloudFunctions', () => ({ softDeleteGroup: vi.fn() }));

import { GroupPhotosPanel } from './GroupDetailScreen';

const theme = createTheme();

describe('GroupPhotosPanel keyboard accessibility', () => {
  it('abre com Enter e Espaço, fecha com Escape e restaura o foco', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <GroupPhotosPanel
          games={[{ id: 'game-1', title: 'Final' }]}
          loadingGames={false}
        />
      </ThemeProvider>,
    );

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
});
