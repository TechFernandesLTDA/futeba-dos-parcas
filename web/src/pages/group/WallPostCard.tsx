import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
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
  Alert,
  Button,
  Skeleton,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  PushPin as PinIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Groups as GroupsIcon,
  Flag as ReportIcon,
  VisibilityOff as HideIcon,
} from '@mui/icons-material';
import { PlayerAvatar } from '../../components/common/GameCard';
import { ReactionBar } from '../../components/reactions/ReactionBar';
import { WallPost } from '../../hooks/useGroupWall';
import { formatRelativeTime } from '../../utils/dateUtils';

interface WallPostCardProps {
  post: WallPost;
  isOwn: boolean;
  canManage: boolean;
  onEdit?: (post: WallPost) => void;
  onDelete?: (post: WallPost) => void;
  onTogglePin?: (postId: string, pinned: boolean) => void;
  originLabel?: string;
  onOpenOrigin?: () => void;
  onHide?: (post: WallPost) => void;
  onReport?: (post: WallPost) => void;
}

export const WallPostCard: React.FC<WallPostCardProps> = ({
  post,
  isOwn,
  canManage,
  onEdit,
  onDelete,
  onTogglePin,
  originLabel,
  onOpenOrigin,
  onHide,
  onReport,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(Boolean(post.mediaUrl));
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaRetry, setMediaRetry] = useState(0);
  const menuOpen = Boolean(anchorEl);
  const isVideo = post.mediaType?.startsWith('video/') ?? false;
  const exactDateTime = post.createdAt
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language || 'pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(post.createdAt)
    : '';

  useEffect(() => {
    setMediaLoading(Boolean(post.mediaUrl));
    setMediaFailed(false);
    setMediaRetry(0);
  }, [post.mediaUrl]);

  const handleRetryMedia = () => {
    setMediaFailed(false);
    setMediaLoading(true);
    setMediaRetry((current) => current + 1);
  };

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
                  {originLabel && (
                    <Chip
                      icon={<GroupsIcon fontSize="small" />}
                      label={originLabel}
                      size="small"
                      variant="outlined"
                      clickable={Boolean(onOpenOrigin)}
                      onClick={onOpenOrigin}
                    />
                  )}
                  <Typography
                    component="time"
                    dateTime={post.createdAt?.toISOString()}
                    variant="caption"
                    color="text.secondary"
                    title={exactDateTime}
                  >
                    {formatRelativeTime(post.createdAt)}{exactDateTime ? ` · ${exactDateTime}` : ''}
                  </Typography>
                  {post.editedAt && (
                    <Typography variant="caption" color="text.secondary">
                      ({t('groupWall.edited')})
                    </Typography>
                  )}
                </Box>
              </Box>
              {(isOwn || canManage || onHide || onReport) && (
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

            {post.text && (
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
            )}

            {post.mediaUrl && (
              <Box
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 2,
                  bgcolor: theme.palette.action.hover,
                  minHeight: isVideo ? 180 : mediaLoading ? 180 : 0,
                }}
              >
                {mediaLoading && !mediaFailed && !isVideo && (
                  <Skeleton
                    variant="rectangular"
                    height={280}
                    animation="wave"
                    aria-label={t('common.loading')}
                    sx={{ position: 'absolute', inset: 0, zIndex: 1 }}
                  />
                )}
                {!mediaFailed && (
                  <Box
                    key={mediaRetry}
                    component={isVideo ? 'div' : 'button'}
                    type={isVideo ? undefined : 'button'}
                    onClick={isVideo ? undefined : () => setLightboxOpen(true)}
                    aria-label={isVideo ? undefined : t('groupWall.openPhoto', { name: post.authorName })}
                    sx={{
                        display: 'block',
                        width: '100%',
                        p: 0,
                        border: isVideo ? 0 : undefined,
                        cursor: isVideo ? 'default' : 'pointer',
                      bgcolor: 'transparent',
                      '&:focus-visible': {
                        outline: `3px solid ${theme.palette.primary.main}`,
                        outlineOffset: -3,
                      },
                    }}
                  >
                    {isVideo ? (
                      <Box
                        component="video"
                        src={post.mediaUrl}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label={t('groupWall.openVideo', { name: post.authorName })}
                        onLoadedMetadata={() => setMediaLoading(false)}
                        onLoadedData={() => setMediaLoading(false)}
                        onCanPlay={() => setMediaLoading(false)}
                        onError={() => {
                          setMediaLoading(false);
                          setMediaFailed(true);
                        }}
                        sx={{
                          display: 'block',
                          width: '100%',
                          maxHeight: 420,
                          minHeight: 180,
                          objectFit: 'contain',
                          bgcolor: theme.palette.common.black,
                          opacity: 1,
                        }}
                      />
                    ) : (
                      <Box
                        component="img"
                        src={post.mediaUrl}
                        alt={t('groupWall.imageAlt', { name: post.authorName })}
                        loading="lazy"
                        onLoad={() => setMediaLoading(false)}
                        onError={() => {
                          setMediaLoading(false);
                          setMediaFailed(true);
                        }}
                        sx={{
                          display: 'block',
                          width: '100%',
                          maxHeight: 420,
                          objectFit: 'cover',
                          opacity: mediaLoading ? 0 : 1,
                        }}
                      />
                    )}
                  </Box>
                )}
                {mediaFailed && (
                  <Alert
                    severity="warning"
                    action={(
                      <Button color="inherit" size="small" onClick={handleRetryMedia}>
                        {t(isVideo ? 'groupWall.retryVideo' : 'groupWall.retryImage')}
                      </Button>
                    )}
                    sx={{ borderRadius: 0 }}
                  >
                    {t(isVideo ? 'groupWall.videoLoadError' : 'groupWall.imageLoadError')}
                  </Alert>
                )}
              </Box>
            )}

            {!post.deletedAt && (
              <ReactionBar
                targetPath={`groups/${post.groupId}/wall_posts/${post.id}`}
                reactions={post.reactions ?? undefined}
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
              onTogglePin(post.id, !post.pinned);
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
        {onHide && (
          <MenuItem
            onClick={() => {
              onHide(post);
              handleCloseMenu();
            }}
          >
            <HideIcon fontSize="small" sx={{ mr: 1 }} />
            {t('socialFeed.hidePost')}
          </MenuItem>
        )}
        {onReport && (
          <MenuItem
            onClick={() => {
              onReport(post);
              handleCloseMenu();
            }}
            sx={{ color: theme.palette.warning.main }}
          >
            <ReportIcon fontSize="small" sx={{ mr: 1 }} />
            {t('socialFeed.reportPost')}
          </MenuItem>
        )}
      </Menu>

      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} maxWidth="lg">
        {post.mediaUrl && (
          isVideo ? (
            <Box
              component="video"
              src={post.mediaUrl}
              controls
              autoPlay
              playsInline
              aria-label={t('groupWall.openVideo', { name: post.authorName })}
              sx={{ width: '100%', maxHeight: '90vh', bgcolor: theme.palette.common.black }}
            />
          ) : (
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
          )
        )}
      </Dialog>
    </>
  );
};
