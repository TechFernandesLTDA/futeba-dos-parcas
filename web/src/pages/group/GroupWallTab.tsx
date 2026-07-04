import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Stack,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
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
  const { t } = useTranslation();
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
  const { create, sending } = useCreateWallPost(groupId);
  const { remove, deleting } = useDeleteWallPost(groupId);
  const [editingPost, setEditingPost] = useState<WallPost | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const canPost = isMember || isAdmin;
  const pinnedPosts = posts.filter((p) => p.pinned);
  const regularPosts = posts.filter((p) => !p.pinned);

  const handleCreate = async (text: string, imageFile?: File) => {
    await create(text, { imageFile });
    setComposerOpen(false);
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
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<WallIcon />}
              onClick={() => setComposerOpen(true)}
            >
              {t('groupWall.createPost')}
            </Button>
          </Box>
        )}

        {canPost && (
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <WallPostComposer
              sending={sending}
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

        {pinnedPosts.length > 0 && (
          <Stack spacing={1.5}>
            {pinnedPosts.map((post) => (
              <WallPostCard
                key={post.id}
                post={post}
                isOwn={post.authorId === currentUserId}
                canManage={isAdmin || post.authorId === currentUserId}
                onEdit={post.authorId === currentUserId ? setEditingPost : undefined}
                onDelete={post.authorId === currentUserId || isAdmin ? remove : undefined}
                onTogglePin={isAdmin ? togglePin : undefined}
              />
            ))}
          </Stack>
        )}

        {regularPosts.length > 0 && (
          <Stack spacing={1.5}>
            {regularPosts.map((post) => (
              <WallPostCard
                key={post.id}
                post={post}
                isOwn={post.authorId === currentUserId}
                canManage={isAdmin || post.authorId === currentUserId}
                onEdit={post.authorId === currentUserId ? setEditingPost : undefined}
                onDelete={post.authorId === currentUserId || isAdmin ? remove : undefined}
                onTogglePin={isAdmin ? togglePin : undefined}
              />
            ))}
          </Stack>
        )}

        {hasMore && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              onClick={loadMore}
              disabled={loadingMore || deleting}
              variant="outlined"
              size="small"
            >
              {loadingMore ? t('common.loading') : t('groupWall.loadMore')}
            </Button>
          </Box>
        )}
      </Stack>

      <Dialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('groupWall.createPost')}</DialogTitle>
        <DialogContent>
          <WallPostComposer
            sending={sending}
            onSubmit={handleCreate}
            onCancel={() => setComposerOpen(false)}
          />
        </DialogContent>
      </Dialog>

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
