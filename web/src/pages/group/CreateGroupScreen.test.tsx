import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';

const createGroupState = vi.hoisted(() => ({
  createGroup: vi.fn(),
  loading: false,
  error: null as string | null,
}));

const authState = vi.hoisted(() => ({
  role: 'ADMIN' as string | undefined,
}));

const showError = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../hooks/useGroups', () => ({
  useCreateGroup: () => createGroupState,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Test', role: authState.role } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError, showSuccess: vi.fn() }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../components/layout', () => ({
  FormScaffold: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
  AdaptiveFormSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { CreateGroupScreen } from './CreateGroupScreen';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const theme = createTheme();

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CreateGroupScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const submitButton = () => screen.getByRole('button', { name: 'groups.createGroup' });
const nameInput = () => screen.getByLabelText(/groups\.groupNameRequired/);

describe('CreateGroupScreen', () => {
  beforeEach(() => {
    createGroupState.createGroup.mockReset();
    createGroupState.createGroup.mockResolvedValue('group-novo');
    createGroupState.loading = false;
    createGroupState.error = null;
    authState.role = 'ADMIN';
    showError.mockClear();
    mockNavigate.mockClear();
  });

  it('renderiza o formulário com campos principais', () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'groups.createGroup' })).toBeInTheDocument();
    expect(nameInput()).toBeInTheDocument();
    expect(screen.getByLabelText('groups.description')).toBeInTheDocument();
    expect(screen.getByLabelText('groups.defaultGender')).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });

  it('não submete com nome vazio (validação bloqueia)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(submitButton());
    expect(createGroupState.createGroup).not.toHaveBeenCalled();
  });

  it('submete com dados preenchidos e navega ao grupo criado', async () => {
    const user = userEvent.setup();
    renderScreen();
    fireEvent.change(nameInput(), { target: { value: 'Pelada de Terça' } });
    fireEvent.change(screen.getByLabelText('groups.description'), { target: { value: 'Pelada de quinta' } });
    await user.click(screen.getByRole('checkbox'));
    await user.click(submitButton());

    await waitFor(() => expect(createGroupState.createGroup).toHaveBeenCalledWith(
      { name: 'Pelada de Terça', description: 'Pelada de quinta', isPublic: true, defaultGender: undefined },
      null,
    ));
    expect(mockNavigate).toHaveBeenCalledWith('/group/group-novo');
  });

  it('bloqueia usuário sem permissão (só FIELD_OWNER/ADMIN criam)', async () => {
    authState.role = 'PLAYER';
    const user = userEvent.setup();
    renderScreen();
    fireEvent.change(nameInput(), { target: { value: 'Pelada de Terça' } });
    await user.click(submitButton());
    expect(createGroupState.createGroup).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('groups.onlyOwnersCanCreate');
  });

  it('desabilita o botão durante o loading', () => {
    createGroupState.loading = true;
    renderScreen();
    expect(submitButton()).toBeDisabled();
  });

  it('exibe erro do hook em Alert', () => {
    createGroupState.error = 'Erro de rede';
    renderScreen();
    expect(screen.getByText('Erro de rede')).toBeInTheDocument();
  });
});
