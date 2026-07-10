import { createTheme, ThemeProvider } from '@mui/material';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CpfVerificationScreen } from './CpfVerificationScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  firebaseUser: {
    uid: 'jordi-user',
    phoneNumber: null as string | null,
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: { verified: false } }),
    getIdToken: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn() }),
}));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../services/cloudFunctions', () => ({
  verifyCpf: vi.fn(),
  setUserVerified: vi.fn(),
  recomputeMyProfileClaim: vi.fn(),
  logVerificationFailure: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

describe('CpfVerificationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.firebaseUser.phoneNumber = null;
    authState.firebaseUser.getIdTokenResult.mockResolvedValue({ claims: { verified: false } });
  });

  it('impede pular a etapa de SMS e retorna para a verificação de telefone', async () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <CpfVerificationScreen />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/phone', { replace: true });
    });
  });
});
