import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  Avatar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Stack,
  Chip,
  useTheme,
  alpha,
  Dialog,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PushPin as PinIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { PlayerAvatar } from '../../components/common/GameCard';
import { WallPost } from '../../hooks/useGroupWall';
import { formatRelativeTime } from '../../utils/dateUtils';

interface WallPostCardProps {
  post: WallPost;
  isOwn: boolean;
  canManage: boolean;
  onEdit?: (post: WallPost) => void;
  onDelete?: (post: WallPost) => void;
  onTogglePin?: (post: WallPost, pinned: boolean) => void;
}

export const WallPostCard: React.FC<WallPostCardProps> = ({
  post,
  isOwn,
  canManage,
  onEdit,
  onDelete,
  onTogglePin,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          opacity: post.deletedAt ? 0.6 : 1,
          borderColor: post.pinned ? alpha(theme.palette.primary.main, 0.4) : undefined,
          bgcolor: post.pinned ? alpha(theme.palette.primary.main, 0.03) : undefined,
        }}
      >
        <CardContent>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <PlayerAvatar
                name={post.authorName}
                photoUrl={post.authorPhotoUrl ?? undefined}
                size={40}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" fontWeight={600} noWrap>
                    {post.authorName}
                  </Typography>
                  {post.pinned && (
                    <Chip
                      icon={<PinIcon fontSize="small" />}
                      label={t('groupWall.pinned')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatRelativeTime(post.createdAt)}
                  </Typography>
                  {post.editedAt && (
                    <Typography variant="caption" color="text.secondary">
                      ({t('groupWall.edited')})
                    </Typography>
                  )}
                </Box>
              </Box>
              {(isOwn || canManage) && (
                <IconButton
                  size="small"
                  onClick={handleOpenMenu}
                  aria-label={t('groupWall.postOptions')}
                  sx={{ ml: 'auto' }}
                >
                  <MoreIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Typography
              variant="body1"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: post.deletedAt ? 'text.secondary' : 'text.primary',
              }}
            >
              {post.text}
            </Typography>

            {post.mediaUrl && (
              <Box
                component="img"
                src={post.mediaUrl}
                alt={t('groupWall.imageAlt', { name: post.authorName })}
                loading="lazy"
                onClick={() => setLightboxOpen(true)}
                sx={{
                  width: '100%',
                  maxHeight: 360,
                  objectFit: 'cover',
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: alpha(theme.palette.common.black, 0.04),
                }}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {canManage && onTogglePin && (
          <MenuItem
            onClick={() => {
              onTogglePin(post, !post.pinned);
              handleCloseMenu();
            }}
          >
            <PinIcon fontSize="small" sx={{ mr: 1 }} />
            {post.pinned ? t('groupWall.unpin') : t('groupWall.pin')}
          </MenuItem>
        )}
        {isOwn && onEdit && (
          <MenuItem
            onClick={() => {
              onEdit(post);
              handleCloseMenu();
            }}
          >
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            {t('common.edit')}
          </MenuItem>
        )}
        {(isOwn || canManage) && onDelete && (
          <MenuItem
            onClick={() => {
              onDelete(post);
              handleCloseMenu();
            }}
            sx={{ color: theme.palette.error.main }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t('common.delete')}
          </MenuItem>
        )}
      </Menu>

      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="lg">
        {post.mediaUrl && (
          <Box
            component="img"
            src={post.mediaUrl}
            alt={t('groupWall.imageAlt', { name: post.authorName })}
            sx={{
              width: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
            }}
          />
        )}
      </Dialog>
    </>
  );
};
