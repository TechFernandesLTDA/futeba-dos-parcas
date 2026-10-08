import Grid from '@mui/material/Unstable_Grid2';
import { PageContainer } from '../../components/common/PageContainer';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  CircularProgress,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  AvatarGroup,
  Stack,
  Tab,
  Tabs,
  LinearProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  SportsSoccer as SoccerIcon,
  AttachMoney as MoneyIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  EmojiEvents as TrophyIcon,
  Poll as PollIcon,
  People as PeopleIcon,
  EventRepeat as SchedulesIcon,
  MilitaryTech as ChallengesIcon,
  PhotoLibrary as PhotoLibraryIcon,
  ChatBubbleOutline as WallIcon,
  CalendarMonth as CalendarIcon,
  ChevronRight as ChevronRightIcon,
  History as HistoryIcon,
  Insights as StatsIcon,
  Lock as LockIcon,
  PersonAddAlt as InviteIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { AppBreadcrumbs, FixedBottomBar } from '../../components/layout';
import { useBreadcrumbEntityLabel } from '../../contexts/BreadcrumbEntityContext';
import { useAppBreadcrumbOverride } from '../../hooks/useAutoBreadcrumbs';
import { useQueryClient } from '@tanstack/react-query';
import { useGroupDetail, useInvitePlayers } from '../../hooks/useGroups';
import { useCashboxSummary } from '../../hooks/useCashboxSummary';
import { GroupPoll, useCreateGroupPoll, useGroupPolls, useVoteGroupPoll } from '../../hooks/useGroupPolls';
import { useMyJoinRequest } from '../../hooks/useJoinRequests';
import { useGames } from '../../hooks/useGames';
import { softDeleteGroup } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { GroupRole } from '../../types/group';
import { Game } from '../../types/game';
import { PlayerAvatar, ShimmerLoading } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorScreen } from '../../components/common/ErrorScreen';
import { TeamBadge } from '../../components/team/TeamBadge';
import { GameCard } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { FirstStepsChecklist } from '../../components/onboarding/FirstStepsChecklist';
import type { ChecklistStep } from '../../components/onboarding/FirstStepsChecklist';
import { iconSizes } from '../../theme/iconSizes';
import { formatDateShort } from '../../utils/dateFormatters';
import { db } from '../../services/firebase';
import { GroupWallTab } from './GroupWallTab';
import { canInviteGroupMembers } from './groupInvitePermissions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    id={`group-tabpanel-${index}`}
    aria-labelledby={`group-tab-${index}`}
    hidden={value !== index}
    tabIndex={value === index ? 0 : -1}
    sx={{ py: 2 }}
  >
    {value === index && children}
  </Box>
);

const PollsPanel: React.FC<{ groupId: string; canCreate: boolean }> = ({ groupId, canCreate }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { polls, loading, error, refetch } = useGroupPolls(groupId);
  const createPoll = useCreateGroupPoll(groupId);
  const votePoll = useVoteGroupPoll(groupId);
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('Domingo de manhã\nQuarta à noite');

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {canCreate && (
          <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{t('groupPolls.createTitle')}</Typography>
              <TextField label={t('groupPolls.question')} value={question} onChange={(event) => setQuestion(event.target.value)} fullWidth size="small" inputProps={{ maxLength: 120 }} sx={{ mb: 1.5 }} />
              <TextField label={t('groupPolls.options')} value={optionsText} onChange={(event) => setOptionsText(event.target.value)} fullWidth multiline minRows={3} helperText={t('groupPolls.optionsHelp')} />
              <Button
                variant="contained"
                startIcon={createPoll.isPending ? <CircularProgress size={16} color="inherit" /> : <PollIcon />}
                onClick={() => createPoll.mutate({ question, options: optionsText.split('\n') }, {
                  onSuccess: () => {
                    setQuestion('');
                    setOptionsText('Domingo de manhã\nQuarta à noite');
                  },
                })}
                disabled={createPoll.isPending}
                sx={{ mt: 2 }}
              >
                {createPoll.isPending ? t('common.saving') : t('groupPolls.create')}
              </Button>
            </CardContent>
          </Card>
        )}
        {loading && <ShimmerLoading count={2} type="card" />}
        {error && <Alert severity="error" action={<Button onClick={() => refetch()}>{t('common.retry')}</Button>}>{error}</Alert>}
        {!loading && !error && polls.length === 0 && (
          <EmptyState icon={<PollIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />} title={t('groupPolls.emptyTitle')} description={t('groupPolls.emptyDesc')} />
        )}
        {!loading && !error && polls.map((poll) => (
          <PollCard key={poll.id} poll={poll} voting={votePoll.isPending} onVote={(optionId) => votePoll.mutate({ pollId: poll.id, optionId })} />
        ))}
      </Stack>
    </Box>
  );
};

