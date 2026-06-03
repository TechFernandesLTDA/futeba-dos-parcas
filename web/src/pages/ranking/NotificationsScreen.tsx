import React, { useState, useCallback } from 'react';
import { useGamificationColors } from '../../hooks/useGamificationColors';
import { useNavigate } from 'react-router-dom';
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
  useMediaQuery,
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

const ALL_FILTERS: Array<{ type: NotificationType | 'ALL'; label: string }> = [
  { type: 'ALL', label: 'Todas' },
  { type: 'GAME_INVITE', label: 'Jogos' },
  { type: 'GAME_SUMMON', label: 'Convocações' },
  { type: 'GAME_CONFIRMED', label: 'Confirmados' },
  { type: 'GAME_REMINDER', label: 'Lembretes' },
  { type: 'GAME_CANCELLED', label: 'Cancelados' },
  { type: 'GAME_UPDATED', label: 'Atualizados' },
  { type: 'GAME_VACANCY', label: 'Vagas' },
  { type: 'GROUP_INVITE', label: 'Grupos' },
  { type: 'ACHIEVEMENT', label: 'Conquistas' },
  { type: 'BADGE_UNLOCKED', label: 'Badges' },
  { type: 'LEVEL_UP', label: 'Nível' },
  { type: 'MVP_RECEIVED', label: 'MVP' },
  { type: 'MVP_VOTE', label: 'Votações' },
  { type: 'STREAK_BROKEN', label: 'Streak' },
  { type: 'SYSTEM', label: 'Sistema' },
];

function getDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return 'Esta semana';
  return 'Mais antigos';
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

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export const NotificationsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.notifications'));
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
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
    restoreNotification,
    deleteOldNotifications,
  } = useNotifications(user?.id);

  const { confirmPresence } = useConfirmPresence();

  const [activeFilter, setActiveFilter] = useState<NotificationType | 'ALL'>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const filteredNotifications = notifications
    .filter((n) => !dismissedIds.has(n.id))
    .filter((n) => activeFilter === 'ALL' || n.type === activeFilter);

  const groupedNotifications = filteredNotifications.reduce<Record<string, typeof notifications>>((acc, n) => {
    const group = getDateGroup(n.createdAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(n);
    return acc;
  }, {});

  const dateGroupOrder = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigos'];

  const handleAccept = useCallback(async (notification: typeof notifications[0]) => {
    try {
      if (notification.type === 'GROUP_INVITE' && notification.referenceId) {
        await markAsRead(notification.id);
        navigate(`/group/${notification.referenceId}`);
        showSuccess(t('feedback.notifications.navigatingToGroup'));
      } else if ((notification.type === 'GAME_INVITE' || notification.type === 'GAME_SUMMON') && notification.referenceId) {
        await confirmPresence(notification.referenceId);
        await markAsRead(notification.id);
      }
    } catch {
      showError(t('notifications.acceptError'));
    }
  }, [confirmPresence, markAsRead, showSuccess, showError, navigate, t]);

  const handleDecline = useCallback(async (notification: typeof notifications[0]) => {
    try {
      await markAsRead(notification.id);
      showSuccess(t('feedback.notifications.inviteDeclined'));
    } catch {
      showError(t('feedback.notifications.declineError'));
    }
  }, [markAsRead, showSuccess, showError, t]);

  const handleDeleteWithUndo = useCallback(async (notification: typeof notifications[0]) => {
    const deletedNotif = notification;
    try {
      await deleteNotification(notification.id);
      showWithAction('Notificação removida.', {
        label: 'Desfazer',
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
    <Box sx={{ pb: 4 }}>
      {/* Cabeçalho padronizado — badge de não-lidas + ações de gestão via `actions` */}
      <ScreenHeader
        title="Notificações"
        onBack={goBack}
        backAriaLabel="Voltar"
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
        {ALL_FILTERS.map((filter) => (
          <Chip
            key={filter.type}
            label={filter.label}
            size="small"
            color={activeFilter === filter.type ? 'primary' : 'default'}
            variant={activeFilter === filter.type ? 'filled' : 'outlined'}
            onClick={() => setActiveFilter(filter.type)}
            icon={activeFilter === filter.type ? <FilterIcon fontSize="small" /> : undefined}
            aria-label={`Filtrar por ${filter.label}`}
          />
        ))}
      </Box>

      <PageContainer maxWidth={isMd ? 'detail' : 'list'}>
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
            {dateGroupOrder.map((groupLabel) => {
              const groupItems = groupedNotifications[groupLabel];
              if (!groupItems || groupItems.length === 0) return null;

              return (
                <Box key={groupLabel} sx={{ mb: 2 }}>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ px: 1, fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.08em' }}
                  >
                    {groupLabel}
                  </Typography>
                  <List disablePadding aria-label={`Notificações - ${groupLabel}`}>
                    {groupItems.map((notification) => (
                      <Slide direction="left" in key={notification.id}>
                        <Card
                          sx={{
                            mb: 1,
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
                                    Ação: {notification.actionType}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.disabled">
                                  {getTimeAgo(notification.createdAt)}
                                </Typography>

                                {isActionable(notification.type) && !notification.read && (
                                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="primary"
                                      onClick={() => handleAccept(notification)}
                                      startIcon={<CheckIcon />}
                                      aria-label={`Aceitar ${notification.title}`}
                                    >
                                      Aceitar
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="inherit"
                                      onClick={() => handleDecline(notification)}
                                      startIcon={<CloseIcon />}
                                      aria-label={`Recusar ${notification.title}`}
                                    >
                                      Recusar
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
                    ))}
                  </List>
                </Box>
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
        <DialogTitle id="clear-notif-title">Limpar todas as notificações?</DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-notif-desc">
            Esta ação removerá todas as suas notificações. Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleClearAll}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={<DeleteIcon />}
          >
            {deleting ? 'Limpando...' : 'Limpar tudo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
