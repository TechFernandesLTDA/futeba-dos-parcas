import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Alert,
  Avatar,
  Chip,
} from '@mui/material';
import { getContrastRatio } from '@mui/material/styles';
import Grid from '@mui/material/Unstable_Grid2';
import SoccerIcon from '@mui/icons-material/SportsSoccer';
import CheckIcon from '@mui/icons-material/Check';
import PlayIcon from '@mui/icons-material/PlayArrow';
import CheckInIcon from '@mui/icons-material/HowToReg';
import VoteIcon from '@mui/icons-material/HowToVote';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import BackIcon from '@mui/icons-material/ArrowBack';
import DuplicateIcon from '@mui/icons-material/ContentCopy';
import CalendarIcon from '@mui/icons-material/CalendarMonth';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MessageIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PageContainer } from '../../components/common/PageContainer';
import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { AppBreadcrumbs, FixedBottomBar } from '../../components/layout';
import { useGameDetail, useConfirmPresence, useUpdateGameStatus } from '../../hooks/useGames';
import { useDuplicateGameCopy } from '../../hooks/useDuplicateGameCopy';
import { useWaitlist } from '../../hooks/useWaitlist';
import { softDeleteGame, checkInToGame, generateCheckinToken, startGameLifecycle } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { ShimmerLoading } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorScreen } from '../../components/common/ErrorScreen';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatGameDateLong } from '../../utils/dateFormatters';
import { resolveExpectedPayment } from '../../utils/gamePayment';
import { generateGoogleCalendarUrl, downloadIcsFile, generateOutlookCalendarUrl } from '../../utils/calendarLinks';
import { GameInfoPanel } from './GameInfoPanel';
import { GamePlayersSection } from './GamePlayersSection';
import { PositionReinforcementsPanel } from './PositionReinforcementsPanel';
import { GameRidesPanel } from './GameRidesPanel';
import { GamePhotosTab } from './GamePhotosTab';
import { GameVideosTab } from './GameVideosTab';
import { GameChatPanel } from './GameChatPanel';
import { GameCommentsPanel } from './GameCommentsPanel';
import { PostGameReputationPanel } from './PostGameReputationPanel';
import { PostGameHighlightsPanel } from './PostGameHighlightsPanel';
import { PostGameMessage, usePostGameMessages, useSavePostGameMessage } from '../../hooks/usePostGameMessages';
import type { Game, GameConfirmation, XpRewardStatus } from '../../types/game';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function isEditableGameStatus(status: Game['status']) {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

function toTimestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    if ('toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().getTime();
    }
  }
  return null;
}

