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
import Grid from '@mui/material/Unstable_Grid2';
import {
  SportsSoccer as SoccerIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  HowToReg as CheckInIcon,
  HowToVote as VoteIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  QrCode2 as QrCodeIcon,
  ArrowBack as BackIcon,
  ContentCopy as DuplicateIcon,
  CalendarMonth as CalendarIcon,
  MoreVert as MoreVertIcon,
  ChatBubbleOutline as MessageIcon,
  CheckCircle as CheckCircleIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PageContainer } from '../../components/common/PageContainer';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { AppBreadcrumbs, FixedBottomBar } from '../../components/layout';
import { useGameDetail, useConfirmPresence, useUpdateGameStatus } from '../../hooks/useGames';
import { useDuplicateGameCopy } from '../../hooks/useDuplicateGameCopy';
import { softDeleteGame, checkInToGame, generateCheckinToken } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { ShimmerLoading } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorScreen } from '../../components/common/ErrorScreen';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatGameDateLong } from '../../utils/dateFormatters';
import { generateGoogleCalendarUrl, downloadIcsFile, generateOutlookCalendarUrl } from '../../utils/calendarLinks';
import { GameInfoPanel } from './GameInfoPanel';
import { GamePlayersSection } from './GamePlayersSection';
import { PositionReinforcementsPanel } from './PositionReinforcementsPanel';
import { GamePhotosTab } from './GamePhotosTab';
import { PostGameMessage, usePostGameMessages, useSavePostGameMessage } from '../../hooks/usePostGameMessages';
import type { GameConfirmation } from '../../types/game';

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
  const showPostGameMessages = game?.status === 'FINISHED';
  const canWritePostGameMessage = showPostGameMessages && (isConfirmed || !!canManage);
  const canManagePostGameContent = !!canManage;
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
    () => confirmations.filter((c) => c.status === 'WAITLIST'),
    [confirmations],
  );

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
        await updateStatus(gameId, 'LIVE');
        navigate(`/game/${gameId}/live`);
      }
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
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
      await updateDoc(gameRef, {
        date: editForm.date,
        time: editForm.time,
        dateTime: dateTime,
        max_players: editForm.maxPlayers,
        rules: editForm.rules,
        updated_at: serverTimestamp(),
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
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          showSuccess(result.data.distanceMeters
            ? t('games.detail.checkInSuccessDistance', { meters: Math.round(result.data.distanceMeters) })
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

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerateError, setQrGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (qrCheckInUrl) {
      import('qrcode')
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(qrCheckInUrl, { width: 250, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
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
  }, [qrCheckInUrl]);

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
                  <MenuItem onClick={() => { setMoreAnchorEl(null); openEditDialog(); }}>
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
                    <IconButton onClick={openEditDialog} aria-label={t('games.detail.editGame')}>
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
                confirmations={confirmations}
                tabValue={tabValue}
                onTabChange={setTabValue}
              />
              <PositionReinforcementsPanel
                game={game}
                confirmations={confirmations}
                canManage={isOwner || isCurrentUserAdmin}
              />
              {showCheckInSocial && (
                <CheckInSocialPanel
                  checkedInPlayers={checkedInPlayers}
                  canCheckIn={!!canCheckInNow}
                  loading={checkInLoading}
                  onCheckIn={handleCheckIn}
                />
              )}
              {showPostGameMessages && (
                <GamePhotosTab
                  gameId={gameId!}
                  isFinished={showPostGameMessages}
                  isConfirmedPlayer={isConfirmed}
                  isOwner={isOwner}
                  canManage={canManagePostGameContent}
                />
              )}
              {showPostGameMessages && <PostGameMessagesPanel gameId={gameId!} canWrite={canWritePostGameMessage} />}
            </Grid>
          </Grid>
        </PageContainer>
      ) : (
        <PageContainer maxWidth="detail">
          <GameInfoPanel game={game} />
          <GamePlayersSection
            game={game}
            confirmedPlayers={confirmedPlayers}
            goalkeepers={goalkeepers}
            waitlist={waitlist}
            confirmations={confirmations}
            tabValue={tabValue}
            onTabChange={setTabValue}
          />
          <PositionReinforcementsPanel
            game={game}
            confirmations={confirmations}
            canManage={isOwner || isCurrentUserAdmin}
          />
          {showCheckInSocial && (
            <CheckInSocialPanel
              checkedInPlayers={checkedInPlayers}
              canCheckIn={!!canCheckInNow}
              loading={checkInLoading}
              onCheckIn={handleCheckIn}
            />
          )}
          {showPostGameMessages && (
            <GamePhotosTab
              gameId={gameId!}
              isFinished={showPostGameMessages}
              isConfirmedPlayer={isConfirmed}
              isOwner={isOwner}
              canManage={canManagePostGameContent}
            />
          )}
          {showPostGameMessages && <PostGameMessagesPanel gameId={gameId!} canWrite={canWritePostGameMessage} />}
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
                  QR Code
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
                      startIcon={statusLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                      onClick={handleStartGame}
                      disabled={statusLoading}
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
          <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleConfirmPresence('FIELD')}
              disabled={game.goalkeepersCount >= game.maxGoalkeepers && game.goalkeepersCount > 0}
            >
              {t('games.detail.fieldPlayer')}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleConfirmPresence('GOALKEEPER')}
              disabled={game.goalkeepersCount >= game.maxGoalkeepers}
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

      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} fullWidth maxWidth="xs" aria-labelledby="qr-dialog-title">
        <DialogTitle id="qr-dialog-title">{t('games.detail.qrCheckInTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {qrCheckInUrl && qrDataUrl ? (
              <>
                <Box
                  component="img"
                  src={qrDataUrl}
                  alt={t('games.detail.qrAlt')}
                  sx={{
                    width: 250,
                    height: 250,
                    mb: 2,
                    bgcolor: 'common.white',
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
                <Box sx={{ display: 'flex', gap: 1 }}>
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
                </Box>
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
