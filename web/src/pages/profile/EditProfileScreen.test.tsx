import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockUpdateUserProfile = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc'),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: vi.fn(() => ({ commit: vi.fn() })),
  limit: vi.fn((...args) => args[0]),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/photo.jpg')),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  storage: {},
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'profile.editTitle': 'Editar Perfil',
        'profile.editProfile': 'Editar Perfil',
        'profile.fullNameLabel': 'Nome completo',
        'profile.saveChanges': 'Salvar alterações',
        'common.save': 'Salvar',       // botão no footer do FormScaffold
        'common.cancel': 'Cancelar',
        'common.saving': 'Salvando...',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'user-1', displayName: 'João', photoURL: null },
    updateUserProfile: mockUpdateUserProfile,
    user: { id: 'user-1', name: 'João' },
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../components/layout', () => ({
  // FormScaffold deve renderizar footer (contém o botão Salvar). #2330
  FormScaffold: ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
      {footer}
    </div>
  ),
  AdaptiveFormSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/team/TeamSelector', () => ({
  TeamSelector: () => <div>TeamSelector Mock</div>,
}));

import { EditProfileScreen } from './EditProfileScreen';

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

describe('EditProfileScreen', () => {
  it('não crasha durante renderização', () => {
    expect(() => renderWithProviders(<EditProfileScreen />)).not.toThrow();
  });

  it('renderiza o título no FormScaffold', async () => {
    renderWithProviders(<EditProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('renderiza botão de ação (Salvar)', async () => {
    renderWithProviders(<EditProfileScreen />);
    await waitFor(() => {
      // Botão usa t('common.save') = 'Salvar' via i18n real do setup global. #2330
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('não mostra erro inicialmente', () => {
    renderWithProviders(<EditProfileScreen />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('não mostra sucesso inicialmente', () => {
    renderWithProviders(<EditProfileScreen />);
    expect(screen.queryByText('Perfil atualizado!')).not.toBeInTheDocument();
  });

  it('mantém estado estável após renderizar', async () => {
    renderWithProviders(<EditProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});
