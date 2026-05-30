import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
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
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  HowToReg as CheckInIcon,
  HowToVote as VoteIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  QrCode2 as QrCodeIcon,
} from '@mui/icons-material';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { AppBreadcrumbs } from '../../components/layout';
import { useGameDetail, useConfirmPresence, useUpdateGameStatus } from '../../hooks/useGames';
import { softDeleteGame, checkInToGame, generateCheckinToken } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { ShimmerLoading } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatGameDateLong } from '../../utils/dateFormatters';
import { GameInfoPanel } from './GameInfoPanel';
import { GamePlayersSection } from './GamePlayersSection';

export const GameDetailScreen: React.FC = () => {
  useDocumentTitle('Detalhes do Jogo');
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

  const handleShare = async () => {
    if (!game) return;

    const shareData = {
      title: `Pelada: ${game.locationName}`,
      text: `Vem jogar com a gente! ${formatGameDateLong(game.date)} às ${game.time}\n${game.locationAddress}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        showSuccess('Link copiado!');
      }
    } catch (err) {
      // #2281: ignora cancelamento da share sheet; reporta demais erros.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError('Erro ao compartilhar');
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    setDeleteLoading(true);
    try {
      await softDeleteGame({ gameId });
      setDeleteDialogOpen(false);
      showSuccess('Jogo excluído com sucesso');
      navigate('/?tab=1', { replace: true });
    } catch (err) {
      showError((err as Error)?.message || 'Erro ao excluir jogo');
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
      showError('Informe data e horário');
      return;
    }
    if (editForm.maxPlayers < 2 || editForm.maxPlayers > 50) {
      showError('Número máximo de jogadores deve ser entre 2 e 50');
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
      showSuccess('Jogo atualizado');
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    } finally {
      setEditLoading(false);
    }
  };

  const handleCheckIn = () => {
    if (!gameId || !game) return;

    if (!navigator.geolocation) {
      showError('Geolocalização não suportada pelo navegador.');
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
          showSuccess(`Check-in realizado com sucesso!${result.data.distanceMeters ? ` (${Math.round(result.data.distanceMeters)}m do local)` : ''}`);
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        } catch (err) {
          showError((err as Error)?.message || 'Erro ao realizar check-in');
        } finally {
          setCheckInLoading(false);
        }
      },
      (_err) => {
        showError('Erro ao capturar localização. Verifique as permissões.');
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
      showError((err as Error)?.message || 'Erro ao gerar QR Code');
    } finally {
      setQrLoading(false);
    }
  };

  const qrCheckInUrl = qrToken && gameId
    ? `${window.location.origin}/checkin/${gameId}/${qrToken}`
    : null;

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ShimmerLoading count={3} type="card" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ErrorState
          message={error}
          onRetry={() => queryClient.invalidateQueries()}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            Voltar
          </Button>
        </Box>
      </Container>
    );
  }

  if (!game) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <EmptyState
          icon={<SoccerIcon sx={{ fontSize: 64 }} />}
          title="Jogo não encontrado"
          description="O jogo que você procura não está disponível."
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            Voltar
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={navigateBack} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ flex: 1, ml: 1 }} noWrap>
            {game.locationName}
          </Typography>
          <IconButton onClick={handleShare} aria-label="Compartilhar jogo">
            <ShareIcon />
          </IconButton>
          {canManage && (
            <>
              <IconButton onClick={openEditDialog} aria-label="Editar jogo">
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => setDeleteDialogOpen(true)} color="error" aria-label="Excluir jogo">
                <DeleteIcon />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      <AppBreadcrumbs
        items={[
          { label: 'Jogos', to: '/?tab=1' },
          ...(game.groupId ? [{ label: game.groupName ?? 'Grupo', to: `/group/${game.groupId}` }] : []),
          { label: game.locationName || `Jogo ${game.date}` },
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

      {/* ====== Bottom Action Bar ====== */}

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: { xs: 0, sm: '50%' },
          right: { xs: 0, sm: 'auto' },
          transform: { sm: 'translateX(-50%)' },
          width: { xs: '100%', sm: 480 },
          maxWidth: 480,
          bgcolor: 'background.paper',
          borderTop: `1px solid ${theme.palette.divider}`,
          p: 2,
          zIndex: 10,
        }}
      >
        <Container maxWidth="sm">
          {game.status === 'SCHEDULED' || game.status === 'CONFIRMED' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isConfirmed ? (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={confirmLoading}
                  >
                    Cancelar Presença
                  </Button>
                  {canManage && game.status === 'CONFIRMED' && (
                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      startIcon={<PlayIcon />}
                      onClick={handleStartGame}
                      disabled={statusLoading}
                    >
                      Iniciar Jogo
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<CheckIcon />}
                  onClick={() => setPositionDialogOpen(true)}
                  disabled={confirmLoading || game.playersCount >= game.maxPlayers}
                >
                  {game.playersCount >= game.maxPlayers ? 'Lista Cheia' : 'Confirmar Presença'}
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
                  Check-in
                </Button>
              )}
              {canManage && (
                <Button
                  variant="outlined"
                  startIcon={qrLoading ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
                  onClick={handleGenerateQr}
                  disabled={qrLoading}
                >
                  QR Code
                </Button>
              )}
              <Button
                variant="contained"
                fullWidth
                color="error"
                startIcon={<SoccerIcon />}
                onClick={() => navigate(`/game/${gameId}/live`)}
              >
                Ver Jogo ao Vivo
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
              Votar MVP
            </Button>
          ) : null}
        </Container>
      </Box>

      {/* ====== Dialogs ====== */}
      <Dialog open={positionDialogOpen} onClose={() => setPositionDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="position-dialog-title">
        <DialogTitle id="position-dialog-title">Escolha sua posição</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleConfirmPresence('FIELD')}
              disabled={game.goalkeepersCount >= game.maxGoalkeepers && game.goalkeepersCount > 0}
            >
              Jogador de Linha
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => handleConfirmPresence('GOALKEEPER')}
              disabled={game.goalkeepersCount >= game.maxGoalkeepers}
            >
              Goleiro
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="cancel-dialog-title">
        <DialogTitle id="cancel-dialog-title">Cancelar Presença</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tem certeza que deseja cancelar sua presença?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Não</Button>
          <Button onClick={handleCancelPresence} color="error" variant="contained">
            Sim, cancelar
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
        <DialogTitle id="edit-game-dialog-title">Editar Jogo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Data"
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={editLoading}
            />
            <TextField
              label="Horário"
              type="time"
              value={editForm.time}
              onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={editLoading}
            />
            <TextField
              label="Máximo de jogadores"
              type="number"
              value={editForm.maxPlayers}
              onChange={(e) =>
                setEditForm({ ...editForm, maxPlayers: parseInt(e.target.value, 10) || 0 })
              }
              inputProps={{ min: 2, max: 50 }}
              fullWidth
              disabled={editLoading}
              helperText="Entre 2 e 50"
            />
            <TextField
              label="Regras"
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
            Cancelar
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={editLoading}>
            {editLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="delete-game-dialog-title">
        <DialogTitle id="delete-game-dialog-title">Excluir Jogo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja excluir este jogo? Esta ação pode ser revertida por um administrador.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteGame} color="error" variant="contained" disabled={deleteLoading}>
            {deleteLoading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} fullWidth maxWidth="xs" aria-labelledby="qr-dialog-title">
        <DialogTitle id="qr-dialog-title">QR Code de Check-in</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {qrCheckInUrl && (
              <>
                <Box
                  component="img"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCheckInUrl)}`}
                  alt="QR Code para check-in"
                  sx={{
                    width: 250,
                    height: 250,
                    mb: 2,
                    bgcolor: 'common.white',
                    p: 1,
                    borderRadius: 1,
                  }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Os jogadores podem escanear este QR code para fazer check-in
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={async () => {
                    // #2281: clipboard.writeText pode lançar sem permissão (HTTP/sandbox)
                    try {
                      await navigator.clipboard.writeText(qrCheckInUrl);
                      showSuccess('Link copiado!');
                    } catch {
                      showError('Não foi possível copiar o link');
                    }
                  }}
                >
                  Copiar Link
                </Button>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
