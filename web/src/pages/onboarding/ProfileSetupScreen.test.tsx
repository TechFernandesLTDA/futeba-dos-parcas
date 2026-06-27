import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

import { ProfileSetupScreen } from './ProfileSetupScreen';

const mockGetDoc = vi.hoisted(() => vi.fn());
const mockSetDoc = vi.hoisted(() => vi.fn());
const mockUpdateDoc = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockRefreshUser = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...parts: unknown[]) => parts.join('/')),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

vi.mock('firebase/auth', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

vi.mock('../../services/firebase', () => ({
  db: 'mock-db',
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: {
      uid: 'user-1',
      displayName: 'Caio',
      email: 'caio@example.com',
      photoURL: null,
    },
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: mockShowError,
  }),
}));

vi.mock('../../components/team/TeamSelector', () => ({
  TeamSelector: ({ onChange }: { onChange: (value: string | null) => void }) => (
    <button type="button" onClick={() => onChange('corinthians')}>
      Selecionar time
    </button>
  ),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const theme = createTheme();

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ProfileSetupScreen />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('ProfileSetupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDoc.mockResolvedValue({ exists: () => true });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it('atualiza perfil existente sem enviar campos protegidos pelas rules', async () => {
    const user = userEvent.setup();

    renderWithProviders();

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(1));

    expect(mockSetDoc).not.toHaveBeenCalled();
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;

    expect(payload).toMatchObject({
      name: 'Caio',
      photo_url: '',
      nickname: '',
      preferred_position: null,
      preferred_field_types: [],
      favorite_team: null,
      is_searchable: true,
    });
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('level');
    expect(payload).not.toHaveProperty('experience_points');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
  });
});
