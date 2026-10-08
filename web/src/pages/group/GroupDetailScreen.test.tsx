import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { GroupMemberStatus, GroupRole } from '../../types/group';

const screenState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
  group: null as Record<string, unknown> | null,
  members: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'admin-user' } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../hooks/useGroups', () => ({
  useGroupDetail: () => ({
    group: screenState.group,
    groupDeleted: false,
    members: screenState.members,
    loading: screenState.loading,
    error: screenState.error,
  }),
  useInvitePlayers: () => ({ generateInviteCode: vi.fn(), loading: false }),
}));

vi.mock('../../hooks/useGames', () => ({
  useGames: () => ({ games: [], loading: false }),
}));

vi.mock('../../hooks/useCashboxSummary', () => ({
  useCashboxSummary: () => ({ entryCount: 0, balanceCents: 0 }),
}));

vi.mock('../../hooks/useJoinRequests', () => ({
  useMyJoinRequest: () => ({
    request: null,
    submitting: false,
    requestJoin: vi.fn(),
    cancelRequest: vi.fn(),
  }),
}));

vi.mock('../../hooks/useGroupPolls', () => ({
  useGroupPolls: () => ({ polls: [], loading: false, error: null, refetch: vi.fn() }),
  useCreateGroupPoll: () => ({ mutate: vi.fn(), isPending: false }),
  useVoteGroupPoll: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../services/cloudFunctions', () => ({
  softDeleteGroup: vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../components/onboarding/FirstStepsChecklist', () => ({
  FirstStepsChecklist: () => null,
}));

vi.mock('../../components/team/TeamBadge', () => ({
  TeamBadge: () => null,
}));

vi.mock('../../components/common/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock('../../components/layout', () => ({
  AppBreadcrumbs: () => null,
  FixedBottomBar: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./GroupWallTab', () => ({
  GroupWallTab: () => null,
}));

vi.mock('react-i18next', () => {
  // Match the real hook's stable translator identity across renders.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import { GroupDetailScreen } from './GroupDetailScreen';

const theme = createTheme();

const ownerMember = {
  userId: 'owner-user',
  userName: 'Owner',
  role: 'OWNER' as GroupRole,
  status: 'ACTIVE' as GroupMemberStatus,
  joinedAt: new Date(),
  totalGames: 0,
  level: 1,
};

const adminMember = (role: GroupRole, status: GroupMemberStatus) => ({
  userId: 'admin-user',
  userName: 'Admin',
  role,
  status,
  joinedAt: new Date(),
  totalGames: 0,
  level: 1,
});

const mockGroup = {
  id: 'group-1',
  name: 'Pelada de terça',
  ownerId: 'owner-user',
  ownerName: 'Owner',
  isPublic: true,
  memberCount: 2,
  totalGamesPlayed: 0,
};

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/group/group-1']}>
        <ThemeProvider theme={theme}>
          <Routes>
            <Route path="/group/:groupId" element={<GroupDetailScreen />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GroupDetailScreen — render principal', () => {
  beforeEach(() => {
    screenState.loading = false;
    screenState.error = null;
    screenState.group = mockGroup;
    screenState.members = [ownerMember, adminMember('ADMIN', 'ACTIVE')];
  });

  it('renderiza o header com o nome do grupo', () => {
    renderScreen();
    expect(screen.getAllByText('Pelada de terça').length).toBeGreaterThan(0);
  });

  it('renderiza as abas de navegação', () => {
    renderScreen();
    expect(screen.getByRole('tab', { name: 'group.tabGames' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'group.tabMembers' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'group.tabCashbox' })).toBeInTheDocument();
  });

  it('ao abrir a aba de membros lista os integrantes', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'group.tabMembers' }));
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('mostra skeleton e não renderiza o grupo durante loading', () => {
    screenState.loading = true;
    renderScreen();
    expect(screen.queryByText('Pelada de terça')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('mostra ErrorScreen em caso de erro', () => {
    screenState.error = 'Falha ao carregar grupo';
    renderScreen();
    expect(screen.getByText('Falha ao carregar grupo')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('mostra estado de grupo não encontrado', () => {
    screenState.group = null;
    renderScreen();
    expect(screen.getByText('groupDetail.notFound')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.back' })).toBeInTheDocument();
  });
});
