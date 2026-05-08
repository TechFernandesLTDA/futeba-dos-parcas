import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  SportsSoccer as SoccerIcon,
  Payments as PaymentIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  HowToVote as VoteIcon,
  Share as ShareIcon,
  Navigation as NavIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { AppBreadcrumbs } from '../../components/layout';
import { useGameDetail, useConfirmPresence, useUpdateGameStatus } from '../../hooks/useGames';
import { softDeleteGame } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import {
  PAYMENT_STATUS_CONFIG,
  getStatusChipColors,
} from '../../types/game';
import { PlayerAvatar, StatusChip, ShimmerLoading, EmptyState } from '../../components/common/GameCard';
import { formatGameDateLong } from '../../utils/dateFormatters';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

export const GameDetailScreen: React.FC = () => {
  useDocumentTitle('Detalhes do Jogo');
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  // Breakpoints para layout responsivo
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const navigateBack = useNavigateBack('/games');

  const { game, confirmations, loading, error } = useGameDetail(gameId || null);
  const { confirmPresence, cancelPresence, loading: confirmLoading } = useConfirmPresence();
  const { updateStatus, loading: statusLoading } = useUpdateGameStatus();

  const [tabValue, setTabValue] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const myConfirmation = confirmations.find((c) => c.userId === currentUser?.uid);
  const isConfirmed = myConfirmation?.status === 'CONFIRMED';
  const isOwner = game?.ownerId === currentUser?.uid;
  const canManage = game && (isOwner || (game.coOrganizers?.includes(currentUser?.uid || '') ?? false));

  const confirmedPlayers = confirmations.filter((c) => c.status === 'CONFIRMED');
  const goalkeepers = confirmedPlayers.filter((c) => c.position === 'GOALKEEPER');
  const waitlist = confirmations.filter((c) => c.status === 'WAITLIST');

  const handleConfirmPresence = async (position: 'GOALKEEPER' | 'FIELD') => {
    if (!gameId) return;

    try {
      await confirmPresence(gameId, position);
      setPositionDialogOpen(false);
      showSuccess('Presença confirmada!');
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  const handleCancelPresence = async () => {
    if (!gameId) return;

    try {
      await cancelPresence(gameId);
      setCancelDialogOpen(false);
      showSuccess('Presença cancelada');
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

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      showSuccess('Link copiado!');
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    setDeleteLoading(true);
    try {
      await softDeleteGame({ gameId });
      setDeleteDialogOpen(false);
      showSuccess('Jogo excluído com sucesso');
      setTimeout(() => navigate('/'), 1000);
    } catch (err) {
      showError((err as Error)?.message || 'Erro ao excluir jogo');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ShimmerLoading count={3} type="card" />
      </Container>
    );
  }

  if (error || !game) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Alert severity="error">{error || 'Jogo não encontrado'}</Alert>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            Voltar
          </Button>
          {error && (
            <Button variant="contained" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          )}
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
              {/* TODO: Implementar tela de edição de jogo */}
              {/* <IconButton onClick={() => navigate(`/game/${gameId}/edit`)} aria-label="Editar jogo">
                <EditIcon />
              </IconButton> */}
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

      {/* Painel de informações do jogo — reutilizado em xs/sm (inline) e lg (sidebar) */}
      {(() => {
        const infoPanel = (
          <>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {(() => {
                    const sc = getStatusChipColors(theme, game.status);
                    return (
                      <Chip
                        label={sc.label}
                        size="small"
                        sx={{ backgroundColor: sc.bgColor, color: sc.color, fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    );
                  })()}
                  {game.gameType && <Chip label={game.gameType} size="small" variant="outlined" />}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TimeIcon color="primary" />
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {formatGameDateLong(game.date)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {game.time} {game.endTime && `- ${game.endTime}`}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <LocationIcon color="primary" sx={{ mt: 0.5 }} />
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {game.locationName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {game.locationAddress}
                      </Typography>
                      {game.locationLat && game.locationLng && (
                        <Button
                          size="small"
                          startIcon={<NavIcon />}
                          sx={{ mt: 1, p: 0 }}
                          onClick={() =>
                            window.open(
                              `https://www.google.com/maps/dir/?api=1&destination=${game.locationLat},${game.locationLng}`,
                              '_blank'
                            )
                          }
                        >
                          Navegar
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {game.dailyPrice > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <PaymentIcon color="primary" />
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          R$ {game.dailyPrice.toFixed(2)} por jogador
                        </Typography>
                        {game.pixKey && (
                          <Typography variant="body2" color="text.secondary">
                            Pix: {game.pixKey}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Jogadores
                    </Typography>
                  </Box>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    color={game.playersCount >= game.maxPlayers ? 'error' : 'primary'}
                  >
                    {game.playersCount}/{game.maxPlayers}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    width: '100%',
                    height: 8,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    borderRadius: 4,
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: `${(game.playersCount / game.maxPlayers) * 100}%`,
                      height: '100%',
                      bgcolor: game.playersCount >= game.maxPlayers ? 'error.main' : 'primary.main',
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Goleiros: {game.goalkeepersCount}/{game.maxGoalkeepers}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Lista: {game.playersCount}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </>
        );

        const mainContent = (
          <>
            <Card sx={{ mb: 2 }}>
              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label="Listas de jogadores"
                sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
              >
                <Tab label={`Confirmados (${confirmedPlayers.length})`} />
                <Tab label={`Goleiros (${goalkeepers.length})`} />
                <Tab label={`Espera (${waitlist.length})`} />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                {confirmedPlayers.length === 0 ? (
                  <EmptyState
                    icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
                    title="Nenhum jogador confirmado"
                    description="Seja o primeiro a confirmar presença!"
                  />
                ) : (
                  <List disablePadding aria-label="Jogadores confirmados">
                    {confirmedPlayers.map((player, index) => (
                      <ListItem key={player.id} divider={index < confirmedPlayers.length - 1}>
                        <ListItemAvatar>
                          <PlayerAvatar
                            name={player.userName}
                            photoUrl={player.userPhoto}
                            size={44}
                          />
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">{player.userName}</Typography>
                              {player.position === 'GOALKEEPER' && (
                                <Chip label="GK" size="small" color="primary" sx={{ height: 20 }} />
                              )}
                            </Box>
                          }
                          secondary={`#${player.confirmationOrder ?? (index + 1)}`}
                        />
                        <ListItemSecondaryAction>
                          <StatusChip status={player.paymentStatus} config={PAYMENT_STATUS_CONFIG} />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                {goalkeepers.length === 0 ? (
                  <EmptyState
                    title="Nenhum goleiro"
                    description="Nenhum goleiro confirmado ainda"
                  />
                ) : (
                  <List disablePadding>
                    {goalkeepers.map((player) => (
                      <ListItem key={player.id}>
                        <ListItemAvatar>
                          <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} />
                        </ListItemAvatar>
                        <ListItemText primary={player.userName} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                {waitlist.length === 0 ? (
                  <EmptyState
                    icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
                    title="Nenhum jogador na lista de espera"
                    description="Quando a lista estiver cheia, novos jogadores entram aqui"
                  />
                ) : (
                  <List disablePadding>
                    {waitlist.map((player) => (
                      <ListItem key={player.id}>
                        <ListItemAvatar>
                          <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} />
                        </ListItemAvatar>
                        <ListItemText primary={player.userName} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </TabPanel>
            </Card>

            {game.rules && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Regras do Jogo
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {game.rules}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {game.status === 'FINISHED' && (game.team1Score !== undefined || game.team2Score !== undefined) && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom textAlign="center">
                    Resultado Final
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography variant="h4" fontWeight={700}>
                        {game.team1Score}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {game.team1Name || 'Time 1'}
                      </Typography>
                    </Box>
                    <Typography variant="h5" color="text.secondary">
                      X
                    </Typography>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography variant="h4" fontWeight={700}>
                        {game.team2Score}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {game.team2Name || 'Time 2'}
                      </Typography>
                    </Box>
                  </Box>
                  {game.mvpId && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Chip
                        icon={<SoccerIcon />}
                        label={`MVP: ${game.mvpId}`}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        );

        // lg+: split-pane com sidebar de informações
        if (isLg) {
          return (
            <Container maxWidth="xl" sx={{ py: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} lg={4}>
                  {infoPanel}
                </Grid>
                <Grid item xs={12} lg={8}>
                  {mainContent}
                </Grid>
              </Grid>
            </Container>
          );
        }

        // md: container mais largo, layout linear
        if (isMd) {
          return (
            <Container maxWidth="md" sx={{ py: 2 }}>
              {infoPanel}
              {mainContent}
            </Container>
          );
        }

        // xs/sm: comportamento original (sem mudança)
        return (
          <Container maxWidth="sm" sx={{ py: 2 }}>
            {infoPanel}
            {mainContent}
          </Container>
        );
      })()}

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
            <Button
              variant="contained"
              fullWidth
              color="error"
              startIcon={<SoccerIcon />}
              onClick={() => navigate(`/game/${gameId}/live`)}
            >
              Ver Jogo ao Vivo
            </Button>
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
    </Box>
  );
};