const PollCard: React.FC<{ poll: GroupPoll; voting: boolean; onVote: (optionId: string) => void }> = ({ poll, voting, onVote }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700}>{poll.question}</Typography>
        <Typography variant="caption" color="text.secondary">{t('groupPolls.by', { name: poll.createdByName })}</Typography>
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {poll.options.map((option) => {
            const count = poll.voteCounts[option.id] ?? 0;
            const percent = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
            const selected = poll.myVote === option.id;
            return (
              <Box key={option.id}>
                <Button variant={selected ? 'contained' : 'outlined'} fullWidth onClick={() => onVote(option.id)} disabled={voting || poll.status !== 'ACTIVE'} sx={{ justifyContent: 'space-between', textTransform: 'none' }}>
                  <span>{option.text}</span>
                  <span>{percent}%</span>
                </Button>
                <LinearProgress variant="determinate" value={percent} sx={{ mt: 0.5, height: 6, borderRadius: 99, bgcolor: alpha(theme.palette.primary.main, 0.08) }} />
              </Box>
            );
          })}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>{t('groupPolls.totalVotes', { count: poll.totalVotes })}</Typography>
      </CardContent>
    </Card>
  );
};

interface GroupPhotoPreview {
  id: string;
  gameId: string;
  gameTitle: string;
  url: string;
  uploadedByName: string;
  uploadedByPhoto?: string;
  caption?: string;
  createdAt?: Date;
}

