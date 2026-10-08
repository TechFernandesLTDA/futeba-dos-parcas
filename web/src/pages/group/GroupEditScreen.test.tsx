import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockUpdateDoc = vi.hoisted(() => vi.fn());
const mockGetDocs = vi.hoisted(() => vi.fn());
const detailState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
  group: null as Record<string, unknown> | null,
  members: [] as Array<Record<string, unknown>>,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'group-1', path: 'groups/group-1' })),
  updateDoc: mockUpdateDoc,
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  collection: vi.fn(() => ({ id: 'members', path: 'groups/group-1/members' })),
  getDocs: mockGetDocs,
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn(async () => {}) })),
  deleteField: vi.fn(() => ({ __deleteField: true })),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('../../services/firebaseStorage', () => ({
  storage: {},
}));

vi.mock('../../utils/groupLogoStorage', () => ({
  uploadGroupLogo: vi.fn(),
}));

vi.mock('../../hooks/useGroups', () => ({
  useGroupDetail: () => detailState,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'owner-user' },
    user: { id: 'owner-user' },
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../contexts/BreadcrumbEntityContext', () => ({
  useBreadcrumbEntityLabel: vi.fn(),
}));

vi.mock('../../hooks/useAutoBreadcrumbs', () => ({
  useAppBreadcrumbOverride: vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../components/layout', () => ({
  FormScaffold: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { GroupEditScreen } from './GroupEditScreen';

const theme = createTheme();

// O aria-label do TextField vai para o <div> raiz, não para o <input>; o nome
// acessível do campo vem do <label> visível ("... *" por causa do required).
const nameFieldLabel = /groups\.groupNameRequired/;

const mockGroup = {
  id: 'group-1',
  name: 'Pelada de terça',
  description: 'Pelada semanal',
  ownerId: 'owner-user',
  isPublic: false,
};

const ownerMember = {
  userId: 'owner-user',
  userName: 'Owner',
  role: 'OWNER' as const,
  status: 'ACTIVE' as const,
  joinedAt: new Date(),
  totalGames: 0,
  level: 1,
};

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/group/group-1/edit']}>
        <ThemeProvider theme={theme}>
          <Routes>
            <Route path="/group/:groupId/edit" element={<GroupEditScreen />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GroupEditScreen', () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValue({ docs: [] });
    detailState.loading = false;
    detailState.error = null;
    detailState.group = mockGroup;
    detailState.members = [ownerMember];
  });

  it('preenche o formulário com os dados do grupo', async () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: 'groups.editGroup' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Pelada de terça')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pelada semanal')).toBeInTheDocument();
  });

  it('mostra skeleton durante loading', () => {
    detailState.loading = true;
    renderScreen();
    expect(screen.queryByRole('textbox', { name: nameFieldLabel })).not.toBeInTheDocument();
  });

  it('mostra erro quando o grupo não é encontrado', () => {
    detailState.group = null;
    renderScreen();
    expect(screen.getByText('groupDetail.notFound')).toBeInTheDocument();
  });

  it('bloqueia edição para membro sem permissão', () => {
    // O usuário logado (owner-user) é só MEMBER e não é o dono do grupo.
    detailState.group = { ...mockGroup, ownerId: 'someone-else' };
    detailState.members = [
      { ...ownerMember, userId: 'someone-else', userName: 'Dono' },
      { ...ownerMember, role: 'MEMBER' as const },
    ];
    renderScreen();
    expect(screen.getByText('groups.onlyOwnerOrAdminEdit')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: nameFieldLabel })).not.toBeInTheDocument();
  });

  it('salva alterações do formulário via updateDoc', async () => {
    const user = userEvent.setup();
    renderScreen();
    const nameInput = await screen.findByRole('textbox', { name: nameFieldLabel });
    fireEvent.change(nameInput, { target: { value: 'Pelada de quarta' } });
    await user.click(screen.getByRole('button', { name: 'a11y.saveGroupChanges' }));

    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledTimes(1));
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Pelada de quarta', is_public: false }),
    );
  });

  it('não salva quando o nome é inválido', async () => {
    const user = userEvent.setup();
    renderScreen();
    const nameInput = await screen.findByRole('textbox', { name: nameFieldLabel });
    fireEvent.change(nameInput, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'a11y.saveGroupChanges' }));
    await waitFor(() => {
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});
