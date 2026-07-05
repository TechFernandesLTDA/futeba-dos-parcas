import React, { useState, useCallback, useMemo } from 'react';
import { useGamificationColors } from '../../hooks/useGamificationColors';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  List,
  IconButton,
  Badge,
  Skeleton,
  useTheme,
  alpha,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Slide,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  SportsSoccer as SoccerIcon,
  Groups as GroupsIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  WorkspacePremium as BadgeIcon,
  HowToVote as VoteIcon,
  Cancel as CancelIcon,
  Update as UpdateIcon,
  LocalFireDepartment as StreakIcon,
  Delete as DeleteIcon,
  Undo as UndoIcon,
  DoneAll as DoneAllIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PageContainer } from '../../components/common/PageContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useConfirmPresence } from '../../hooks/useGames';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/common/EmptyState';
import type { NotificationType } from '../../types';
import { groupNotificationsByContext } from '../../utils/notificationGrouping';

const NOTIFICATION_FILTER_TYPES: Array<NotificationType | 'ALL'> = [
  'ALL',
  'GAME_INVITE',
  'GAME_SUMMON',
  'GAME_CONFIRMED',
  'GAME_REMINDER',
  'GAME_CANCELLED',
  'GAME_UPDATED',
  'GAME_VACANCY',
  'GROUP_INVITE',
  'ACHIEVEMENT',
  'BADGE_UNLOCKED',
  'LEVEL_UP',
  'MVP_RECEIVED',
  'MVP_VOTE',
  'STREAK_BROKEN',
  'SYSTEM',
];

type DateGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older';

function getDateGroup(date: Date): DateGroupKey {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'thisWeek';
  return 'older';
}

function getGroupInviteId(notification: { referenceId?: string; referenceType?: string; action?: string }): string | null {
  const match = /^group_invite\/([^/]+)$/.exec(notification.action || '');
  if (match?.[1]) return match[1];
  if (notification.referenceType === 'invite' && notification.referenceId) return notification.referenceId;
  return match?.[1] ?? null;
}

function getTypeIcon(type: string, gColors: ReturnType<typeof useGamificationColors>): React.ReactNode {
  switch (type) {
    case 'GAME_INVITE':
      return <SoccerIcon color="primary" />;
    case 'GAME_SUMMON':
      return <SoccerIcon color="warning" />;
    case 'GAME_CONFIRMED':
      return <CheckIcon color="success" />;
    case 'GAME_REMINDER':
      return <NotificationIcon color="info" />;
    case 'GAME_CANCELLED':
      return <CancelIcon color="error" />;
    case 'GAME_UPDATED':
      return <UpdateIcon color="info" />;
    case 'GAME_VACANCY':
      return <PersonAddIcon color="primary" />;
    case 'GROUP_INVITE':
      return <GroupsIcon color="secondary" />;
    case 'GROUP_INVITE_ACCEPTED':
      return <GroupsIcon color="success" />;
    case 'GROUP_INVITE_DECLINED':
      return <GroupsIcon color="error" />;
    case 'MEMBER_JOINED':
      return <PersonAddIcon color="success" />;
    case 'MEMBER_LEFT':
      return <PersonRemoveIcon color="warning" />;
    case 'ACHIEVEMENT':
      return <TrophyIcon sx={{ color: gColors.gold }} />;
    case 'BADGE_UNLOCKED':
      return <BadgeIcon sx={{ color: gColors.silver }} />;
    case 'LEVEL_UP':
      return <TrendingIcon sx={{ color: gColors.level }} />;
    case 'MVP_RECEIVED':
      return <TrophyIcon sx={{ color: gColors.mvp }} />;
    case 'MVP_VOTE':
      return <VoteIcon sx={{ color: gColors.mvp }} />;
    case 'STREAK_BROKEN':
      return <StreakIcon sx={{ color: gColors.streak }} />;
    case 'SYSTEM':
      return <NotificationIcon color="info" />;
    default:
      return <NotificationIcon />;
  }
}

