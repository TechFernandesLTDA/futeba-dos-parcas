import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneVerificationScreen } from './PhoneVerificationScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLinkWithCredential = vi.hoisted(() => vi.fn());
const mockPhoneCredential = vi.hoisted(() => vi.fn(() => ({ providerId: 'phone' })));
const authMocks = vi.hoisted(() => {
  const reload = vi.fn();
  const getIdToken = vi.fn();
  const user = {
    uid: 'jordi-user',
    phoneNumber: null,
    reload,
    getIdToken,
  };
  return { user, reload, getIdToken };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: class {
    render = vi.fn().mockResolvedValue(1);
    clear = vi.fn();
  },
  PhoneAuthProvider: { credential: mockPhoneCredential },
  linkWithPhoneNumber: vi.fn(),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  signInWithCredential: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({
  auth: { currentUser: authMocks.user },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: authMocks.user }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));

vi.mock('../../services/cloudFunctions', () => ({
  canSendSmsOtp: vi.fn(),
  logVerificationFailure: vi.fn().mockResolvedValue(undefined),
  requestAccountMerge: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const theme = createTheme();

describe('PhoneVerificationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('futeba.phoneVerification', JSON.stringify({
      attempts: [{
        uid: authMocks.user.uid,
        phone: '+55 (11) 99999-8888',
        phoneE164: '+5511999998888',
        verificationId: 'verification-id',
        sentAt: Date.now(),
        attemptId: 'attempt-1',
      }],
    }));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('avança para o CPF assim que o código vincula o telefone, sem esperar reload do Firebase', async () => {
    let finishReload: (() => void) | undefined;
    authMocks.reload.mockImplementation(() => new Promise<void>((resolve) => {
      finishReload = resolve;
    }));
    authMocks.getIdToken.mockResolvedValue('token');
    mockLinkWithCredential.mockResolvedValue({ user: authMocks.user });
    const user = userEvent.setup();

    render(
      <ThemeProvider theme={theme}>
        <PhoneVerificationScreen />
      </ThemeProvider>,
    );

    const otpInput = await screen.findByLabelText('Código SMS');
    await user.type(otpInput, '123456');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/cpf', { replace: true });
    });
    expect(authMocks.reload).toHaveBeenCalledTimes(1);
    expect(authMocks.getIdToken).not.toHaveBeenCalled();

    finishReload?.();
    await waitFor(() => expect(authMocks.getIdToken).toHaveBeenCalledWith(true));
  });
});
