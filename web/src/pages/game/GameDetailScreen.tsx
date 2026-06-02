import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import QRCode from 'qrcode';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
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
} from '@mui/icons-material';
import { ScreenHeader } from '../../components/common/ScreenHeader';
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
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg'));
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
      // Reconstruir dateTime Timestamp pra manter date/time/date_time consistentes
      // (mesmo padrão de CreateGameScreen.handleSubmit)
      const [year, month, day] = editForm.date.split('-').map(Number);
      const [hours, minutes] = editForm.time.split(':').map(Number);
      const dateTime = Timestamp.fromDate(new Date(year, month - 1, day, hours, minutes));

      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        date: editForm.date,
        time: editForm.time,
        date_time: dateTime,
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
      QRCode.toDataURL(qrCheckInUrl, { width: 250, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then((url) => {
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
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ShimmerLoading count={3} type="card" />
      </Container>
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
      <Container maxWidth="sm" sx={{ py: 2 }}>
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
      </Container>
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
            <Tooltip title="Adicionar ao Calendário">
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
                <Tooltip title="Duplicar Jogo">
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
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={4}>
              <GameInfoPanel game={game} />
            </Grid>
            <Grid item xs={12} lg={8}>
              <GamePlayersSection
                game={game}
                gameId={gameId!}
                confirmedPlayers={confirmedPlayers}
                goalkeepers={goalkeepers}
                waitlist={waitlist}
                confirmations={confirmations}
                myConfirmation={myConfirmation}
                isOwner={isOwner}
                tabValue={tabValue}
                onTabChange={setTabValue}
              />
            </Grid>
          </Grid>
        </Container>
      ) : (
        <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
          <GameInfoPanel game={game} />
          <GamePlayersSection
            game={game}
            gameId={gameId!}
            confirmedPlayers={confirmedPlayers}
            goalkeepers={goalkeepers}
            waitlist={waitlist}
            confirmations={confirmations}
            myConfirmation={myConfirmation}
            isOwner={isOwner}
            tabValue={tabValue}
            onTabChange={setTabValue}
          />
        </Container>
      )}

      {/* ====== Bottom Action Bar (#2178: FixedBottomBar) ====== */}

      <FixedBottomBar>
        <Container maxWidth="sm">
          {game.status === 'SCHEDULED' || game.status === 'CONFIRMED' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
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
              {isConfirmed && myConfirmation?.status !== 'CHECKED_IN' && (
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
        </Container>
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
                    Baixar QR code
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
