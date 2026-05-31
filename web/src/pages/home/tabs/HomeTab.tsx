import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLevelForXp, getXpProgress, getLevelEntry, getXpRemaining } from '../../../types/gamification';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../../../hooks/useOnboarding';
import { PullToRefresh } from '../../../components/common/PullToRefresh';
import { FirstStepsChecklist } from '../../../components/onboarding/FirstStepsChecklist';
import type { ChecklistStep } from '../../../components/onboarding/FirstStepsChecklist';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Skeleton,
  LinearProgress,
  Link,
  Button,
  ButtonBase,
  CircularProgress,
  Grid,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  SportsSoccer,
  SportsScore,
  CalendarMonth,
  LocationOn,
  People,
  EmojiEvents,
  CheckCircle,
  LiveTv,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { iconSizes } from '../../../theme/iconSizes';
import { pageSpacing } from '../../../theme/pageTokens';
import { useGamificationColors } from '../../../hooks/useGamificationColors';
import { useConfirmPresence } from '../../../hooks/useGames';
import { useNextGame } from '../../../hooks/useNextGame';
import { useWaitlist } from '../../../hooks/useWaitlist';
import { useGroups } from '../../../hooks/useGroups';
import { snakeToCamel } from '../../../utils/firestoreHelpers';
import { formatGameDateLong, formatTimeAgo as formatTimeAgoUtil } from '../../../utils/dateFormatters';
import { useToast } from '../../../contexts/ToastContext';
import { createLogger } from '../../../utils/logger';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { TeamBadge } from '../../../components/team/TeamBadge';
import PlayerCard from '../../../components/player/PlayerCard';
import { LeaguePlayer } from '../../../hooks/useLeague';
import { StreakWidget } from './StreakWidget';
import { RecentActivityFeed } from './RecentActivityFeed';
import type { Activity } from './RecentActivityFeed';

const logger = createLogger('HomeTab');

// #2276: interface tipada para o doc de atividade/notificação (substitui Record<string, any>).
interface RawActivityDoc {
  type?: string;
  title?: string;
  message?: string;
  body?: string;
  senderName?: string;
  senderPhoto?: string;
  referenceType?: string;
  referenceId?: string;
  groupId?: string;
  senderId?: string;
}

// ─── NextGameWidget ──────────────────────────────────────────────────────────

function NextGameWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { showError } = useToast();
  const queryClient = useQueryClient();

  const { nextGame, isLoading: gamesLoading } = useNextGame();

  const { confirmPresence, cancelPresence, loading: confirmLoading } = useConfirmPresence();

  // #1336: lista de espera (subcoleção games/{id}/waitlist, paridade
  // Android + CF). Chamado antes de qualquer early return (rules of hooks).
  const {
    myEntry: waitlistEntry,
    acting: waitlistActing,
    joinWaitlist,
    leaveWaitlist,
  } = useWaitlist(nextGame?.id ?? null);

  const { data: userConfirmation, isLoading: confCheckLoading } = useQuery({
    queryKey: ['confirmation', nextGame?.id, user?.id],
    queryFn: async () => {
      if (!nextGame?.id || !user?.id) return null;
      const docRef = doc(db, 'confirmations', `${nextGame.id}_${user.id}`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return snap.data();
    },
    enabled: !!nextGame?.id && !!user?.id,
    staleTime: 30_000,
  });

  const [optimisticConfirmed, setOptimisticConfirmed] = useState(false);
  const isConfirmed = !!userConfirmation || optimisticConfirmed;

  useEffect(() => {
    setOptimisticConfirmed(false);
  }, [nextGame?.id]);

  const handleConfirm = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!nextGame) return;
      try {
        setOptimisticConfirmed(true);
        await confirmPresence(nextGame.id);
        queryClient.invalidateQueries({ queryKey: ['confirmation', nextGame.id, user?.id] });
        queryClient.invalidateQueries({ queryKey: ['games'] });
      } catch (err) {
        setOptimisticConfirmed(false);
        showError(t('games.presenceConfirmError'));
        logger.error('Confirm presence failed:', err);
      }
    },
    [nextGame, confirmPresence, queryClient, user?.id, showError, t],
  );

  const handleCancel = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!nextGame) return;
      try {
        setOptimisticConfirmed(false);
        await cancelPresence(nextGame.id);
        queryClient.invalidateQueries({ queryKey: ['confirmation', nextGame.id, user?.id] });
        queryClient.invalidateQueries({ queryKey: ['games'] });
      } catch (err) {
        showError(t('games.presenceCancelError'));
        logger.error('Cancel presence failed:', err);
      }
    },
    [nextGame, cancelPresence, queryClient, user?.id, showError, t],
  );

  const handleJoinWaitlist = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await joinWaitlist();
    },
    [joinWaitlist],
  );

  const handleLeaveWaitlist = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await leaveWaitlist();
    },
    [leaveWaitlist],
  );

  const statusColors: Record<string, string> = {
    SCHEDULED: theme.palette.success.main,
    CONFIRMED: theme.palette.info.main,
    LIVE: theme.palette.error.main,
  };
  const statusLabels: Record<string, string> = {
    SCHEDULED: t('games.statusOpen'),
    CONFIRMED: t('games.statusClosed'),
    LIVE: t('games.statusLive'),
  };

  // ── Loading ──
  if (gamesLoading || confCheckLoading) {
    return (
      <Card sx={{ mb: pageSpacing.sectionSpacing }}>
        <CardContent>
          <Skeleton variant="text" width="45%" height={28} />
          <Skeleton variant="text" width="65%" />
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="rounded" height={36} sx={{ mt: 1.5 }} />
        </CardContent>
      </Card>
    );
  }

  // ── No game ──
  if (!nextGame) {
    return (
      <Card
        sx={{
          mb: pageSpacing.sectionSpacing,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CalendarMonth sx={{ fontSize: iconSizes.xl, color: 'text.disabled' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {t('games.noGameScheduled')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('games.noGameScheduledDesc')}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/?tab=1');
              }}
              sx={{ flexShrink: 0 }}
            >
              {t('games.createGame')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // ── LIVE ──
  if (nextGame.status === 'LIVE') {
    return (
      <Card
        sx={{
          mb: pageSpacing.sectionSpacing,
          bgcolor: alpha(theme.palette.error.main, 0.06),
          border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
        }}
      >
        <CardActionArea onClick={() => navigate(`/game/${nextGame.id}`)}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LiveTv sx={{ fontSize: iconSizes.xl, color: theme.palette.error.main }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {t('games.liveNow')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {nextGame.locationName} • {t('games.playersCount', { current: nextGame.playersCount, max: nextGame.maxPlayers })}
                </Typography>
              </Box>
              <Button variant="contained" color="error" size="small" startIcon={<LiveTv />}>
                {t('games.watchLive')}
              </Button>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  }

  // ── Has game (SCHEDULED / CONFIRMED) ──
  const isFull = nextGame.playersCount >= nextGame.maxPlayers;

  return (
    <Card
      sx={{
        mb: pageSpacing.sectionSpacing,
        border: isConfirmed
          ? `1px solid ${alpha(theme.palette.success.main, 0.3)}`
          : `1px solid ${alpha(statusColors[nextGame.status] || theme.palette.primary.main, 0.12)}`,
      }}
    >
      <CardActionArea onClick={() => navigate(`/game/${nextGame.id}`)}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {t('games.nextGame')}
              </Typography>
              <Chip
                label={statusLabels[nextGame.status]}
                size="small"
                sx={{
                  bgcolor: alpha(statusColors[nextGame.status] || theme.palette.primary.main, 0.12),
                  color: statusColors[nextGame.status] || theme.palette.primary.main,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
              {isConfirmed && (
                <Chip
                    icon={<CheckCircle sx={{ fontSize: iconSizes.xs }} />}
                  label={t('games.confirmed_chip')}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.12),
                    color: theme.palette.success.main,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Box>
            <Chip
              icon={<People sx={{ fontSize: iconSizes.sm }} />}
              label={`${nextGame.playersCount}/${nextGame.maxPlayers}`}
              size="small"
              sx={{ flexShrink: 0, ml: 1, fontWeight: 600 }}
            />
          </Box>

          <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
            {nextGame.locationName}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <CalendarMonth sx={{ fontSize: iconSizes.sm, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {formatGameDateLong(nextGame.date)} às {nextGame.time}
            </Typography>
          </Box>

          {nextGame.locationAddress && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <LocationOn sx={{ fontSize: iconSizes.sm, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {nextGame.locationAddress}
              </Typography>
            </Box>
          )}

          {isConfirmed ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={<CheckCircle />}
                label={t('games.confirmedCheck')}
                color="success"
                size="small"
                sx={{ fontWeight: 600 }}
              />
              <Button
                size="small"
                variant="text"
                onClick={handleCancel}
                disabled={confirmLoading}
                sx={{ fontSize: '0.75rem' }}
              >
                {t('games.changeResponse')}
              </Button>
            </Box>
          ) : isFull ? (
            // #1336: lista de espera funcional (era stub "(em breve)").
            waitlistEntry ? (
              <Box
                sx={{
                  py: 1,
                  px: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  textAlign: 'center',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Typography
                  variant="body2"
                  color="warning.main"
                  fontWeight={600}
                >
                  {t('games.waitlistPosition', { position: waitlistEntry.queuePosition })}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  color="warning"
                  onClick={handleLeaveWaitlist}
                  disabled={waitlistActing}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {waitlistActing ? t('games.leavingWaitlist') : t('games.leaveWaitlist')}
                </Button>
              </Box>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                fullWidth
                onClick={handleJoinWaitlist}
                disabled={waitlistActing}
                startIcon={
                  waitlistActing ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
                sx={{ fontWeight: 700 }}
              >
                {waitlistActing
                  ? t('games.joiningWaitlist')
                  : t('games.gameFullJoinWaitlist')}
              </Button>
            )
          ) : (
            <Button
              variant="contained"
              fullWidth
              onClick={handleConfirm}
              disabled={confirmLoading}
              startIcon={confirmLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ fontWeight: 700 }}
            >
              {confirmLoading ? t('games.confirming') : t('games.confirmPresenceBtn')}
            </Button>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ─── MiniRankingWidget ───────────────────────────────────────────────────────

function MiniRankingWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { groups } = useGroups();
  const gColors = useGamificationColors();

  const primaryGroup = groups?.[0];

  const { data: players = [], isLoading } = useQuery<LeaguePlayer[]>({
    queryKey: ['miniRanking', user?.id, primaryGroup?.id],
    queryFn: async () => {
      if (!primaryGroup?.id) return [];
      const seasonRef = collection(db, 'season_participation');
      // Escopa o mini-ranking ao grupo primário (evita misturar grupos)
      const q = query(
        seasonRef,
        where('group_id', '==', primaryGroup.id),
        orderBy('points', 'desc'),
        limit(3),
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];

      const userIds = snapshot.docs.map((d) => {
        const raw = d.data();
        return raw.user_id || (snakeToCamel(raw) as Record<string, unknown>).userId || d.id;
      }) as string[];

      const uniqueIds = [...new Set(userIds)];

      const usersMap = new Map<string, { name: string; photoUrl: string | null; favoriteTeam?: string }>();
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueIds.length; i += 10) {
        chunks.push(uniqueIds.slice(i, i + 10));
      }
      const settled = await Promise.allSettled(
        chunks.map((chunk) =>
          getDocs(query(collection(db, 'users'), where('__name__', 'in', chunk)))
        ),
      );
      for (const result of settled) {
        if (result.status === 'rejected') continue;
        for (const docSnap of result.value.docs) {
          const d = docSnap.data();
          usersMap.set(docSnap.id, {
            name: (d.name as string) || 'Jogador',
            photoUrl: (d.photo_url as string) || (d.photoUrl as string) || null,
            favoriteTeam: (d.favorite_team as string) || (d.favoriteTeam as string) || undefined,
          });
        }
      }

      return snapshot.docs.map((docSnapshot) => {
        const raw = docSnapshot.data();
        const data = snakeToCamel(raw) as Record<string, unknown>;
        const uid = (data.userId || raw.user_id || docSnapshot.id) as string;
        const userData = usersMap.get(uid) || { name: 'Jogador', photoUrl: null, favoriteTeam: undefined };
        return {
          id: docSnapshot.id,
          userId: uid,
          userName: userData.name,
          userPhoto: userData.photoUrl || undefined,
          favoriteTeam: userData.favoriteTeam,
          level: (data.level as number) || 1,
          points: (data.points as number) || 0,
          gamesPlayed: (data.gamesPlayed as number) || 0,
          wins: (data.wins as number) || 0,
          goals: (data.goals as number) || 0,
          assists: (data.assists as number) || 0,
          mvpCount: (data.mvpCount as number) || 0,
          division: (data.division as LeaguePlayer['division']) || 'BRONZE',
          isCurrentUser: uid === user?.id,
        };
      });
    },
    enabled: !!user?.id && !!primaryGroup?.id,
    staleTime: 3 * 60 * 1000,
  });

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  if (!primaryGroup) {
    return (
      <Card sx={{ mb: pageSpacing.sectionSpacing }}>
        <CardContent sx={{ py: 2.5 }}>
          <Box sx={{ textAlign: 'center' }}>
            <EmojiEvents sx={{ fontSize: iconSizes.xxl, color: 'text.disabled', mb: 1 }} />
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              {t('groups.noRankingMembers')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {t('ranking.joinGroupToCompete', 'Entre em um grupo para competir no ranking')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/?tab=2')}
              >
                {t('common.viewGroups')}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<SportsSoccer />}
                onClick={() => navigate('/?tab=1')}
              >
                {t('nav.games')}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: pageSpacing.sectionSpacing }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EmojiEvents sx={{ fontSize: iconSizes.md, color: gColors.gold }} />
              {t('ranking.title')}
            </Typography>
            <Link
              component="button"
              type="button"
              variant="caption"
              color="primary"
              fontWeight={600}
              onClick={() => navigate('/?tab=3')}
            >
              {t('ranking.viewFull')}
            </Link>
          </Box>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <Skeleton variant="circular" width={30} height={30} />
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width={40} sx={{ ml: 'auto' }} />
              </Box>
            ))
          ) : players.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 1.5 }}>
              <SportsSoccer sx={{ fontSize: iconSizes.xl, color: 'text.disabled', mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {t('ranking.noPlayersYet')}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, mb: 1 }}>
                {t('ranking.participateToAppear', 'Participe de jogos para aparecer no ranking')}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SportsSoccer />}
                onClick={() => navigate('/?tab=1')}
              >
                {t('games.viewGames', 'Ver jogos')}
              </Button>
            </Box>
          ) : (
            <List disablePadding dense>
              {players.map((player, index) => (
                <ListItem key={player.id} disablePadding sx={{ py: 0 }}>
                  <ListItemButton
                    onClick={() => setSelectedPlayerId(player.userId)}
                    sx={{ borderRadius: 2, py: 1, px: 1 }}
                  >
                    <ListItemAvatar sx={{ minWidth: 34 }}>
                      <Box sx={{ position: 'relative' }}>
                        <Avatar
                          src={player.userPhoto}
                          alt={player.userName}
                          sx={{ width: 30, height: 30, fontSize: '0.8rem' }}
                        >
                          {player.userName?.charAt(0)?.toUpperCase() || '?'}
                        </Avatar>
                        {index === 0 && (
                          <EmojiEvents
                            sx={{
                              fontSize: iconSizes.xs,
                              color: gColors.gold,
                              position: 'absolute',
                              top: -6,
                              right: -6,
                            }}
                          />
                        )}
                      </Box>
                    </ListItemAvatar>
                    <ListItemText
                      primary={player.userName}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                      <Typography variant="body2" fontWeight={700} color="primary">
                        {player.points}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('ranking.pts')}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      {selectedPlayerId && (
        <PlayerCard userId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
      )}
    </>
  );
}

// ─── HomeTab ─────────────────────────────────────────────────────────────────

export function HomeTab() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.home'));
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  // Ref para t() — usado dentro do listener (useEffect dep [user?.id]) sem
  // re-subscrever ao trocar idioma
  const tRef = useRef(t);
  tRef.current = t;

  const [isPlayerCardOpen, setIsPlayerCardOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => { await queryClient.invalidateQueries(); }, [queryClient]);

  // ─── Checklist de Primeiros Passos (Fase 1) ──────────────────────────────────
  const {
    state: onboardingState,
    loading: onboardingLoading,
    onChecklistDismissed,
  } = useOnboarding();
  const { groups } = useGroups();

  // Deriva passos de dados de domínio existentes — não são checkboxes manuais
  const checklistSteps: ChecklistStep[] = useMemo(() => [
    {
      id: 'complete_profile',
      label: t('onboarding.checklistCompleteProfile'),
      subtitle: t('onboarding.checklistCompleteProfileDesc'),
      actionLabel: t('onboarding.checklistGoToProfile'),
      navigateTo: '/profile',
      completed: !!(user?.nickname || user?.photoUrl),
    },
    {
      id: 'join_or_create_group',
      label: t('onboarding.checklistJoinGroup'),
      subtitle: t('onboarding.checklistJoinGroupDesc'),
      actionLabel: t('common.viewGroups'),
      navigateTo: '/?tab=2',
      completed: (groups?.length ?? 0) > 0,
    },
    {
      id: 'confirm_presence',
      label: t('onboarding.checklistConfirmPresence'),
      subtitle: t('onboarding.checklistConfirmPresenceDesc'),
      actionLabel: t('common.viewGames'),
      navigateTo: '/?tab=1',
      completed: (user?.totalGames ?? 0) > 0
    },
    {
      id: 'play_first_game',
      label: t('onboarding.checklistPlayFirstGame'),
      subtitle: t('onboarding.checklistPlayFirstGameDesc'),
      actionLabel: t('common.viewGames'),
      navigateTo: '/?tab=1',
      completed: (user?.totalGames ?? 0) > 0
    },
  ], [user, groups, t]);

  const checklistVisible =
    !onboardingLoading &&
    !onboardingState.checklistDismissed &&
    onboardingState.checklistCompletedAt === null &&
    checklistSteps.some(s => !s.completed);

  const currentXp = user?.experiencePoints || 0;
  const currentLevel = getLevelForXp(currentXp);
  const levelEntry = getLevelEntry(currentLevel);
  const progress = getXpProgress(currentXp);
  const xpRemaining = getXpRemaining(currentXp);
  const levelColor = currentLevel >= 19 ? gColors.gold
    : currentLevel >= 16 ? theme.palette.error.main
    : currentLevel >= 13 ? gColors.mvp
    : currentLevel >= 11 ? theme.palette.info.main
    : currentLevel >= 9 ? gColors.level
    : currentLevel >= 6 ? theme.palette.success.main
    : currentLevel >= 3 ? gColors.silver
    : gColors.bronze;

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setActivitiesLoading(false);
      return;
    }

    let cancelled = false;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('user_id', '==', uid),
      orderBy('created_at', 'desc'),
      limit(5),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (cancelled) return;
        const data = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          const d = snakeToCamel<RawActivityDoc>(raw);
          const createdAt = (raw.created_at || raw.createdAt)?.toDate?.();
          return {
            id: docSnap.id,
            type: d.type || 'notification',
            title: d.title || '',
            message: d.message || d.body || '',
            time: createdAt ? formatTimeAgoUtil(createdAt) : '',
            createdAt,
            actorName: d.senderName || '',
            actorPhoto: d.senderPhoto || '',
            referenceType: d.referenceType || '',
            referenceId: d.referenceId || '',
            groupId: d.groupId || '',
            senderId: d.senderId || '',
          } as Activity;
        });
        if (!cancelled) {
          setActivities(data);
          setActivitiesLoading(false);
        }
      },
      (err) => {
        if (cancelled) return;
        logger.error('Error in recent activities listener:', err);
        showErrorRef.current(tRef.current('ranking.loadActivitiesError'));
        setActivitiesLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id]);

  // ====== Main Render ======

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <Container sx={{ maxWidth: { lg: 1200, xl: 1536 }, py: 2 }}>
      {/* Hub Header — informações do jogador sempre primeiro */}
      <Card
        sx={{
          mb: pageSpacing.sectionSpacing,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={user?.photoUrl}
                alt={user?.name || t('profile.defaultUserName')}
                onClick={() => setIsPlayerCardOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setIsPlayerCardOpen(true);
                  }
                }}
                aria-label={t('profile.openPlayerCardAria')}
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: alpha(theme.palette.common.white, 0.2),
                  color: 'primary.contrastText',
                  fontWeight: 'bold',
                  fontSize: '1.5rem',
                  border: '3px solid',
                  borderColor: 'primary.contrastText',
                  cursor: 'pointer',
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </Avatar>
              <Box
                component="button"
                onClick={() => navigate('/level-journey')}
                aria-label={t('profile.viewLevelJourneyAria', { level: currentLevel })}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: levelColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid',
                  borderColor: 'background.paper',
                  boxShadow: `0 0 8px ${levelColor}80`,
                  cursor: 'pointer',
                  p: 0,
                }}
              >
                <Typography variant="caption" fontWeight="bold" sx={{ color: 'primary.contrastText' }}>
                  {currentLevel}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{ ml: 2, flex: 1, maxWidth: '100%', minWidth: 0, cursor: 'pointer' }}
              onClick={() => setIsPlayerCardOpen(true)}
              role="button"
              tabIndex={0}
              aria-label={t('profile.openPlayerCardAria')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsPlayerCardOpen(true);
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight="bold" noWrap sx={{ lineHeight: 1.2, textOverflow: 'ellipsis' }}>
                  {t('profile.greeting', { name: user?.name?.split(' ')[0] || t('profile.defaultPlayerName') })}
                </Typography>
                <TeamBadge teamId={user?.favoriteTeam} size={28} />
              </Box>
              <Typography variant="body2" noWrap sx={{ opacity: 0.85, mt: 0.25, textOverflow: 'ellipsis' }}>
                 {levelEntry.name} • {currentXp.toLocaleString(navigator.language || 'pt-BR')} XP
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{ mb: 2, cursor: 'pointer' }}
            onClick={() => navigate('/level-journey')}
            role="button"
            tabIndex={0}
            aria-label={t('profile.viewLevelJourneyAria', { level: currentLevel })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/level-journey');
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {t('profile.levelLabel', { level: currentLevel })}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {currentLevel < 20 ? t('profile.levelLabel', { level: currentLevel + 1 }) : t('profile.levelMax')}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress * 100}
              aria-label={t('profile.levelProgressAria')}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: alpha(theme.palette.common.white, 0.15),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  bgcolor: alpha(theme.palette.common.white, 0.9),
                },
              }}
            />
            {currentLevel < 20 && (
              <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
                 {t('profile.xpToNextLevel', { xp: xpRemaining.toLocaleString(navigator.language || 'pt-BR'), levelName: getLevelEntry(currentLevel + 1).name })}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {[
              { value: user?.totalGames || 0, label: t('profile.games'), icon: <SportsSoccer aria-hidden="true" sx={{ fontSize: iconSizes.sm, opacity: 0.9 }} />, color: alpha(theme.palette.common.white, 0.15), navigateTo: '/?tab=1' },
              { value: user?.totalGoals || 0, label: t('profile.goals'), icon: <SportsScore aria-hidden="true" sx={{ fontSize: iconSizes.sm, opacity: 0.9 }} />, color: alpha(theme.palette.success.light, 0.25), navigateTo: '/statistics' },
              { value: user?.mvpCount || 0, label: t('profile.mvp'), icon: <EmojiEvents aria-hidden="true" sx={{ fontSize: iconSizes.sm, opacity: 0.9 }} />, color: alpha(gColors.gold, 0.25), navigateTo: '/statistics' },
            ].map((stat) => (
              <ButtonBase
                key={stat.label}
                aria-label={t('home.viewStat', { stat: stat.label })}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(stat.navigateTo);
                }}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  bgcolor: stat.color,
                  borderRadius: 2,
                  py: 1,
                  px: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {stat.icon}
                  {stat.value}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {stat.label}
                </Typography>
              </ButtonBase>
            ))}
          </Box>

          <Button
            variant="text"
            fullWidth
            onClick={() => navigate('/level-journey')}
            sx={{
              mt: 2,
              color: 'primary.contrastText',
              borderColor: alpha(theme.palette.common.white, 0.3),
              border: '1px solid',
              '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) },
            }}
          >
            {t('profile.viewLevelJourney') || 'Ver jornada'}
          </Button>
        </CardContent>
      </Card>

      {isMd ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <FirstStepsChecklist
              steps={checklistSteps}
              visible={checklistVisible}
              onDismiss={() => {
                const stepsDone = checklistSteps.filter(s => s.completed).length;
                onChecklistDismissed(stepsDone, checklistSteps.length);
              }}
              maxIncomplete={2}
            />

            <NextGameWidget />

            <MiniRankingWidget />
          </Grid>

          <Grid item xs={12} md={5}>
            <StreakWidget streak={user?.currentStreak || 0} bestStreak={user?.bestStreak} mb={2} />

            <RecentActivityFeed activities={activities} loading={activitiesLoading} />
          </Grid>
        </Grid>
      ) : (
        <>
          <FirstStepsChecklist
            steps={checklistSteps}
            visible={checklistVisible}
            onDismiss={() => {
              const stepsDone = checklistSteps.filter(s => s.completed).length;
              onChecklistDismissed(stepsDone, checklistSteps.length);
            }}
            maxIncomplete={2}
          />

          <NextGameWidget />

          <StreakWidget streak={user?.currentStreak || 0} bestStreak={user?.bestStreak} mb={3} />

          <MiniRankingWidget />

          <Divider sx={{ mx: -2, my: 2.5, borderColor: 'divider' }} />

          <RecentActivityFeed activities={activities} loading={activitiesLoading} />
        </>
      )}
      {isPlayerCardOpen && (
        <PlayerCard userId={user?.id || null} onClose={() => setIsPlayerCardOpen(false)} />
      )}
    </Container>
    </PullToRefresh>
  );
}
