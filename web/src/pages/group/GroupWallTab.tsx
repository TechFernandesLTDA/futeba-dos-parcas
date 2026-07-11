import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Stack,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Chip,
  CircularProgress,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Chat as WallIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { ShimmerLoading } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { iconSizes } from '../../theme/iconSizes';
import { useGroupWall, useCreateWallPost, useDeleteWallPost, WallPost } from '../../hooks/useGroupWall';
import { WallPostCard } from './WallPostCard';
import { WallPostComposer } from './WallPostComposer';

interface GroupWallTabProps {
  groupId: string;
  isMember: boolean;
  isAdmin: boolean;
}

export const GroupWallTab: React.FC<GroupWallTabProps> = ({
  groupId,
  isMember,
  isAdmin,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const {
    posts,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    editPost,
    togglePin,
    currentUserId,
  } = useGroupWall(groupId);
  const { create, sending, uploadProgress } = useCreateWallPost(groupId);
  const { remove, deleting } = useDeleteWallPost(groupId);
  const [editingPost, setEditingPost] = useState<WallPost | null>(null);
  const [showNewPosts, setShowNewPosts] = useState(false);
  const timelineStartRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const latestVisibleRef = useRef(true);
  const supportsIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;

  const canPost = isMember || isAdmin;
  const timelinePosts = useMemo(
    () => [...posts].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
    [posts],
  );

  const latestPostId = timelinePosts[0]?.id ?? null;
  const previousLatestPostRef = useRef<string | null>(null);

  useEffect(() => {
    const marker = timelineStartRef.current;
    if (!marker || !supportsIntersectionObserver) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        latestVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setShowNewPosts(false);
      },
      { rootMargin: '160px 0px 0px 0px' },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [supportsIntersectionObserver, timelinePosts.length]);

  useEffect(() => {
    if (previousLatestPostRef.current && latestPostId && previousLatestPostRef.current !== latestPostId) {
      if (!latestVisibleRef.current) {
        setShowNewPosts(true);
      }
    }
    previousLatestPostRef.current = latestPostId;
  }, [latestPostId]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || deleting || !supportsIntersectionObserver) return undefined;
    let requested = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || requested) return;
        requested = true;
        void loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [deleting, hasMore, loadMore, loadingMore, supportsIntersectionObserver, timelinePosts.length]);

  const formatDay = (date: Date | undefined) => {
    if (!date) return t('groupWall.timelineLatest');
    return new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language || 'pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const dayKey = (date: Date | undefined) => date ? date.toLocaleDateString('en-CA') : 'unknown';

  const scrollToLatest = () => {
    setShowNewPosts(false);
    const start = timelineStartRef.current;
    if (start && typeof start.scrollIntoView === 'function') {
      start.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCreate = async (text: string, mediaFile?: File) => {
    await create(text, { mediaFile });
  };

  const handleEdit = async (text: string) => {
    if (!editingPost) return;
    await editPost(editingPost.id, text);
    setEditingPost(null);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Stack spacing={2}>
        {canPost && (
          <Box>
            <WallPostComposer
              sending={sending}
              uploadProgress={uploadProgress}
              onSubmit={handleCreate}
            />
          </Box>
        )}

        {loading && <ShimmerLoading count={3} type="card" />}

        {!loading && error && (
          <Alert severity="error" action={
            <Button onClick={() => window.location.reload()} startIcon={<RefreshIcon />}>
              {t('common.retry')}
            </Button>
          }>
            {error}
          </Alert>
        )}

        {!loading && !error && posts.length === 0 && (
          <EmptyState
            icon={<WallIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
            title={t('groupWall.emptyTitle')}
            description={t('groupWall.emptyDesc')}
          />
        )}

        {timelinePosts.length > 0 && (
          <Box id={`group-wall-timeline-${groupId}`} ref={timelineStartRef}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5, mb: 1 }}>
              <Typography variant="overline" color="text.secondary">
                {t('groupWall.timelineTitle')}
              </Typography>
              <Divider sx={{ flex: 1 }} />
              <Chip size="small" label={t('groupWall.timelineLatest')} variant="outlined" />
            </Stack>

            {showNewPosts && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                <Button size="small" variant="contained" onClick={scrollToLatest}>
                  {t('groupWall.timelineNewPosts')}
                </Button>
              </Box>
            )}

            <Stack spacing={1.5}>
              {timelinePosts.map((post, index) => {
                const previousPost = timelinePosts[index - 1];
                const showDayDivider = index === 0 || dayKey(previousPost?.createdAt) !== dayKey(post.createdAt);
                return (
                  <React.Fragment key={post.id}>
                    {showDayDivider && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: index === 0 ? 0 : 1 }}>
                        <Divider sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          {formatDay(post.createdAt)}
                        </Typography>
                        <Divider sx={{ flex: 1 }} />
                      </Box>
                    )}
                    <WallPostCard
                      post={post}
                      isOwn={post.authorId === currentUserId}
                      canManage={isAdmin || post.authorId === currentUserId}
                      onEdit={post.authorId === currentUserId ? setEditingPost : undefined}
                      onDelete={post.authorId === currentUserId || isAdmin ? remove : undefined}
                      onTogglePin={isAdmin ? togglePin : undefined}
                    />
                  </React.Fragment>
                );
              })}
            </Stack>
          </Box>
        )}

        {hasMore && (
          <Box
            ref={loadMoreSentinelRef}
            role={loadingMore ? 'status' : undefined}
            aria-label={loadingMore ? t('groupWall.timelineLoadingOlder') : undefined}
            sx={{
              minHeight: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mt: 1,
            }}
          >
            {loadingMore && <CircularProgress size={24} />}
            {!supportsIntersectionObserver && (
              <Button
                onClick={loadMore}
                disabled={loadingMore || deleting}
                variant="outlined"
                size="small"
              >
                {loadingMore ? t('common.loading') : t('groupWall.timelineOlder')}
              </Button>
            )}
          </Box>
        )}
      </Stack>

      <Dialog
        open={editingPost !== null}
        onClose={() => setEditingPost(null)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('groupWall.editPost')}</DialogTitle>
        <DialogContent>
          {editingPost && (
            <WallPostComposer
              initialText={editingPost.text}
              sending={sending}
              onSubmit={handleEdit}
              onCancel={() => setEditingPost(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};