export const GroupPhotosPanel: React.FC<{
  games: Array<{ id: string; title?: string; dateTime?: Date }>;
  loadingGames: boolean;
}> = ({ games, loadingGames }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [photos, setPhotos] = useState<GroupPhotoPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<GroupPhotoPreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPhotos = async () => {
      if (loadingGames) {
        setLoading(true);
        return;
      }

      if (games.length === 0) {
        setPhotos([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const gameLookup = new Map(games.map((game) => [game.id, game]));
        const chunks: string[][] = [];
        for (let i = 0; i < games.length; i += 10) {
          chunks.push(games.slice(i, i + 10).map((game) => game.id));
        }

        const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(
          collection(db, 'game_photos'),
          where('game_id', 'in', chunk),
          limit(60),
        ))));

        if (cancelled) return;

        const nextPhotos = snapshots.flatMap((snapshot) => snapshot.docs.map((photoDoc) => {
          const raw = photoDoc.data();
          const game = gameLookup.get(String(raw.game_id));
          return {
            id: photoDoc.id,
            gameId: String(raw.game_id),
            gameTitle: game?.title || (game?.dateTime ? game.dateTime.toLocaleDateString(navigator.language || 'pt-BR') : t('games.game')),
            url: String(raw.url || ''),
            uploadedByName: String(raw.uploaded_by_name || t('common.player')),
            uploadedByPhoto: raw.uploaded_by_photo ? String(raw.uploaded_by_photo) : undefined,
            caption: raw.caption ? String(raw.caption) : undefined,
            createdAt: raw.created_at?.toDate?.(),
          };
        }))
          .filter((photo) => photo.url)
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
          .slice(0, 60);

        setPhotos(nextPhotos);
      } catch {
        if (!cancelled) setError(t('groupPhotos.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [games, loadingGames, t]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={<PhotoLibraryIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
        title={t('groupPhotos.emptyTitle')}
        description={t('groupPhotos.emptyDesc')}
      />
    );
  }

  return (
    <>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <PhotoLibraryIcon color="primary" />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('groupPhotos.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('groupPhotos.description', { count: photos.length })}</Typography>
          </Box>
          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
            {photos.slice(0, 8).map((photo) => (
              <Avatar key={photo.id} src={photo.uploadedByPhoto} alt={photo.uploadedByName}>{photo.uploadedByName.charAt(0).toUpperCase()}</Avatar>
            ))}
          </AvatarGroup>
        </Stack>
        <Grid container spacing={1.5}>
          {photos.map((photo) => (
            <Grid xs={6} sm={4} md={3} key={photo.id}>
              <ButtonBase
                onClick={() => setSelectedPhoto(photo)}
                aria-label={t('groupPhotos.photoAlt', { name: photo.uploadedByName })}
                sx={{
                  display: 'block',
                  width: '100%',
                  position: 'relative',
                  pt: '100%',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'action.hover',
                  boxShadow: `0 0 0 1px ${alpha(theme.palette.common.white, 0.08)} inset`,
                  '&.Mui-focusVisible': {
                    boxShadow: `0 0 0 3px ${theme.palette.primary.main} inset`,
                  },
                }}
              >
                <Box component="img" src={photo.url} alt={t('groupPhotos.photoAlt', { name: photo.uploadedByName })} loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <Box sx={{ position: 'absolute', insetInline: 0, bottom: 0, p: 1, background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.common.black, 0.74)})`, color: theme.palette.common.white }}>
                  <Typography variant="caption" fontWeight={700} noWrap>{photo.gameTitle}</Typography>
                </Box>
              </ButtonBase>
            </Grid>
          ))}
        </Grid>
      </CardContent>

      <Dialog
        open={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          'aria-label': selectedPhoto
            ? t('groupPhotos.photoAlt', { name: selectedPhoto.uploadedByName })
            : undefined,
        }}
      >
        {selectedPhoto && (
          <>
            <Box sx={{ bgcolor: theme.palette.common.black, display: 'flex', justifyContent: 'center' }}>
              <Box component="img" src={selectedPhoto.url} alt={t('groupPhotos.photoAlt', { name: selectedPhoto.uploadedByName })} sx={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain' }} />
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2 }}>
              <Avatar src={selectedPhoto.uploadedByPhoto} alt={selectedPhoto.uploadedByName}>{selectedPhoto.uploadedByName.charAt(0).toUpperCase()}</Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>{selectedPhoto.uploadedByName}</Typography>
                <Typography variant="caption" color="text.secondary">{selectedPhoto.gameTitle}</Typography>
                {selectedPhoto.caption && <Typography variant="body2" color="text.secondary">{selectedPhoto.caption}</Typography>}
              </Box>
              <Button onClick={() => setSelectedPhoto(null)}>{t('common.close')}</Button>
            </Stack>
          </>
        )}
      </Dialog>
    </>
  );
};

import { getRoleColor } from '../../constants/group';

interface GroupStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  helper?: string;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'error';
}

const GroupStatCard: React.FC<GroupStatCardProps> = ({ icon, label, value, helper, color = 'primary' }) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 2,
        bgcolor: alpha(theme.palette[color].main, 0.04),
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette[color].main, 0.12),
              color: theme.palette[color].main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {label}
            </Typography>
          </Box>
        </Stack>
        {helper && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {helper}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

interface GroupQuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  emphasized?: boolean;
}

const GroupQuickActions: React.FC<{ actions: GroupQuickAction[] }> = ({ actions }) => {
  const { t } = useTranslation();

  return (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1.25, sm: 1.5 }, '&:last-child': { pb: { xs: 1.25, sm: 1.5 } } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems="stretch"
          aria-label={t('groupDetail.manageHub')}
        >
          {actions.map((action) => (
            <Button
              key={action.label}
              fullWidth
              variant={action.emphasized ? 'contained' : 'outlined'}
              startIcon={action.icon}
              onClick={action.onClick}
              sx={{
                minHeight: 44,
                flex: 1,
                justifyContent: 'center',
                textTransform: 'none',
                fontWeight: 800,
                px: 1.5,
              }}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

const GamesPanel: React.FC<{
  games: Game[];
  loading: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onOpenGame: (gameId: string) => void;
}> = ({ games, loading, canCreate, onCreate, onOpenGame }) => {
  const { t } = useTranslation();
  // Perf: sorts/filters memoizados — o painel re-renderiza a cada mudança de
  // estado do GroupDetailScreen (tabs, dialogs, scroll observer) e antes
  // reordenava a lista de jogos do grupo inteira a cada render.
  const { upcomingGames, visibleHistory } = useMemo(() => {
    const now = new Date();
    const sortedAsc = [...games].sort((a, b) => (a.dateTime?.getTime() || 0) - (b.dateTime?.getTime() || 0));
    const sortedDesc = [...games].sort((a, b) => (b.dateTime?.getTime() || 0) - (a.dateTime?.getTime() || 0));
    const upcoming = sortedAsc.filter((game) => game.status !== 'FINISHED' && game.status !== 'CANCELLED' && (!game.dateTime || game.dateTime >= now));
    const past = sortedDesc.filter((game) => game.status === 'FINISHED' || (game.dateTime && game.dateTime < now));
    return {
      upcomingGames: upcoming,
      visibleHistory: past.length > 0 ? past.slice(0, 8) : sortedDesc.slice(0, 8),
    };
  }, [games]);

  if (loading) {
    return <ShimmerLoading count={3} type="card" />;
  }

  if (games.length === 0) {
    return (
      <EmptyState
        icon={<SoccerIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
        title={t('groupDetail.noGames')}
        description={t('groupDetail.noGamesDesc')}
        actionLabel={canCreate ? t('games.createGame') : undefined}
        onAction={canCreate ? onCreate : undefined}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CalendarIcon color="primary" />
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>
                  {t('groupDetail.groupGames')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('groupDetail.groupGamesDesc', { count: games.length })}
                </Typography>
              </Box>
            </Stack>
            {canCreate && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
                {t('groupDetail.newGame')}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {upcomingGames.length > 0 && (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <SoccerIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={800}>
              {t('groupDetail.nextGames')}
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            {upcomingGames.slice(0, 3).map((game) => (
              <GameCard key={game.id} game={game} onClick={() => onOpenGame(game.id)} />
            ))}
          </Stack>
        </Box>
      )}

      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <HistoryIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={800}>
            {t('groupDetail.gameHistory')}
          </Typography>
        </Stack>
        <Stack spacing={1.5}>
          {visibleHistory.map((game) => (
            <GameCard key={game.id} game={game} onClick={() => onOpenGame(game.id)} />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};

export const GroupDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('group.detailTitle'));
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  // Breakpoints para layout responsivo
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));

  // FIX #1411: maxWidth unificado entre loading/erro/conteúdo para evitar CLS
  // (loading antes era sempre 'sm', conteúdo expandia para 'md'/'xl' → salto visual ao terminar carregamento).
  const containerMaxWidth: 'sm' | 'md' | 'xl' = isLg ? 'xl' : isMd ? 'md' : 'sm';

  const { group, groupDeleted, members, loading, error } = useGroupDetail(groupId || null);
  useBreadcrumbEntityLabel('group', groupId, group?.name);
  useAppBreadcrumbOverride(Boolean(group));
  const { games, loading: gamesLoading } = useGames({ groupId: groupId || undefined, limitCount: 50, orderDirection: 'desc' });
  const { generateInviteCode, loading: inviteLoading } = useInvitePlayers();
  const { entryCount, balanceCents } = useCashboxSummary(groupId || undefined);

  const [tabValue, setTabValue] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [ownerChecklistDismissed, setOwnerChecklistDismissed] = useState(false);
  const [isCreateGameTopVisible, setIsCreateGameTopVisible] = useState(true);
  const createGameTopSentinelRef = useRef<HTMLDivElement | null>(null);

  const myMember = members.find((m) => m.userId === currentUser?.uid);
  const isGroupOwner = group?.ownerId === currentUser?.uid;
  const hasActiveMember = myMember?.status === 'ACTIVE';
  const isLegacyOwnerMember = isGroupOwner && myMember?.status === undefined;
  const isOwner = isGroupOwner || (myMember?.role === 'OWNER' && hasActiveMember);
  const isAdmin = isOwner || (myMember?.role === 'ADMIN' && hasActiveMember);
  const canInviteMembers = canInviteGroupMembers({
    isGroupOwner,
    memberRole: myMember?.role,
    memberStatus: myMember?.status,
  });
  const isMember = isGroupOwner || hasActiveMember || isLegacyOwnerMember;
  const canCreateGroupGame = isMember;

  useEffect(() => {
    if (!isMobile || !canCreateGroupGame || loading) {
      setIsCreateGameTopVisible(true);
      return undefined;
    }
    const sentinel = createGameTopSentinelRef.current;
    if (!sentinel) return undefined;

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => setIsCreateGameTopVisible(entry.isIntersecting),
        { threshold: 0.01 },
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }

    const main = document.getElementById('main-content');
    const scrollContainer = main instanceof HTMLElement &&
      ['auto', 'scroll'].includes(window.getComputedStyle(main).overflowY)
      ? main
      : null;
    const update = () => {
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      setIsCreateGameTopVisible(scrollTop <= 8);
    };
    update();
    const target: EventTarget = scrollContainer ?? window;
    target.addEventListener('scroll', update, { passive: true });
    return () => target.removeEventListener('scroll', update);
  }, [canCreateGroupGame, groupId, isMobile, loading]);
  // Habilita listener de join request apenas se nao-membro em grupo publico.
  const shouldTrackJoinRequest = !isMember && group?.isPublic === true;
  const {
    request: joinRequest,
    submitting: joinSubmitting,
    requestJoin,
    cancelRequest,
  } = useMyJoinRequest(shouldTrackJoinRequest ? groupId : undefined);

  const handleGenerateInvite = async () => {
    if (!groupId || !group || !canInviteMembers) return;

    try {
      const code = await generateInviteCode(groupId, group.name);
      setInviteCode(code);
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  const handleCopyInvite = async () => {
    // Guard issue #514: sem codigo o link sai /join/ (sem param)
    if (!inviteCode) {
      showError(t('group.generateInviteFirst'));
      return;
    }
    const link = `${window.location.origin}/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess(t('group.linkCopied'));
    } catch {
      showError(t('group.copyLinkError'));
    }
  };

  const handleShare = async () => {
    if (!inviteCode) {
      showError(t('group.generateInviteFirst'));
      return;
    }
    const link = `${window.location.origin}/join/${inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('groupDetail.shareTitle', { name: group?.name || '' }),
          text: t('groupDetail.shareText', { name: group?.name || '' }),
          url: link,
        });
      } catch (err) {
        // #2281: ignora cancelamento da share sheet; reporta demais erros.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        showError(t('group.shareError', 'Erro ao compartilhar'));
      }
    } else {
      handleCopyInvite();
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    setDeleteLoading(true);
    try {
      await softDeleteGroup({ groupId });
      setDeleteDialogOpen(false);
      showSuccess(t('groupDetail.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['groups', currentUser?.uid || ''] });
      // #1591: navega diretamente após await sem setTimeout frágil
      navigate('/?tab=2');
    } catch (err) {
      showError(getFirestoreErrorMessage(err, t('groupDetail.deleteError')));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Perf: dados derivados memoizados ANTES dos early-returns (regras de hooks).
  // Antes disto rodava 2 sorts + 3 filters + new Date() a cada render —
  // inclusive a cada tick do IntersectionObserver de scroll, que re-renderiza
  // a tela inteira.
  const gamesDerived = useMemo(() => {
    const now = new Date();
    const sortedGamesDesc = [...games].sort((a, b) => (b.dateTime?.getTime() || 0) - (a.dateTime?.getTime() || 0));
    const sortedGamesAsc = [...games].sort((a, b) => (a.dateTime?.getTime() || 0) - (b.dateTime?.getTime() || 0));
    return {
      finishedGames: games.filter((game) => game.status === 'FINISHED').length,
      upcomingGames: sortedGamesAsc.filter((game) => game.status !== 'FINISHED' && game.status !== 'CANCELLED' && (!game.dateTime || game.dateTime >= now)),
      lastGame: sortedGamesDesc.find((game) => game.status === 'FINISHED' || (game.dateTime && game.dateTime < now)) ?? null,
    };
  }, [games]);
  const activeMemberDocCount = useMemo(
    () => members.filter((member) => member.status === undefined || member.status === 'ACTIVE').length,
    [members],
  );

  if (loading) {
    return (
      <PageContainer maxWidth="detail">
        <ShimmerLoading count={3} type="card" />
      </PageContainer>
    );
  }

  if (groupDeleted) {
    return (
      <PageContainer maxWidth="detail">
        <EmptyState
          icon={<GroupIcon sx={{ fontSize: iconSizes.hero }} />}
          title={t('groupDetail.closedTitle')}
          description={t('groupDetail.closedDesc')}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/?tab=2')}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      // #2178: ErrorScreen padronizado
      <ErrorScreen
        message={error}
        onRetry={() => queryClient.invalidateQueries()}
        onBack={() => navigate('/?tab=2')}
        backLabel={t('common.back')}
        maxWidth={containerMaxWidth}
      />
    );
  }

  if (!group) {
    return (
      <PageContainer maxWidth="detail">
        <EmptyState
          icon={<GroupIcon sx={{ fontSize: iconSizes.hero }} />}
          title={t('groupDetail.notFound')}
          description={t('groupDetail.notFoundDesc')}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/?tab=2')}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    );
  }

  const { finishedGames, upcomingGames, lastGame } = gamesDerived;
  const activeMembersCount = activeMemberDocCount || group.memberCount || 0;
  const totalGamesCount = group.totalGamesPlayed || games.length;
  const balanceValue = balanceCents / 100;
  const balanceLabel = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balanceValue);
  const nextGame = upcomingGames[0];
  const ownerChecklistSteps: ChecklistStep[] = [
    {
      id: 'configure_group',
      label: t('onboarding.ownerChecklistConfigureGroup'),
      subtitle: t('onboarding.ownerChecklistConfigureGroupDesc'),
      actionLabel: t('groups.editGroup'),
      navigateTo: `/group/${groupId}/edit`,
      completed: Boolean(group.description || group.photoUrl || group.isPublic),
    },
    {
      id: 'invite_players',
      label: t('onboarding.ownerChecklistInvitePlayers'),
      subtitle: t('onboarding.ownerChecklistInvitePlayersDesc'),
      actionLabel: t('groupDetail.invite'),
      navigateTo: `/group/${groupId}?tab=members`,
      onAction: () => {
        setTabValue(3);
        setInviteDialogOpen(true);
      },
      completed: activeMembersCount > 1,
    },
    {
      id: 'reach_min_members',
      label: t('onboarding.ownerChecklistReachMinMembers'),
      subtitle: t('onboarding.ownerChecklistReachMinMembersDesc'),
      actionLabel: t('groupDetail.invite'),
      navigateTo: `/group/${groupId}?tab=members`,
      onAction: () => {
        setTabValue(3);
        setInviteDialogOpen(true);
      },
      completed: activeMembersCount >= 5,
    },
    {
      id: 'create_first_game',
      label: t('onboarding.ownerChecklistCreateGame'),
      subtitle: t('onboarding.ownerChecklistCreateGameDesc'),
      actionLabel: t('games.createGame'),
      navigateTo: `/game/create?groupId=${groupId}`,
      completed: games.length > 0,
    },
    {
      id: 'open_cashbox',
      label: t('onboarding.ownerChecklistCashbox'),
      subtitle: t('onboarding.ownerChecklistCashboxDesc'),
      actionLabel: t('group.tabCashbox'),
      navigateTo: `/group/${groupId}/cashbox`,
      completed: entryCount > 0,
    },
  ];
  const ownerChecklistVisible = !ownerChecklistDismissed && canInviteMembers && ownerChecklistSteps.some((step) => !step.completed);

  const quickActions: GroupQuickAction[] = [
    ...(!isMobile ? [{
      label: t('games.createGame'),
      icon: <AddIcon />,
      onClick: () => navigate(`/game/create?groupId=${groupId}`),
      emphasized: true,
    }] : []),
    {
      label: t('groupDetail.schedules'),
      icon: <SchedulesIcon />,
      onClick: () => navigate(`/group/${groupId}/schedules`),
    },
    {
      label: t('groupDetail.challenges'),
      icon: <ChallengesIcon />,
      onClick: () => navigate(`/group/${groupId}/challenges`),
    },
  ];

  const tabItems = [
    { label: t('groupWall.tab'), icon: <WallIcon />, value: 0 },
    { label: t('group.tabGames'), icon: <SoccerIcon />, value: 1 },
    { label: t('groupDetail.statsTab'), icon: <StatsIcon />, value: 2 },
    { label: t('group.tabMembers'), icon: <PeopleIcon />, value: 3 },
    { label: t('nav.league'), icon: <TrophyIcon />, value: 4 },
    { label: t('groupPolls.tab'), icon: <PollIcon />, value: 5 },
    { label: t('groupPhotos.tab'), icon: <PhotoLibraryIcon />, value: 6 },
    { label: t('group.tabCashbox'), icon: <MoneyIcon />, value: 7 },
  ];

  return (
    <Box sx={{ pb: 10 }}>
      <ScreenHeader
        title={group.name}
        onBack={() => navigate('/?tab=2')}
        actions={
          <>
            {isAdmin && (
              <Tooltip title={t('groups.editGroup')}>
                <IconButton onClick={() => navigate(`/group/${groupId}/edit`)} aria-label={t('groups.editGroup')}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
            {isMember && (
              <Tooltip title={t('groupDetail.groupSettings')}>
                <IconButton onClick={() => navigate(`/group/${groupId}/settings`)} aria-label={t('groupDetail.groupSettings')}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            )}
            {isOwner && (
              <Tooltip title={t('groups.deleteGroup')}>
                <IconButton onClick={() => setDeleteDialogOpen(true)} color="error" aria-label={t('groups.deleteGroup')}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </>
        }
      />

      <Box
        ref={createGameTopSentinelRef}
        data-testid="create-game-top-sentinel"
        aria-hidden
        sx={{ width: '1px', height: '1px', pointerEvents: 'none' }}
      />

      <AppBreadcrumbs
        items={[
          { label: t('nav.groups'), to: '/?tab=2' },
          { label: group.name },
        ]}
      />

      <PageContainer maxWidth="detail">
        <Card sx={{ mb: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              p: { xs: 2, sm: 3 },
              color: theme.palette.common.white,
              background: `
                linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.96)}, ${alpha(theme.palette.success.dark, 0.88)}),
                repeating-linear-gradient(90deg, ${alpha(theme.palette.common.white, 0.12)} 0 1px, transparent 1px 42px)
              `,
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Avatar
                src={group.photoUrl}
                alt={group.name}
                sx={{
                  width: { xs: 72, sm: 88 },
                  height: { xs: 72, sm: 88 },
                  bgcolor: alpha(theme.palette.common.white, 0.18),
                  border: `3px solid ${alpha(theme.palette.common.white, 0.8)}`,
                  fontSize: { xs: '2rem', sm: '2.4rem' },
                }}
              >
                {group.name.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant={isMobile ? 'h5' : 'h4'} component="p" fontWeight={900} sx={{ color: 'inherit' }}>
                    {group.name}
                  </Typography>
                  <Chip
                    icon={group.isPublic ? <PublicIcon /> : <LockIcon />}
                    label={group.isPublic ? t('group.public') : t('groups.privateGroupLabel')}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.common.black, 0.24),
                      color: 'inherit',
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                </Stack>
                {group.description && (
                  <Typography variant="body2" sx={{ mt: 1, maxWidth: 780, color: theme.palette.common.white }}>
                    {group.description}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  <Chip icon={<PeopleIcon />} label={t('groups.membersCount', { count: activeMembersCount })} size="small" sx={{ bgcolor: alpha(theme.palette.common.black, 0.24), color: 'inherit', '& .MuiChip-icon': { color: 'inherit' } }} />
                  <Chip icon={<SoccerIcon />} label={t('groups.gamesCount', { count: totalGamesCount })} size="small" sx={{ bgcolor: alpha(theme.palette.common.black, 0.24), color: 'inherit', '& .MuiChip-icon': { color: 'inherit' } }} />
                  {nextGame && (
                    <Chip icon={<CalendarIcon />} label={`${t('groups.nextGame')}: ${formatDateShort(nextGame.dateTime)}`} size="small" sx={{ bgcolor: alpha(theme.palette.common.black, 0.24), color: 'inherit', '& .MuiChip-icon': { color: 'inherit' } }} />
                  )}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Card>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid xs={6} md={3}>
            <GroupStatCard icon={<PeopleIcon />} label={t('groupDetail.activeMembers')} value={activeMembersCount} helper={t('groupDetail.activeMembersHint')} />
          </Grid>
          <Grid xs={6} md={3}>
            <GroupStatCard icon={<SoccerIcon />} label={t('groupDetail.playedGames')} value={totalGamesCount} helper={t('groupDetail.playedGamesHint', { count: finishedGames })} color="success" />
          </Grid>
          <Grid xs={6} md={3}>
            <GroupStatCard icon={<CalendarIcon />} label={t('groupDetail.nextGames')} value={upcomingGames.length} helper={nextGame ? formatDateShort(nextGame.dateTime) : t('groupDetail.noNextGame')} color="info" />
          </Grid>
          <Grid xs={6} md={3}>
            <GroupStatCard icon={<MoneyIcon />} label={t('groupDetail.currentBalance')} value={balanceLabel} helper={t('groupDetail.cashboxHint')} color={balanceValue >= 0 ? 'warning' : 'error'} />
          </Grid>
        </Grid>

        <FirstStepsChecklist
          steps={ownerChecklistSteps}
          visible={ownerChecklistVisible}
          title={t('onboarding.ownerFirstStepsTitle')}
          onDismiss={() => setOwnerChecklistDismissed(true)}
          maxIncomplete={3}
        />

        {isMember && <GroupQuickActions actions={quickActions} />}

        {shouldTrackJoinRequest && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              {!joinRequest && (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={requestJoin}
                  disabled={joinSubmitting}
                  startIcon={joinSubmitting ? <CircularProgress size={16} color="inherit" /> : <InviteIcon />}
                >
                  {joinSubmitting ? t('group.sending') : t('group.requestJoin')}
                </Button>
              )}
              {joinRequest?.status === 'PENDING' && (
                <Stack spacing={1}>
                  <Alert severity="info" icon={false}>
                    {t('group.awaitingApproval')}
                  </Alert>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={cancelRequest}
                    disabled={joinSubmitting}
                  >
                    {joinSubmitting ? t('group.cancelling') : t('group.cancelRequest')}
                  </Button>
                </Stack>
              )}
              {joinRequest?.status === 'REJECTED' && (
                <Alert severity="warning" icon={false}>
                  {t('group.requestRejected')}
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <Box
          sx={{
            position: { xs: 'sticky', md: 'static' },
            top: { xs: 0, md: 'auto' },
            zIndex: (theme) => theme.zIndex.appBar - 1,
            bgcolor: 'background.default',
            py: 1,
            mb: 1,
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant={isMobile ? 'scrollable' : 'fullWidth'}
            scrollButtons={isMobile ? 'auto' : false}
            allowScrollButtonsMobile
            aria-label={t('groupDetail.sectionsAria')}
            sx={{
              minHeight: 48,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              '& .MuiTab-root': {
                minHeight: 48,
                minWidth: isMobile ? 112 : undefined,
                px: isMobile ? 1.5 : undefined,
                textTransform: 'none',
                fontWeight: 800,
              },
            }}
          >
            {tabItems.map((item) => (
              <Tab
                key={item.value}
                id={`group-tab-${item.value}`}
                aria-controls={`group-tabpanel-${item.value}`}
                label={item.label}
                icon={item.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <GroupWallTab groupId={groupId!} isMember={isMember} isAdmin={isAdmin} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <GamesPanel
            games={games}
            loading={gamesLoading}
            canCreate={canCreateGroupGame}
            onCreate={() => navigate(`/game/create?groupId=${groupId}`)}
            onOpenGame={(gameId) => navigate(`/game/${gameId}`)}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            <Grid xs={12} md={7}>
              <Box sx={{ height: '100%' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <StatsIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={800}>
                    {t('groupDetail.groupStats')}
                  </Typography>
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid xs={6}>
                    <GroupStatCard icon={<PeopleIcon />} label={t('groupDetail.activeMembers')} value={activeMembersCount} />
                  </Grid>
                  <Grid xs={6}>
                    <GroupStatCard icon={<SoccerIcon />} label={t('groupDetail.playedGames')} value={totalGamesCount} color="success" />
                  </Grid>
                  <Grid xs={6}>
                    <GroupStatCard icon={<HistoryIcon />} label={t('groupDetail.finishedGames')} value={finishedGames} color="info" />
                  </Grid>
                  <Grid xs={6}>
                    <GroupStatCard icon={<MoneyIcon />} label={t('groupDetail.currentBalance')} value={balanceLabel} color={balanceValue >= 0 ? 'warning' : 'error'} />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
            <Grid xs={12} md={5}>
              <Stack spacing={2}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <HistoryIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={800}>
                        {t('groupDetail.latestResult')}
                      </Typography>
                    </Stack>
                    {lastGame ? (
                      <Button fullWidth variant="outlined" endIcon={<ChevronRightIcon />} onClick={() => navigate(`/game/${lastGame.id}`)} sx={{ justifyContent: 'space-between', textTransform: 'none' }}>
                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                          <Typography variant="body2" fontWeight={800} noWrap>
                            {lastGame.locationName || t('games.game')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateShort(lastGame.dateTime)}
                          </Typography>
                        </Box>
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('groupDetail.noLatestResult')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                      {t('groupDetail.groupLeague')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {t('groupDetail.groupLeagueDesc')}
                    </Typography>
                    <Button fullWidth variant="contained" startIcon={<TrophyIcon />} onClick={() => navigate(`/group/${groupId}/league`)}>
                      {t('groupDetail.viewStandings')}
                    </Button>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {t('group.tabMembers')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('groups.membersCount', { count: activeMembersCount })}
                  </Typography>
                </Box>
                {canInviteMembers && (
                  <Button
                    variant="contained"
                    startIcon={<InviteIcon />}
                    onClick={() => setInviteDialogOpen(true)}
                    sx={{ minHeight: 44 }}
                  >
                    {t('groupDetail.invite')}
                  </Button>
                )}
              </Stack>
            </CardContent>
            {members.length === 0 ? (
              <EmptyState
                icon={<PersonIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
                title={t('groupDetail.noMembers')}
                description={t('groupDetail.noMembersDesc')}
                actionLabel={canInviteMembers ? t('groupDetail.invite') : undefined}
                onAction={canInviteMembers ? () => setInviteDialogOpen(true) : undefined}
              />
            ) : (
              <List disablePadding aria-label={t('group.membersAria')}>
                {members.map((member, index) => (
                  <GroupMemberItem
                    key={member.userId}
                    member={member}
                    showDivider={index < members.length - 1}
                  />
                ))}
              </List>
            )}
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <TrophyIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled', mb: 2 }} />
              <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                {t('groupDetail.groupLeague')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('groupDetail.groupLeagueDesc')}
              </Typography>
              <Button variant="contained" startIcon={<TrophyIcon />} onClick={() => navigate(`/group/${groupId}/league`)}>
                {t('groupDetail.viewStandings')}
              </Button>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <PollsPanel groupId={groupId!} canCreate={isAdmin} />
        </TabPanel>

        <TabPanel value={tabValue} index={6}>
          <Card variant="outlined">
            <GroupPhotosPanel games={games} loadingGames={gamesLoading} />
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={7}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {t('groupDetail.currentBalance')}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    color={balanceValue >= 0 ? 'success.main' : 'error.main'}
                  >
                    {balanceLabel}
                  </Typography>
                </Box>
                <Button variant="outlined" startIcon={<MoneyIcon />} onClick={() => navigate(`/group/${groupId}/cashbox`)}>
                  {t('groupDetail.viewDetails')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </TabPanel>
      </PageContainer>

      {/* #1328: spacer p/ a barra fixa "Criar Jogo" nunca sobrepor o último
          conteúdo (mobile bottom-bar e barra flutuante desktop). */}
      {canCreateGroupGame && isMobile && <Box aria-hidden sx={{ height: 80 }} />}

      {/* #2164/#2270: barra fixa via FixedBottomBar (centralizada no conteúdo
          + safe-area), substituindo a versão hand-rolled centrada no viewport. */}
      {canCreateGroupGame && isMobile && isCreateGameTopVisible && (
        <FixedBottomBar>
          <PageContainer maxWidth="detail" disablePadding>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => navigate(`/game/create?groupId=${groupId}`)}
            >
              {t('games.createGame')}
            </Button>
          </PageContainer>
        </FixedBottomBar>
      )}

      <Dialog open={canInviteMembers && inviteDialogOpen} onClose={() => { setInviteDialogOpen(false); setInviteCode(''); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="invite-dialog-title">
        <DialogTitle id="invite-dialog-title">{t('groups.invitePlayers')}</DialogTitle>
        <DialogContent>
          {inviteLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : inviteCode ? (
            <Box sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('groupDetail.shareInviteLink')}
              </Alert>

              <TextField
                label={t('groupDetail.inviteCode')}
                value={inviteCode}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton onClick={handleCopyInvite} edge="end" aria-label={t('groupDetail.copyInviteCode')}>
                      <CopyIcon />
                    </IconButton>
                  ),
                }}
              />

              <TextField
                label={t('groupDetail.inviteLink')}
                value={`${window.location.origin}/join/${inviteCode}`}
                fullWidth
                sx={{ mt: 2 }}
                InputProps={{
                  readOnly: true,
                }}
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('groupDetail.generateInvitePrompt')}
              </Typography>
              <Button
                variant="contained"
                onClick={handleGenerateInvite}
                startIcon={<AddIcon />}
              >
                {t('groupDetail.generateInvite')}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteDialogOpen(false); setInviteCode(''); }}>{t('common.close')}</Button>
          {inviteCode && (
            <Button
              variant="contained"
              startIcon={<ShareIcon />}
              onClick={handleShare}
            >
              {t('common.share')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="delete-group-dialog-title">
        <DialogTitle id="delete-group-dialog-title">{t('groups.deleteGroup')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('groupDetail.deleteConfirm', { name: group?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteGroup}
            color="error"
            variant="contained"
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            disabled={deleteLoading}
          >
            {deleteLoading ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const GroupMemberItem = React.memo(function GroupMemberItem({
  member,
  showDivider,
}: {
  member: { userId: string; userName: string; userPhotoUrl?: string; level?: number; role: GroupRole; totalGames: number; favoriteTeam?: string };
  showDivider: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <React.Fragment>
      <ListItem sx={{ py: 1.5 }}>
        <ListItemAvatar>
          <PlayerAvatar
            name={member.userName}
            photoUrl={member.userPhotoUrl}
            size={48}
            level={member.level}
          />
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={500}>
                {member.userName}
              </Typography>
              <TeamBadge teamId={member.favoriteTeam} size={18} />
              <Chip
                label={t(`group.role.${member.role.toLowerCase()}`)}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  bgcolor: alpha(getRoleColor(theme, member.role), 0.1),
                  color: getRoleColor(theme, member.role),
                }}
              />
            </Box>
          }
          secondary={t('groups.gamesCount', { count: member.totalGames })}
        />
      </ListItem>
      {showDivider && <Divider />}
    </React.Fragment>
  );
});
