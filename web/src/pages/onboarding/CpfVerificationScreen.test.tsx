import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CpfVerificationScreen } from './CpfVerificationScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const functionMocks = vi.hoisted(() => ({
  verifyCpf: vi.fn(),
  setUserVerified: vi.fn(),
  completeAccountMerge: vi.fn(),
  recomputeMyProfileClaim: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  firebaseUser: {
    uid: 'jordi-user',
    phoneNumber: null as string | null,
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: { verified: false } }),
    getIdToken: vi.fn().mockResolvedValue('fresh-token'),
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
  ...functionMocks,
  logVerificationFailure: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

describe('CpfVerificationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.firebaseUser.phoneNumber = null;
    sessionStorage.clear();
    authState.firebaseUser.getIdTokenResult.mockResolvedValue({ claims: { verified: false } });
    authState.firebaseUser.getIdToken.mockResolvedValue('fresh-token');
    functionMocks.verifyCpf.mockResolvedValue({data: {success: true}});
    functionMocks.setUserVerified.mockResolvedValue({data: {success: true}});
    functionMocks.completeAccountMerge.mockResolvedValue({
      data: {
        success: true,
        status: 'completed',
        alreadyCompleted: false,
        providersToRelink: [],
      },
    });
    functionMocks.recomputeMyProfileClaim.mockResolvedValue({
      data: {success: true, profileComplete: false},
    });
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

  it('conclui merge ready no servidor sem pedir CPF nem consumir outro rate limit', async () => {
    authState.firebaseUser.phoneNumber = '+5511999999999';
    sessionStorage.setItem('futeba.accountMerge', JSON.stringify({
      requestId: 'a'.repeat(64),
      status: 'ready',
    }));

    render(
      <ThemeProvider theme={createTheme()}>
        <CpfVerificationScreen />
      </ThemeProvider>,
    );

    expect(screen.queryByLabelText(/CPF/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /Concluir união de contas/i}));

    await waitFor(() => {
      expect(functionMocks.completeAccountMerge).toHaveBeenCalledWith({
        requestId: 'a'.repeat(64),
      });
    });
    expect(functionMocks.verifyCpf).not.toHaveBeenCalled();
    expect(functionMocks.setUserVerified).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('futeba.accountMerge')).toBeNull();
  });

  it('não ignora merge ready quando a conta alvo já possui claim verified', async () => {
    authState.firebaseUser.phoneNumber = '+5511999999999';
    authState.firebaseUser.getIdTokenResult.mockResolvedValue({claims: {verified: true}});
    sessionStorage.setItem('futeba.accountMerge', JSON.stringify({
      requestId: 'b'.repeat(64),
      status: 'ready',
    }));

    render(
      <ThemeProvider theme={createTheme()}>
        <CpfVerificationScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(authState.firebaseUser.getIdTokenResult).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalledWith('/', {replace: true});
    expect(screen.getByRole('button', {name: /Concluir união de contas/i})).toBeEnabled();
  });

  it('valida CPF antes do merge quando o pedido ainda está pending_cpf', async () => {
    authState.firebaseUser.phoneNumber = '+5511999999999';
    sessionStorage.setItem('futeba.accountMerge', JSON.stringify({
      requestId: 'c'.repeat(64),
      status: 'pending_cpf',
    }));

    render(
      <ThemeProvider theme={createTheme()}>
        <CpfVerificationScreen />
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: {value: '529.982.247-25'},
    });
    fireEvent.click(screen.getByRole('button', {name: /Concluir verificação/i}));

    await waitFor(() => expect(functionMocks.completeAccountMerge).toHaveBeenCalled());
    expect(functionMocks.verifyCpf).toHaveBeenCalledWith({cpf: '52998224725'});
    expect(functionMocks.verifyCpf.mock.invocationCallOrder[0])
      .toBeLessThan(functionMocks.setUserVerified.mock.invocationCallOrder[0]);
    expect(functionMocks.setUserVerified.mock.invocationCallOrder[0])
      .toBeLessThan(functionMocks.completeAccountMerge.mock.invocationCallOrder[0]);
  });
});