function getTimeAgo(date: Date, t: ReturnType<typeof useTranslation>['t']): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t('notifications.screen.time.now');
  if (diffMins < 60) return t('notifications.screen.time.minutes', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('notifications.screen.time.hours', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return t('notifications.screen.time.days', { count: diffDays });
}

export const NotificationsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.notifications'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const { user } = useAuth();
  const { showSuccess, showError, showWithAction } = useToast();

  const {
    notifications,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    toggleRead,
    declineGameInvite,
    respondToGroupInvite,
    restoreNotification,
    deleteOldNotifications,
    acting,
  } = useNotifications(user?.id);

  const { confirmPresence } = useConfirmPresence();

  const [activeFilter, setActiveFilter] = useState<NotificationType | 'ALL'>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const notificationFilters = useMemo(() => NOTIFICATION_FILTER_TYPES.map((type) => ({
    type,
    label: t(`notifications.screen.filters.${type}`),
  })), [t]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const filteredNotifications = notifications
    .filter((n) => !dismissedIds.has(n.id))
    .filter((n) => activeFilter === 'ALL' || n.type === activeFilter);

  const groupedNotifications = groupNotificationsByContext(filteredNotifications);

  const handleAccept = useCallback(async (notification: typeof notifications[0]) => {
    setActiveActionId(notification.id);
    setActionPending(true);
    try {
      if (notification.type === 'GROUP_INVITE') {
        const inviteId = getGroupInviteId(notification);
        if (!inviteId) throw new Error('Convite de grupo inválido.');
        await respondToGroupInvite(notification.id, inviteId, 'ACCEPTED');
      } else if ((notification.type === 'GAME_INVITE' || notification.type === 'GAME_SUMMON') && notification.referenceId) {
        await confirmPresence(notification.referenceId);
        await markAsRead(notification.id);
      }
    } catch {
      showError(t('notifications.acceptError'));
    } finally {
      setActiveActionId(null);
      setActionPending(false);
    }
  }, [confirmPresence, markAsRead, respondToGroupInvite, showError, t]);

  const handleDecline = useCallback(async (notification: typeof notifications[0]) => {
    setActiveActionId(notification.id);
    setActionPending(true);
    try {
      if ((notification.type === 'GAME_INVITE' || notification.type === 'GAME_SUMMON') && notification.referenceId) {
        await declineGameInvite(notification.id, notification.referenceId);
      } else if (notification.type === 'GROUP_INVITE') {
        const inviteId = getGroupInviteId(notification);
        if (!inviteId) throw new Error('Convite de grupo inválido.');
        await respondToGroupInvite(notification.id, inviteId, 'DECLINED');
      } else {
        await markAsRead(notification.id);
        showSuccess(t('feedback.notifications.inviteDeclined'));
      }
    } catch {
      showError(t('feedback.notifications.declineError'));
    } finally {
      setActiveActionId(null);
      setActionPending(false);
    }
  }, [declineGameInvite, markAsRead, respondToGroupInvite, showSuccess, showError, t]);

  const handleDeleteWithUndo = useCallback(async (notification: typeof notifications[0]) => {
    const deletedNotif = notification;
    try {
      await deleteNotification(notification.id);
      showWithAction(t('notifications.screen.deleteUndoMessage'), {
        label: t('notifications.screen.undo'),
        onClick: () => {
          restoreNotification(deletedNotif);
        },
      }, 'info');
    } catch {
      showError(t('feedback.notifications.deleteError'));
    }
  }, [deleteNotification, restoreNotification, showWithAction, showError, t]);

  const handleClearAll = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteOldNotifications(0);
      setDeleteDialogOpen(false);
    } catch {
      showError(t('feedback.notifications.clearError'));
    } finally {
      setDeleting(false);
    }
  }, [deleteOldNotifications, showError, t]);

  const isActionable = (type: string): boolean => {
    return type === 'GROUP_INVITE' || type === 'GAME_INVITE' || type === 'GAME_SUMMON';
  };

  return (
    <Box>
      {/* Cabeçalho padronizado — badge de não-lidas + ações de gestão via `actions` */}
      <ScreenHeader
        title={t('page.title.notifications')}
        onBack={goBack}
        backAriaLabel={t('a11y.back')}
        actions={
          <>
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error" sx={{ mr: 1 }} />
            )}
            {unreadCount > 0 && (
              <IconButton
                onClick={markAllAsRead}
                aria-label={t('a11y.markAllAsRead')}
                sx={{ padding: theme.spacing(1.25) }}
              >
                <DoneAllIcon fontSize="small" />
              </IconButton>
            )}
            {notifications.length > 0 && (
              <IconButton
                onClick={() => setDeleteDialogOpen(true)}
                aria-label={t('a11y.clearAll')}
                sx={{ padding: theme.spacing(1.25) }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </>
        }
        headerSx={{ height: 'auto' }}
      />

      {/* Filtros de tipo — mantidos dentro do sticky wrapper próprio */}
      <Box
        sx={{
          position: 'sticky',
          top: (theme) => theme.spacing(7),
          bgcolor: 'background.paper',
          zIndex: 9,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          px: 1,
          pb: 1,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {notificationFilters.map((filter) => (
          <Chip
            key={filter.type}
            label={filter.label}
            size="small"
            color={activeFilter === filter.type ? 'primary' : 'default'}
            variant={activeFilter === filter.type ? 'filled' : 'outlined'}
            onClick={() => setActiveFilter(filter.type)}
            icon={activeFilter === filter.type ? <FilterIcon fontSize="small" /> : undefined}
            aria-label={t('notifications.screen.filterAria', { label: filter.label })}
          />
        ))}
      </Box>

      <PageContainer maxWidth="list">
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} sx={{ mb: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={<NotificationIcon />}
            title={t('empty.noNotifications')}
            description={activeFilter !== 'ALL' ? t('empty.noNotificationsFilter') : t('empty.noNotificationsWelcome')}
          />
        ) : (
          <Box>
            {groupedNotifications.map((group) => {
              const groupLabel = t(group.labelKey);
              const groupDescription = group.notifications.length === 1
                ? group.fallbackLabel
                : t('notifications.screen.contextSummary', {
                  count: group.notifications.length,
                  unread: group.unreadCount,
                });

              return (
                <Card key={group.key} sx={{ mb: 2, overflow: 'hidden' }}>
                  {(acting || actionPending) && group.notifications.some((notification) => notification.id === activeActionId) && (
                    <LinearProgress aria-label={t('notifications.screen.actionProgress')} />
                  )}
                  <Box sx={{ px: 2, pt: 1.5, pb: 1, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                      <Typography
                        variant="overline"
                        color="text.secondary"
                        sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.08em' }}
                      >
                        {groupLabel}
                      </Typography>
                      {group.unreadCount > 0 && (
                        <Chip
                          size="small"
                          color="primary"
                          label={t('notifications.screen.unreadCount', { count: group.unreadCount })}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {groupDescription}
                    </Typography>
                  </Box>
                  <List disablePadding aria-label={t('notifications.screen.groupListAria', { group: groupLabel })}>
                    {group.notifications.map((notification) => {
                      const dateLabel = t(`notifications.screen.dateGroups.${getDateGroup(notification.createdAt)}`);
                      const actionBusy = activeActionId === notification.id;

                      return (
                      <Slide direction="left" in key={notification.id}>
                        <Card
                          sx={{
                            borderRadius: 0,
                            borderTop: `1px solid ${theme.palette.divider}`,
                            boxShadow: 'none',
                            bgcolor: notification.read
                              ? 'background.paper'
                              : alpha(theme.palette.primary.main, 0.05),
                          }}
                        >
                          <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                              {/* #2213: avatar decorativo (ícone do tipo) — título/corpo adjacentes já descrevem. */}
                              <Avatar aria-hidden="true" sx={{ bgcolor: 'primary.main' }}>
                                {getTypeIcon(notification.type, gColors)}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {notification.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {notification.message}
                                </Typography>
                                {notification.actionType && (
                                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                                    {t('notifications.screen.actionType', { action: notification.actionType })}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.disabled">
                                  {t('notifications.screen.timeWithGroup', {
                                    time: getTimeAgo(notification.createdAt, t),
                                    group: dateLabel,
                                  })}
                                </Typography>

                                {isActionable(notification.type) && !notification.read && (
                                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="primary"
                                      onClick={() => handleAccept(notification)}
                                      startIcon={<CheckIcon />}
                                      disabled={actionBusy}
                                      aria-label={t('notifications.screen.acceptAria', { title: notification.title })}
                                    >
                                      {t('notifications.screen.accept')}
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="inherit"
                                      onClick={() => handleDecline(notification)}
                                      startIcon={<CloseIcon />}
                                      disabled={actionBusy}
                                      aria-label={t('notifications.screen.declineAria', { title: notification.title })}
                                    >
                                      {t('notifications.screen.decline')}
                                    </Button>
                                  </Box>
                                )}
                              </Box>

                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                {!notification.read ? (
                                  <IconButton
                                    onClick={() => markAsRead(notification.id)}
                                    aria-label={t('a11y.markAsRead')}
                                    size="small"
                                    sx={{ padding: theme.spacing(0.5) }}
                                  >
                                    <CheckIcon fontSize="small" color="success" />
                                  </IconButton>
                                ) : (
                                  <IconButton
                                    onClick={() => toggleRead(notification.id, notification.read)}
                                    aria-label={t('a11y.markAsUnread')}
                                    size="small"
                                    sx={{ padding: theme.spacing(0.5) }}
                                  >
                                    <UndoIcon fontSize="small" color="action" />
                                  </IconButton>
                                )}
                                <IconButton
                                  onClick={() => {
                                    handleDismiss(notification.id);
                                    handleDeleteWithUndo(notification);
                                  }}
                                  aria-label={t('a11y.deleteNotification')}
                                  size="small"
                                  sx={{ padding: theme.spacing(0.5) }}
                                >
                                  <DeleteIcon fontSize="small" color="action" />
                                </IconButton>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Slide>
                      );
                    })}
                  </List>
                </Card>
              );
            })}
          </Box>
        )}
      </PageContainer>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        role="alertdialog"
        aria-labelledby="clear-notif-title"
        aria-describedby="clear-notif-desc"
      >
        <DialogTitle id="clear-notif-title">{t('notifications.screen.clearDialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-notif-desc">
            {t('notifications.screen.clearDialog.description')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleClearAll}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={<DeleteIcon />}
          >
            {deleting ? t('notifications.screen.clearDialog.clearing') : t('notifications.screen.clearDialog.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