const PostGameMessagesPanel: React.FC<{ gameId: string; canWrite: boolean }> = ({ gameId, canWrite }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { messages, loading, error, refetch } = usePostGameMessages(gameId);
  const saveMessage = useSavePostGameMessage(gameId);
  const existingMessage = messages.find((message) => message.userId === currentUser?.uid);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(existingMessage?.message ?? '');
  }, [existingMessage?.message]);

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <MessageIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{t('postGameMessages.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('postGameMessages.description')}</Typography>
          </Box>
        </Stack>
        {canWrite && (
          <Box sx={{ mt: 2 }}>
            <TextField value={draft} onChange={(event) => setDraft(event.target.value)} label={t('postGameMessages.inputLabel')} placeholder={t('postGameMessages.placeholder')} fullWidth multiline minRows={2} inputProps={{ maxLength: 240 }} helperText={t('common.charCount', { current: draft.length, max: 240 })} />
            <Button variant="contained" startIcon={saveMessage.isPending ? <CircularProgress size={16} color="inherit" /> : <MessageIcon />} onClick={() => saveMessage.mutate(draft)} disabled={saveMessage.isPending || draft.trim().length < 2} sx={{ mt: 1.5 }}>
              {saveMessage.isPending ? t('common.saving') : t('postGameMessages.save')}
            </Button>
          </Box>
        )}
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={() => refetch()}>{t('common.retry')}</Button>}>{error}</Alert>}
        {!loading && !error && messages.length === 0 && <EmptyState icon={<MessageIcon sx={{ fontSize: 48 }} />} title={t('postGameMessages.emptyTitle')} description={t('postGameMessages.emptyDesc')} />}
        {!loading && !error && messages.length > 0 && (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {messages.map((message) => <PostGameMessageItem key={message.id} message={message} />)}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const PostGameMessageItem: React.FC<{ message: PostGameMessage }> = ({ message }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start">
    <Avatar sx={{ width: 34, height: 34 }}>{message.userName.charAt(0).toUpperCase()}</Avatar>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" fontWeight={700}>{message.userName}</Typography>
      <Typography variant="body2" color="text.secondary">{message.message}</Typography>
    </Box>
  </Stack>
);

function getRewardAlertConfig(game: Game, isAdmin: boolean, canManage: boolean) {
  if (game.status !== 'FINISHED') return null;

  const reasons = game.xpRewardHoldReasons?.length ? game.xpRewardHoldReasons : game.validationReasons ?? [];
  const shared = {
    reasons,
    reviewedAt: game.xpRewardReviewedAt,
    reviewReason: game.xpRewardReviewReason,
  };

  switch (game.xpRewardStatus as XpRewardStatus | undefined) {
    case 'HELD_FOR_REVIEW':
      return {
        severity: 'warning' as const,
        title: 'Recompensas retidas para revisão',
        body: isAdmin || canManage
          ? 'Este jogo foi sinalizado pelo antifraude e aguarda decisão administrativa antes de liberar XP, ranking e badges.'
          : 'Este jogo está em análise pelo antifraude. XP, ranking e badges ficam pausados até o fim da revisão.',
        cta: isAdmin ? '/admin/game-reviews' : null,
        ctaLabel: 'Abrir fila de revisão',
        ...shared,
      };
    case 'ELIGIBLE':
      return {
        severity: 'info' as const,
        title: 'Recompensas liberadas para processamento',
        body: game.xpRewardReviewDecision === 'APPROVED'
          ? 'A revisão administrativa liberou este jogo para processamento de XP e demais recompensas.'
          : 'O jogo está elegível para processamento de XP e demais recompensas.',
        cta: null,
        ctaLabel: null,
        ...shared,
      };
    case 'REJECTED_BY_ADMIN':
      return {
        severity: 'error' as const,
        title: 'Recompensas rejeitadas',
        body: 'A revisão administrativa rejeitou as recompensas deste jogo. XP, ranking e badges não serão processados.',
        cta: isAdmin ? '/admin/game-reviews' : null,
        ctaLabel: 'Ver revisão',
        ...shared,
      };
    case 'PROCESSED':
      return {
        severity: 'success' as const,
        title: 'Recompensas processadas',
        body: 'XP, ranking e badges já foram processados para este jogo.',
        cta: null,
        ctaLabel: null,
        ...shared,
      };
    default:
      if (game.validationStatus === 'LOW_CONFIDENCE') {
        return {
          severity: 'info' as const,
          title: 'Jogo com baixa confiança',
          body: 'O antifraude registrou baixa confiança neste jogo, mas o processamento segue ativo.',
          cta: null,
          ctaLabel: null,
          ...shared,
        };
      }
      return null;
  }
}

const CheckInSocialPanel: React.FC<{
  checkedInPlayers: GameConfirmation[];
  canCheckIn: boolean;
  loading: boolean;
  onCheckIn: () => void;
}> = ({ checkedInPlayers, canCheckIn, loading, onCheckIn }) => {
  const { t } = useTranslation();

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <PlaceIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('checkinSocial.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('checkinSocial.description')}</Typography>
          </Box>
          <Chip icon={<CheckCircleIcon />} label={t('checkinSocial.count', { count: checkedInPlayers.length })} color={checkedInPlayers.length > 0 ? 'success' : 'default'} variant="outlined" />
        </Stack>

        {canCheckIn && (
          <Button
            variant="contained"
            color="success"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            onClick={onCheckIn}
            disabled={loading}
            sx={{ mb: 2 }}
          >
            {loading ? t('checkin.checkingIn') : t('checkinSocial.checkInNow')}
          </Button>
        )}

        {checkedInPlayers.length === 0 ? (
          <EmptyState
            icon={<PlaceIcon sx={{ fontSize: 48 }} />}
            title={t('checkinSocial.emptyTitle')}
            description={t('checkinSocial.emptyDesc')}
          />
        ) : (
          <Stack spacing={1.5}>
            {checkedInPlayers.map((player) => (
              <Stack key={player.id} direction="row" spacing={1.5} alignItems="center">
                <Avatar src={player.userPhoto}>{player.userName.charAt(0).toUpperCase()}</Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={700}>{player.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {player.checkedInAt
                      ? t('checkinSocial.arrivedAt', { time: player.checkedInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
                      : t('checkinSocial.arrived')}
                  </Typography>
                </Box>
                <Chip size="small" color="success" label={t('checkinSocial.present')} />
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export const GameDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('games.gameDetails'));
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser, user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Breakpoints para layout responsivo
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const navigateBack = useNavigateBack('/?tab=1');

  const { game, confirmations, loading, error } = useGameDetail(gameId || null);
  const { confirmPresence, cancelPresence, loading: confirmLoading } = useConfirmPresence();
  const { updateStatus, loading: statusLoading } = useUpdateGameStatus();
  const { duplicateGame, loading: duplicateGameLoading } = useDuplicateGameCopy();
  const {
    waitlist: waitlistEntries,
    loading: waitlistLoading,
    error: waitlistError,
  } = useWaitlist(gameId || null);

  const [tabValue, setTabValue] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [calendarAnchorEl, setCalendarAnchorEl] = useState<null | HTMLElement>(null);
  const [moreAnchorEl, setMoreAnchorEl] = useState<null | HTMLElement>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    time: '',
    maxPlayers: 0,
    rules: '',
  });
  const queryClient = useQueryClient();

  const myConfirmation = confirmations.find((c) => c.userId === currentUser?.uid);
  const isConfirmed = myConfirmation?.status === 'CONFIRMED';
  const isOwner = game?.ownerId === currentUser?.uid;
  const isCurrentUserAdmin = user?.role === 'ADMIN';
  const canManage = game && (isOwner || isCurrentUserAdmin || (game.coOrganizers?.includes(currentUser?.uid || '') ?? false));
  const canEditGame = !!game && !!canManage && isEditableGameStatus(game.status);
  const showPostGameMessages = game?.status === 'FINISHED';
  const canWritePostGameMessage = showPostGameMessages && (isConfirmed || !!canManage);
  const canManagePostGameContent = !!canManage;
  // Chat do jogo: visível para qualquer jogo, arquivado 7d após date_time
  const isChatArchived = useMemo(() => {
    if (!game?.dateTime) return false;
    return new Date().getTime() - game.dateTime.getTime() > 7 * 24 * 60 * 60 * 1000;
  }, [game?.dateTime]);
  const rewardAlert = useMemo(
    () => (game ? getRewardAlertConfig(game, isCurrentUserAdmin, !!canManage) : null),
    [game, isCurrentUserAdmin, canManage],
  );
  const checkedInPlayers = useMemo(
    () => confirmations.filter((confirmation) => confirmation.checkedIn),
    [confirmations],
  );
  const myCheckedIn = !!myConfirmation?.checkedIn;
  const showCheckInSocial = game?.status === 'LIVE' || game?.status === 'FINISHED';
  const canCheckInNow = game?.status === 'LIVE' && isConfirmed && !myCheckedIn;

  // #2272: arrays derivados memoizados — antes os 3 .filter() rodavam a cada render.
  const confirmedPlayers = useMemo(
    () => confirmations.filter((c) => c.status === 'CONFIRMED'),
    [confirmations],
  );
  const goalkeepers = useMemo(
    () => confirmedPlayers.filter((c) => c.position === 'GOALKEEPER'),
    [confirmedPlayers],
  );
  const waitlist = useMemo(
    () => waitlistEntries.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      userName: entry.userName,
      userPhoto: entry.userPhoto ?? undefined,
      favoriteTeam: undefined,
      queuePosition: entry.queuePosition,
      position: entry.position === 'GOALKEEPER' ? 'GOALKEEPER' : 'FIELD',
    })),
    [waitlistEntries],
  );
  const expectedPayment = useMemo(() => resolveExpectedPayment(game), [game]);

  const handleConfirmPresence = async (position: 'GOALKEEPER' | 'FIELD') => {
    if (!gameId) return;

    try {
      await confirmPresence(gameId, position);
      setPositionDialogOpen(false);
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  const handleCancelPresence = async () => {
    if (!gameId) return;

    try {
      await cancelPresence(gameId);
      setCancelDialogOpen(false);
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  const handleStartGame = async () => {
    if (!gameId || !game) return;

    try {
      if (game.status === 'SCHEDULED') {
        await updateStatus(gameId, 'CONFIRMED');
      } else if (game.status === 'CONFIRMED') {
        setLifecycleLoading(true);
        await startGameLifecycle({ gameId });
        navigate(`/game/${gameId}/live`);
      }
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    } finally {
      setLifecycleLoading(false);
    }
  };

  const gameShareUrl = game ? `https://futebadosparcas.web.app/game/${game.id}` : '';

  const handleShare = async () => {
    if (!game) return;

    const shareData = {
      title: t('games.detail.shareTitle', { location: game.locationName }),
      text: t('games.detail.shareText', { date: formatGameDateLong(game.date), time: game.time, address: game.locationAddress }),
      url: gameShareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(gameShareUrl);
        showSuccess(t('group.linkCopied'));
      }
    } catch (err) {
      // #2281: ignora cancelamento da share sheet; reporta demais erros.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(t('games.detail.shareError'));
    }
  };

  const handleCalendarOpen = (event: React.MouseEvent<HTMLElement>) => {
    setCalendarAnchorEl(event.currentTarget);
  };

  const handleCalendarClose = () => {
    setCalendarAnchorEl(null);
  };

  const handleAddToCalendar = (type: 'google' | 'ics' | 'outlook') => {
    if (!game) return;
    handleCalendarClose();

    const event = {
      title: `Futeba — ${game.locationName}`,
      description: [
        `⚽ Jogo: ${game.locationName}`,
        `📅 ${game.date} — ${game.time}${game.endTime ? ` às ${game.endTime}` : ''}`,
        `📍 ${game.locationAddress}`,
        `👥 ${game.maxPlayers} vagas`,
        game.rules ? `📋 ${game.rules}` : '',
        '',
        `Confirme sua presença: ${gameShareUrl}`,
      ].filter(Boolean).join('\n'),
      location: game.locationAddress,
      startDate: game.date,
      startTime: game.time,
      endDate: game.date,
      endTime: game.endTime || '',
    };

    if (type === 'google') {
      window.open(generateGoogleCalendarUrl(event), '_blank');
    } else if (type === 'outlook') {
      window.open(generateOutlookCalendarUrl(event), '_blank');
    } else {
      downloadIcsFile(event);
    }
  };

  const handleDuplicateGame = async () => {
    if (!gameId) return;
    const newGameId = await duplicateGame(gameId);
    if (newGameId) {
      navigate(`/game/${newGameId}`);
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    setDeleteLoading(true);
    try {
      await softDeleteGame({ gameId });
      setDeleteDialogOpen(false);
      showSuccess(t('games.detail.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['public-games'], exact: false });
      navigate('/?tab=1', { replace: true });
    } catch (err) {
      showError((err as Error)?.message || t('games.detail.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Abre dialog de edição populando form com valores atuais
  const openEditDialog = () => {
    if (!game) return;
    if (!isEditableGameStatus(game.status)) {
      showError(t('games.detail.editUnavailableStatus'));
      return;
    }
    setEditForm({
      date: game.date ?? '',
      time: game.time ?? '',
      maxPlayers: game.maxPlayers ?? 0,
      rules: game.rules ?? '',
    });
    setEditDialogOpen(true);
  };

  // Salva edição: atualiza date/time/dateTime sincronizados + max_players + rules
  const handleSaveEdit = async () => {
    if (!gameId || !game) return;

    // Validação mínima
    if (!editForm.date || !editForm.time) {
      showError(t('games.detail.errorDateTimeRequired'));
      return;
    }
    if (editForm.maxPlayers < 2 || editForm.maxPlayers > 50) {
      showError(t('games.detail.errorMaxPlayersRange'));
      return;
    }

    setEditLoading(true);
    try {
      const [year, month, day] = editForm.date.split('-').map(Number);
      const [hours, minutes] = editForm.time.split(':').map(Number);
      const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));

      const gameRef = doc(db, 'games', gameId);
      await runTransaction(db, async (transaction) => {
        const latestGameSnap = await transaction.get(gameRef);
        if (!latestGameSnap.exists()) {
          throw new Error(t('games.notFound'));
        }

        const latestStatus = latestGameSnap.get('status') as Game['status'];
        if (!isEditableGameStatus(latestStatus)) {
          throw new Error(t('games.detail.editUnavailableStatus'));
        }

        const expectedUpdatedAtMs = game.updatedAt?.getTime() ?? null;
        const latestUpdatedAtMs = toTimestampMillis(latestGameSnap.get('updated_at') ?? latestGameSnap.get('updatedAt'));
        if (expectedUpdatedAtMs !== latestUpdatedAtMs) {
          throw new Error(t('games.detail.editConflict'));
        }

        transaction.update(gameRef, {
          date: editForm.date,
          time: editForm.time,
          dateTime: dateTime,
          max_players: editForm.maxPlayers,
          rules: editForm.rules,
          updated_at: serverTimestamp(),
        });
      });

      queryClient.invalidateQueries({ queryKey: ['games'], exact: false });
      setEditDialogOpen(false);
      showSuccess(t('games.detail.updateSuccess'));
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    } finally {
      setEditLoading(false);
    }
  };

  const handleCheckIn = () => {
    if (!gameId || !game) return;

    if (!navigator.geolocation) {
      showError(t('games.detail.geolocationUnsupported'));
      return;
    }

    setCheckInLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await checkInToGame({
            gameId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          const distanceMeters = result.data.distance_m ?? result.data.distanceMeters;
          showSuccess(distanceMeters
            ? t('games.detail.checkInSuccessDistance', { meters: Math.round(distanceMeters) })
            : t('games.detail.checkInSuccess'));
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        } catch (err) {
          showError((err as Error)?.message || t('games.detail.checkInError'));
        } finally {
          setCheckInLoading(false);
        }
      },
      (_err) => {
        showError(t('games.detail.locationCaptureError'));
        setCheckInLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGenerateQr = async () => {
    if (!gameId) return;
    setQrLoading(true);
    try {
      const result = await generateCheckinToken({ gameId });
      setQrToken(result.data.token);
      setQrDialogOpen(true);
    } catch (err) {
      showError((err as Error)?.message || t('games.detail.qrGenerateError'));
    } finally {
      setQrLoading(false);
    }
  };

  const qrCheckInUrl = qrToken && gameId
    ? `${window.location.origin}/checkin/${gameId}/${qrToken}`
    : null;

  const qrColors = useMemo(() => {
    const paper = theme.palette.background.paper;
    const text = theme.palette.text.primary;
    const contrast = getContrastRatio(text, paper);
    if (theme.palette.mode === 'light' && contrast >= 7) {
      return { dark: text, light: paper };
    }
    return { dark: '#000000', light: '#ffffff' };
  }, [theme.palette.background.paper, theme.palette.mode, theme.palette.text.primary]);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerateError, setQrGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (qrCheckInUrl) {
      import('qrcode')
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(qrCheckInUrl, { width: 280, margin: 2, color: qrColors })
        )
        .then((url: string) => {
          setQrDataUrl(url);
          setQrGenerateError(null);
        })
        .catch(() => {
          setQrGenerateError('Erro ao gerar QR code.');
          setQrDataUrl(null);
        });
    } else {
      setQrDataUrl(null);
      setQrGenerateError(null);
    }
  }, [qrCheckInUrl, qrColors]);

  const handleDownloadQr = () => {
    if (!qrDataUrl || !gameId) return;
    const link = document.createElement('a');
    link.download = `checkin-${gameId}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <PageContainer maxWidth="detail">
        <ShimmerLoading count={3} type="card" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      // #2178: ErrorScreen padronizado
      <ErrorScreen
        message={error}
        onRetry={() => queryClient.invalidateQueries()}
        onBack={navigateBack}
        backLabel={t('common.back')}
      />
    );
  }

  if (!game) {
    return (
      <PageContainer maxWidth="detail">
        <EmptyState
          icon={<SoccerIcon sx={{ fontSize: 64 }} />}
          title={t('games.notFound')}
          description={t('games.detail.notFoundDesc')}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Cabeçalho padronizado — ações extras passadas via prop `actions` */}
      <ScreenHeader
        title={game.locationName}
        onBack={navigateBack}
        backAriaLabel={t('common.back')}
        actions={
          <>
            <Tooltip title={t('games.detail.shareGame')}>
              <IconButton onClick={handleShare} aria-label={t('games.detail.shareGame')}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('tooltip.addToCalendar')}>
              <IconButton onClick={handleCalendarOpen} aria-label={t('a11y.addToCalendar')}>
                <CalendarIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={calendarAnchorEl}
              open={Boolean(calendarAnchorEl)}
              onClose={handleCalendarClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => handleAddToCalendar('google')}>
                <ListItemIcon>
                  <CalendarIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Google Calendar</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleAddToCalendar('ics')}>
                <ListItemIcon>
                  <CalendarIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>iCal / Apple</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleAddToCalendar('outlook')}>
                <ListItemIcon>
                  <CalendarIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Outlook</ListItemText>
              </MenuItem>
            </Menu>
            {canManage && (
              <>
                <Tooltip title={t('common.moreOptions')}>
                  <IconButton
                    onClick={(e) => setMoreAnchorEl(e.currentTarget)}
                    aria-label={t('common.moreOptions')}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={moreAnchorEl}
                  open={Boolean(moreAnchorEl)}
                  onClose={() => setMoreAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  sx={{ display: { xs: 'block', md: 'none' } }}
                >
                  {game.status === 'CONFIRMED' && (
                    <MenuItem onClick={() => { setMoreAnchorEl(null); handleGenerateQr(); }} disabled={qrLoading}>
                      <ListItemIcon>
                        {qrLoading ? <CircularProgress size={20} /> : <QrCodeIcon fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText>{t('games.detail.qrCheckInTitle')}</ListItemText>
                    </MenuItem>
                  )}
                  <MenuItem onClick={() => { setMoreAnchorEl(null); handleDuplicateGame(); }} disabled={duplicateGameLoading}>
                    <ListItemIcon>
                      {duplicateGameLoading ? <CircularProgress size={20} /> : <DuplicateIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText>{t('tooltip.duplicateGame')}</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { setMoreAnchorEl(null); openEditDialog(); }} disabled={!canEditGame}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('games.detail.editGame')}</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { setMoreAnchorEl(null); setDeleteDialogOpen(true); }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>{t('games.detail.deleteGame')}</ListItemText>
                  </MenuItem>
                </Menu>
                <Box sx={{ display: { xs: 'none', md: 'contents' } }}>
                  {game.status === 'CONFIRMED' && (
                    <Tooltip title={t('games.detail.qrCheckInTitle')}>
                      <IconButton
                        onClick={handleGenerateQr}
                        aria-label={t('games.detail.qrCheckInTitle')}
                        disabled={qrLoading}
                      >
                        {qrLoading ? <CircularProgress size={20} /> : <QrCodeIcon />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t('tooltip.duplicateGame')}>
                    <IconButton
                      onClick={handleDuplicateGame}
                      aria-label={t('a11y.duplicateGame')}
                      disabled={duplicateGameLoading}
                    >
                      {duplicateGameLoading ? <CircularProgress size={20} /> : <DuplicateIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('games.detail.editGame')}>
                    <IconButton onClick={openEditDialog} aria-label={t('games.detail.editGame')} disabled={!canEditGame}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('games.detail.deleteGame')}>
                    <IconButton onClick={() => setDeleteDialogOpen(true)} color="error" aria-label={t('games.detail.deleteGame')}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </>
            )}
          </>
        }
        component="h1"
      />

      <AppBreadcrumbs
        items={[
          { label: t('games.title'), to: '/?tab=1' },
          ...(game.groupId ? [{ label: game.groupName ?? t('groups.title'), to: `/group/${game.groupId}` }] : []),
          { label: game.locationName || t('games.detail.gameOn', { date: game.date }) },
        ]}
      />

      {/* ====== Painel de informações + Listas de jogadores ====== */}
      {isLg ? (
        <PageContainer maxWidth="detail">
          {rewardAlert && (
            <Alert
              severity={rewardAlert.severity}
              sx={{ mb: 2 }}
              action={rewardAlert.cta ? (
                <Button color="inherit" size="small" onClick={() => navigate(rewardAlert.cta!)}>
                  {rewardAlert.ctaLabel}
                </Button>
              ) : undefined}
            >
              <Typography variant="body2" fontWeight={700}>{rewardAlert.title}</Typography>
              <Typography variant="body2">{rewardAlert.body}</Typography>
              {rewardAlert.reasons.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Motivos: {rewardAlert.reasons.join(' • ')}
                </Typography>
              )}
              {rewardAlert.reviewReason && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Revisão: {rewardAlert.reviewReason}
                </Typography>
              )}
            </Alert>
          )}
          <Grid container spacing={3}>
            <Grid xs={12} lg={4}>
              <GameInfoPanel game={game} />
            </Grid>
            <Grid xs={12} lg={8}>
              <GamePlayersSection
                game={game}
                confirmedPlayers={confirmedPlayers}
              goalkeepers={goalkeepers}
              waitlist={waitlist}
              waitlistLoading={waitlistLoading}
              waitlistError={waitlistError}
              confirmations={confirmations}
              tabValue={tabValue}
              onTabChange={setTabValue}
              />
              <PositionReinforcementsPanel
                game={game}
                confirmations={confirmations}
                canManage={isOwner || isCurrentUserAdmin}
              />
              <GameRidesPanel
                game={game}
                canUse={!!(isConfirmed || canManage)}
              />
              {showCheckInSocial && (
                <CheckInSocialPanel
                  checkedInPlayers={checkedInPlayers}
                  canCheckIn={!!canCheckInNow}
                  loading={checkInLoading}
                  onCheckIn={handleCheckIn}
                />
              )}
              <GameChatPanel
                gameId={gameId!}
                isConfirmedPlayer={isConfirmed}
                isOwner={isOwner}
                canManage={!!canManage}
                isArchived={isChatArchived}
              />
              <GameCommentsPanel
                gameId={gameId!}
                canWrite={!!(isConfirmed || canManage)}
                canManage={!!canManage}
              />
              {showPostGameMessages && (
                <GamePhotosTab
                  gameId={gameId!}
                  isFinished={showPostGameMessages}
                  isConfirmedPlayer={isConfirmed}
                  isOwner={isOwner}
                  canManage={canManagePostGameContent}
                />
              )}
              {showPostGameMessages && (
                <GameVideosTab
                  gameId={gameId!}
                  isFinished={showPostGameMessages}
                  isConfirmedPlayer={isConfirmed}
                  isOwner={isOwner}
                  canManage={canManagePostGameContent}
                />
              )}
              {showPostGameMessages && (
                <PostGameHighlightsPanel
                  game={game}
                  confirmations={confirmations}
                />
              )}
              {showPostGameMessages && <PostGameMessagesPanel gameId={gameId!} canWrite={canWritePostGameMessage} />}
              {showPostGameMessages && (
                <PostGameReputationPanel
                  gameId={gameId!}
                  confirmations={confirmations}
                  currentUserId={currentUser?.uid}
                  canWrite={!!isConfirmed}
                />
              )}
            </Grid>
          </Grid>
        </PageContainer>
      ) : (
        <PageContainer maxWidth="detail">
          {rewardAlert && (
            <Alert
              severity={rewardAlert.severity}
              sx={{ mb: 2 }}
              action={rewardAlert.cta ? (
                <Button color="inherit" size="small" onClick={() => navigate(rewardAlert.cta!)}>
                  {rewardAlert.ctaLabel}
                </Button>
              ) : undefined}
            >
              <Typography variant="body2" fontWeight={700}>{rewardAlert.title}</Typography>
              <Typography variant="body2">{rewardAlert.body}</Typography>
              {rewardAlert.reasons.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Motivos: {rewardAlert.reasons.join(' • ')}
                </Typography>
              )}
              {rewardAlert.reviewReason && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Revisão: {rewardAlert.reviewReason}
                </Typography>
              )}
            </Alert>
          )}
          <GameInfoPanel game={game} />
          <GamePlayersSection
            game={game}
            confirmedPlayers={confirmedPlayers}
            goalkeepers={goalkeepers}
            waitlist={waitlist}
            waitlistLoading={waitlistLoading}
            waitlistError={waitlistError}
            confirmations={confirmations}
            tabValue={tabValue}
            onTabChange={setTabValue}
          />
          <PositionReinforcementsPanel
            game={game}
            confirmations={confirmations}
            canManage={isOwner || isCurrentUserAdmin}
          />
          <GameRidesPanel
            game={game}
            canUse={!!(isConfirmed || canManage)}
          />
          {showCheckInSocial && (
            <CheckInSocialPanel
              checkedInPlayers={checkedInPlayers}
              canCheckIn={!!canCheckInNow}
              loading={checkInLoading}
              onCheckIn={handleCheckIn}
            />
          )}
          <GameChatPanel
            gameId={gameId!}
            isConfirmedPlayer={isConfirmed}
            isOwner={isOwner}
            canManage={!!canManage}
            isArchived={isChatArchived}
          />
          {showPostGameMessages && (
            <GamePhotosTab
              gameId={gameId!}
              isFinished={showPostGameMessages}
              isConfirmedPlayer={isConfirmed}
              isOwner={isOwner}
              canManage={canManagePostGameContent}
            />
          )}
          {showPostGameMessages && (
            <GameVideosTab
              gameId={gameId!}
              isFinished={showPostGameMessages}
              isConfirmedPlayer={isConfirmed}
              isOwner={isOwner}
              canManage={canManagePostGameContent}
            />
          )}
          {showPostGameMessages && (
            <PostGameHighlightsPanel
              game={game}
              confirmations={confirmations}
            />
          )}
          {showPostGameMessages && <PostGameMessagesPanel gameId={gameId!} canWrite={canWritePostGameMessage} />}
          {showPostGameMessages && (
            <PostGameReputationPanel
              gameId={gameId!}
              confirmations={confirmations}
              currentUserId={currentUser?.uid}
              canWrite={!!isConfirmed}
            />
          )}
        </PageContainer>
      )}

      {/* ====== Bottom Action Bar (#2178: FixedBottomBar) ====== */}

      <FixedBottomBar>
        <Box sx={{ width: '100%' }}>
          {game.status === 'SCHEDULED' || game.status === 'CONFIRMED' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {canManage && game.status === 'CONFIRMED' && (
                <Button
                  variant="outlined"
                  startIcon={qrLoading ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
                  onClick={handleGenerateQr}
                  disabled={qrLoading}
                >
                  {t('games.detail.qrCode')}
                </Button>
              )}
              {isConfirmed ? (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={confirmLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={confirmLoading}
                  >
                    {t('games.cancelPresence')}
                  </Button>
                  {canManage && game.status === 'CONFIRMED' && (
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={statusLoading || lifecycleLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                      onClick={handleStartGame}
                      disabled={statusLoading || lifecycleLoading}
                    >
                      {t('games.live.startGame')}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={confirmLoading ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                  onClick={() => setPositionDialogOpen(true)}
                  disabled={confirmLoading || game.playersCount >= game.maxPlayers}
                >
                  {game.playersCount >= game.maxPlayers ? t('games.detail.listFull') : t('games.confirmPresence')}
                </Button>
              )}
            </Box>
          ) : game.status === 'LIVE' ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {isConfirmed && !myCheckedIn && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={checkInLoading ? <CircularProgress size={16} color="inherit" /> : <CheckInIcon />}
                  onClick={handleCheckIn}
                  disabled={checkInLoading}
                >
                  {t('games.detail.checkIn')}
                </Button>
              )}
              {canManage && (
                <Button
                  variant="outlined"
                  startIcon={qrLoading ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
                  onClick={handleGenerateQr}
                  disabled={qrLoading}
                >
                  {t('games.detail.qrCode')}
                </Button>
              )}
              <Button
                variant="contained"
                fullWidth
                color="error"
                startIcon={<SoccerIcon />}
                onClick={() => navigate(`/game/${gameId}/live`)}
              >
                {t('games.detail.watchLive')}
              </Button>
            </Box>
          ) : game.status === 'FINISHED' && !game.votingConcluded ? (
            <Button
              variant="contained"
              fullWidth
              color="primary"
              startIcon={<VoteIcon />}
              onClick={() => navigate(`/game/${gameId}/vote`)}
            >
              {t('games.detail.voteMvp')}
            </Button>
          ) : null}
        </Box>
      </FixedBottomBar>

      {/* ====== Dialogs ====== */}
      <Dialog open={positionDialogOpen} onClose={() => setPositionDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="position-dialog-title">
        <DialogTitle id="position-dialog-title">{t('games.detail.choosePosition')}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              Valor para confirmar: {currencyFormatter.format(expectedPayment)}
            </Typography>
            {game.totalCost > 0 && (
              <Typography variant="caption" color="text.secondary">
                Custo total do jogo: {currencyFormatter.format(game.totalCost)}. O valor por jogador ja considera a duracao escolhida.
              </Typography>
            )}
          </Alert>
          <Box sx={{ display: 'flex', gap: 2, pt: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleConfirmPresence('FIELD')}
              disabled={confirmLoading || game.playersCount >= game.maxPlayers}
            >
              {t('games.detail.fieldPlayer')}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleConfirmPresence('GOALKEEPER')}
              disabled={confirmLoading || game.playersCount >= game.maxPlayers || game.goalkeepersCount >= game.maxGoalkeepers}
            >
              {t('profile.goalkeeper')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="cancel-dialog-title">
        <DialogTitle id="cancel-dialog-title">{t('games.cancelPresence')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('games.detail.cancelPresenceConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>{t('games.detail.no')}</Button>
          <Button
            onClick={handleCancelPresence}
            color="error"
            variant="contained"
            startIcon={confirmLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            disabled={confirmLoading}
          >
            {t('games.detail.yesCancel')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="edit-game-dialog-title"
      >
        <DialogTitle id="edit-game-dialog-title">{t('games.detail.editGame')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t('games.date')}
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={editLoading}
            />
            <TextField
              label={t('games.time')}
              type="time"
              value={editForm.time}
              onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={editLoading}
            />
            <TextField
              label={t('games.detail.maxPlayersLabel')}
              type="number"
              value={editForm.maxPlayers}
              onChange={(e) =>
                setEditForm({ ...editForm, maxPlayers: parseInt(e.target.value, 10) || 0 })
              }
              inputProps={{ min: 2, max: 50 }}
              fullWidth
              disabled={editLoading}
              helperText={t('games.detail.maxPlayersHelper')}
            />
            <TextField
              label={t('games.detail.rulesLabel')}
              multiline
              rows={3}
              value={editForm.rules}
              onChange={(e) => setEditForm({ ...editForm, rules: e.target.value })}
              fullWidth
              disabled={editLoading}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={editLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            startIcon={editLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            disabled={editLoading}
          >
            {editLoading ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="delete-game-dialog-title">
        <DialogTitle id="delete-game-dialog-title">{t('games.detail.deleteGame')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('games.detail.deleteConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteGame}
            color="error"
            variant="contained"
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            disabled={deleteLoading}
          >
            {deleteLoading ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="xs"
        aria-labelledby="qr-dialog-title"
      >
        <DialogTitle id="qr-dialog-title">{t('games.detail.qrCheckInTitle')}</DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 3, sm: 2 } }}>
          <Box sx={{ textAlign: 'center', py: 2, maxWidth: 360, mx: 'auto' }}>
            {qrCheckInUrl && qrDataUrl ? (
              <>
                <Box
                  component="img"
                  src={qrDataUrl}
                  alt={t('games.detail.qrAlt')}
                  sx={{
                    width: '100%',
                    maxWidth: 280,
                    aspectRatio: '1 / 1',
                    mb: 2,
                    bgcolor: qrColors.light,
                    p: 1,
                    borderRadius: 1,
                    border: (theme) =>
                      theme.palette.mode === 'dark'
                        ? `2px solid ${theme.palette.divider}`
                        : 'none',
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('games.detail.qrInstructions')}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(qrCheckInUrl);
                        showSuccess(t('group.linkCopied'));
                      } catch {
                        showError(t('group.copyLinkError'));
                      }
                    }}
                  >
                    {t('games.detail.copyLink')}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleDownloadQr}
                  >
                    {t('games.detail.downloadQrCode')}
                  </Button>
                </Stack>
              </>
            ) : qrGenerateError ? (
              <Typography variant="body2" color="error" sx={{ py: 4 }}>
                {qrGenerateError}
              </Typography>
            ) : qrCheckInUrl ? (
              <Box sx={{ py: 4 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Gerando QR code...
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                Nenhum QR code disponível.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
