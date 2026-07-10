// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { GroupWallTab } from './GroupWallTab';

vi.mock('../../components/common/GameCard', () => ({
  ShimmerLoading: () => null,
}));

vi.mock('../../components/common/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-wall" />,
}));

vi.mock('./WallPostCard', () => ({
  WallPostCard: () => null,
}));

vi.mock('../../hooks/useGroupWall', () => ({
  useGroupWall: () => ({
    posts: [],
    loading: false,
    error: null,
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    editPost: vi.fn(),
    togglePin: vi.fn(),
    currentUserId: 'user-1',
  }),
  useCreateWallPost: () => ({
    create: vi.fn(),
    sending: false,
    uploadProgress: null,
  }),
  useDeleteWallPost: () => ({
    remove: vi.fn(),
    deleting: false,
  }),
}));

describe('GroupWallTab', () => {
  it('mostra o compositor diretamente sem o botão Criar post', () => {
    renderWithProviders(
      <GroupWallTab groupId="group-1" isMember isAdmin={false} />,
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar post' })).not.toBeInTheDocument();
  });
});
