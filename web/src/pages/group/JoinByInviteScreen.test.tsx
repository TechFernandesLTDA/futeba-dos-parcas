import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetDoc = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  firebaseUser: { uid: 'user-1' } as unknown,
}));
const mockNavigate = vi.hoisted(() => vi.fn());
const mockJoinByInviteCode = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'CODE123', path: 'invites/CODE123' })),
  getDoc: mockGetDoc,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: authState.firebaseUser }),
}));

vi.mock('../../contexts/ToastContext', () => {
  // These functions are effect dependencies: keep their identity stable.
  const toast = { showError: vi.fn(), showSuccess: vi.fn() };
  return { useToast: () => toast };
});

vi.mock('../../hooks/useGroups', () => ({
  useInvitePlayers: () => ({ joinByInviteCode: mockJoinByInviteCode, loading: false }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { JoinByInviteScreen } from './JoinByInviteScreen';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const theme = createTheme();

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/join/CODE123']}>
          <Routes>
            <Route path="/join/:code" element={<JoinByInviteScreen />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function validInviteData() {
  return {
    group_id: 'group-1',
    group_name: 'Pelada de Terça',
    inviter_name: 'Zé Organizador',
    expires_at: { toDate: () => new Date(Date.now() + 60 * 60 * 1000) },
    used: false,
  };
}

describe('JoinByInviteScreen', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockJoinByInviteCode.mockReset();
    mockJoinByInviteCode.mockResolvedValue(undefined);
    mockNavigate.mockClear();
    authState.firebaseUser = { uid: 'user-1' };
  });

  it('mostra loading enquanto busca o convite', () => {
    mockGetDoc.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByText('Carregando convite…')).toBeInTheDocument();
  });

  it('mostra tela de convite inválido quando não existe', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    renderScreen();
    expect(await screen.findByText('Convite inválido')).toBeInTheDocument();
    expect(screen.getByText('feedback.invite.notFound')).toBeInTheDocument();
  });

  it('renderiza preview do grupo com nome e convidador', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => validInviteData() });
    renderScreen();
    expect(await screen.findByText('Pelada de Terça')).toBeInTheDocument();
    expect(screen.getByText('Zé Organizador convidou você para')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceitar e entrar' })).toBeInTheDocument();
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it('ao aceitar chama joinByInviteCode com o código da rota', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => validInviteData() });
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Aceitar e entrar' }));
    await waitFor(() => expect(mockJoinByInviteCode).toHaveBeenCalledWith('CODE123'));
  });

  it('mostra estado de convite expirado', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...validInviteData(),
        expires_at: { toDate: () => new Date(Date.now() - 60 * 1000) },
      }),
    });
    renderScreen();
    expect(await screen.findByText('Convite expirado')).toBeInTheDocument();
  });

  it('pede login quando não há usuário autenticado', () => {
    authState.firebaseUser = null;
    renderScreen();
    expect(screen.getByText('Faça login para aceitar o convite')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});
