// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { WallPost } from '../../hooks/useGroupWall';
import { GroupWallTab } from './GroupWallTab';

const wallState = vi.hoisted(() => ({
  posts: [] as WallPost[],
  hasMore: false,
  loadingMore: false,
  loadMore: vi.fn().mockResolvedValue(undefined),
}));

const observerState = vi.hoisted(() => ({
  instances: [] as Array<{
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../../components/common/GameCard', () => ({ ShimmerLoading: () => null }));
vi.mock('../../components/common/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-wall" />,
}));
vi.mock('./WallPostCard', () => ({
  WallPostCard: ({ post }: {post: WallPost}) => (
    <div data-testid="wall-post-card">{post.id}</div>
  ),
}));
vi.mock('../../hooks/useGroupWall', () => ({
  useGroupWall: () => ({
    posts: wallState.posts,
    loading: false,
    error: null,
    hasMore: wallState.hasMore,
    loadingMore: wallState.loadingMore,
    loadMore: wallState.loadMore,
    editPost: vi.fn(),
    togglePin: vi.fn(),
    currentUserId: 'user-1',
  }),
  useCreateWallPost: () => ({ create: vi.fn(), sending: false, uploadProgress: null }),
  useDeleteWallPost: () => ({ remove: vi.fn(), deleting: false }),
}));

function makePost(id: string, createdAt: string, pinned = false): WallPost {
  return {
    id,
    groupId: 'group-1',
    authorId: 'user-1',
    authorName: 'Jordi',
    authorPhotoUrl: null,
    text: id,
    mediaUrl: null,
    mediaPath: null,
    mediaType: null,
    thumbnailPath: null,
    highlightRef: null,
    pinned,
    pinnedBy: null,
    createdAt: new Date(createdAt),
    deletedAt: null,
    deletedBy: null,
    reactions: {},
    commentsCount: 0,
  };
}

describe('GroupWallTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallState.posts = [];
    wallState.hasMore = false;
    wallState.loadingMore = false;
    observerState.instances = [];
    vi.stubGlobal('IntersectionObserver', class {
      callback: IntersectionObserverCallback;
      options?: IntersectionObserverInit;
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback;
        this.options = options;
        observerState.instances.push(this);
      }
    });
  });

  it('mostra o compositor diretamente sem o botão Criar post', () => {
    renderWithProviders(<GroupWallTab groupId="group-1" isMember isAdmin={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar post' })).not.toBeInTheDocument();
  });

  it('mantém a mensagem mais recente no topo independentemente da ordem recebida', () => {
    wallState.posts = [
      makePost('antiga', '2026-07-09T18:00:00.000Z'),
      makePost('mais-recente', '2026-07-10T18:00:00.000Z'),
      makePost('intermediaria-fixada', '2026-07-10T12:00:00.000Z', true),
    ];
    renderWithProviders(<GroupWallTab groupId="group-1" isMember isAdmin={false} />);
    expect(screen.getAllByTestId('wall-post-card').map((node) => node.textContent)).toEqual([
      'mais-recente',
      'intermediaria-fixada',
      'antiga',
    ]);
  });

  it('carrega mensagens antigas quando o sentinel inferior entra na viewport', () => {
    wallState.posts = [makePost('mais-recente', '2026-07-10T18:00:00.000Z')];
    wallState.hasMore = true;
    renderWithProviders(<GroupWallTab groupId="group-1" isMember isAdmin={false} />);
    const paginationObserver = observerState.instances.find(
      ({ options }) => options?.rootMargin === '600px 0px',
    );
    expect(paginationObserver).toBeDefined();
    act(() => {
      paginationObserver?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(wallState.loadMore).toHaveBeenCalledTimes(1);
  });
});
