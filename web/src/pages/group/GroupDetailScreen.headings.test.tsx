import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('GroupDetailScreen headings (#4189)', () => {
  beforeEach(() => {
    currentRole = 'ADMIN';
    currentStatus = 'ACTIVE';
  });

  it('expõe o nome do grupo em um único heading (h1 do ScreenHeader)', () => {
    renderScreen();

    const headings = screen.getAllByRole('heading', { name: 'Pelada de terça' });
    expect(headings).toHaveLength(1);
    expect(headings[0].tagName).toBe('H1');
    // O nome continua visível no hero, só que como texto (não-heading).
    expect(screen.getAllByText('Pelada de terça').length).toBeGreaterThanOrEqual(2);
  });

  it('não repete heading do mesmo nível no hero (sem h4 com o nome do grupo)', () => {
    renderScreen();

    const h4 = screen.queryAllByRole('heading', { level: 4 });
    expect(h4.some((h) => h.textContent === 'Pelada de terça')).toBe(false);
  });
});
