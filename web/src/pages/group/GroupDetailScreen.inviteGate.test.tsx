import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { GroupMemberStatus, GroupRole } from '../../types/group';

let currentRole: GroupRole = 'ADMIN';
let currentStatus: GroupMemberStatus = 'ACTIVE';

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
    group: {
      id: 'group-1',
      name: 'Pelada de terça',
      ownerId: 'owner-user',
      ownerName: 'Owner',
      isPublic: true,
      memberCount: 2,
      totalGamesPlayed: 0,
    },
    groupDeleted: false,
    members: [
      {
        userId: 'owner-user',
        userName: 'Owner',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date(),
        totalGames: 0,
        level: 1,
      },
      {
        userId: 'admin-user',
        userName: 'Admin',
        role: currentRole,
        status: currentStatus,
        joinedAt: new Date(),
        totalGames: 0,
        level: 1,
      },
    ],
    loading: false,
    error: null,
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { GroupDetailScreen } from './GroupDetailScreen';

const theme = createTheme();

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

function openMembersTab() {
  fireEvent.click(screen.getByRole('tab', { name: 'group.tabMembers' }));
}

describe('GroupDetailScreen invite gate', () => {
  beforeEach(() => {
    currentRole = 'ADMIN';
    currentStatus = 'ACTIVE';
  });

  it('exibe o botão permanente de convite para ADMIN ativo (#3613)', () => {
    renderScreen();
    openMembersTab();

    const inviteButton = screen.getByRole('button', { name: 'groupDetail.invite' });
    expect(inviteButton).toBeInTheDocument();

    fireEvent.click(inviteButton);
    expect(screen.getByRole('dialog', { name: 'groups.invitePlayers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'groupDetail.generateInvite' })).toBeInTheDocument();
  });

  it('não exibe o botão para MEMBER ativo', () => {
    currentRole = 'MEMBER';

    renderScreen();
    openMembersTab();

    expect(screen.queryByRole('button', { name: 'groupDetail.invite' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'groups.invitePlayers' })).not.toBeInTheDocument();
  });

  it('não exibe o botão para ADMIN inativo', () => {
    currentStatus = 'INACTIVE';

    renderScreen();
    openMembersTab();

    expect(screen.queryByRole('button', { name: 'groupDetail.invite' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'groups.invitePlayers' })).not.toBeInTheDocument();
  });
});
