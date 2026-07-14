import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';

import { ProfileSetupScreen } from './ProfileSetupScreen';

const mockGetDoc = vi.hoisted(() => vi.fn());
const mockSetDoc = vi.hoisted(() => vi.fn());
const mockUpdateDoc = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockRefreshUser = vi.hoisted(() => vi.fn());
const mockRefreshClaims = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockRecomputeClaim = vi.hoisted(() => vi.fn().mockResolvedValue({success: true, profileComplete: true}));
const mockShowError = vi.hoisted(() => vi.fn());
const mockUploadProfileAvatar = vi.hoisted(() =>
  vi.fn(() => Promise.resolve('https://example.com/profile.jpg?v=1'))
);

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

vi.mock('../../services/cloudFunctions', () => ({
  recomputeMyProfileClaim: (...args: unknown[]) => mockRecomputeClaim(...args),
}));

vi.mock('../../utils/profileAvatar', () => ({
  validateProfileAvatar: vi.fn(() => null),
  uploadProfileAvatar: mockUploadProfileAvatar,
  getProfileAvatarUploadErrorKey: vi.fn(() => 'profile.avatarUploadError'),
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
    refreshClaims: mockRefreshClaims,
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
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    vi.clearAllMocks();
    mockGetDoc.mockResolvedValue({ exists: () => true });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockRefreshUser.mockResolvedValue(undefined);
    mockUploadProfileAvatar.mockResolvedValue('https://example.com/profile.jpg?v=1');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:onboarding-avatar'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
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

  it('grava preferred_position usando o enum canônico do perfil', async () => {
    const user = userEvent.setup();

    renderWithProviders();

    await user.click(screen.getByRole('button', { name: /def/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(1));

    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.preferred_position).toBe('ZAGUEIRO');
  });

  it('permite escolher e salvar a foto durante o onboarding', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/selecionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(mockUploadProfileAvatar).toHaveBeenCalledTimes(1));
    expect(mockUploadProfileAvatar).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ uid: 'user-1' }),
    );
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1' }),
      expect.objectContaining({
        displayName: 'Caio',
        photoURL: 'https://example.com/profile.jpg?v=1',
      }),
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ photo_url: 'https://example.com/profile.jpg?v=1' }),
    );
  });

  it('traduz todos os campos visíveis do onboarding para inglês', async () => {
    await i18n.changeLanguage('en');
    renderWithProviders();

    expect(screen.getByRole('heading', { name: 'Set Up Profile' })).toBeVisible();
    expect(screen.getByLabelText('Your name')).toHaveValue('Caio');
    expect(screen.getByLabelText('Email')).toHaveValue('caio@example.com');
    expect(screen.getByLabelText('Nickname')).toBeVisible();
    expect(screen.getByText('Preferred Position')).toBeVisible();
    expect(screen.getByText('Preferred Field Types')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Society' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Futsal' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Grass Field' })).toBeInTheDocument();
    expect(screen.getByText('Grass Field')).toBeVisible();
    expect(screen.getByText('Your name will be shown to other players in games and groups.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('traduz o estado de salvamento', async () => {
    await i18n.changeLanguage('en');
    let finishAuthUpdate: (() => void) | undefined;
    mockUpdateProfile.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishAuthUpdate = resolve;
    }));
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

    finishAuthUpdate?.();
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledOnce());
  });
});
