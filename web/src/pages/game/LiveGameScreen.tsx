import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Skeleton,
  CircularProgress,
  useTheme,
  useMediaQuery,
  alpha,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  SportsSoccer as SoccerIcon,
  Add as AddIcon,
  Timer as TimerIcon,
  Square as YellowCardIcon,
  Block as RedCardIcon,
  EmojiEvents as AssistIcon,
  SaveAlt as SaveIcon,
  SwapHoriz as SubstitutionIcon,
} from '@mui/icons-material';
import { doc, collection, query, where, onSnapshot, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { Game, GameEvent, GameEventType } from '../../types/game';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LiveGameScreen');

interface LiveScore {
  id: string;
  team1Score: number;
  team2Score: number;
  startedAt: Date;
}

interface ConfirmedPlayer {
  id: string;
  name: string;
  photo?: string;
}

function canManageGame(game: Game | null, uid?: string): boolean {
  if (!game || !uid) return false;
  if (game.ownerId === uid) return true;
  if (game.coOrganizers?.includes(uid)) return true;
  return false;
}

export const LiveGameScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('games.liveTitle'));
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigateBack = useNavigateBack('/games');
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const queryClient = useQueryClient();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const uid = currentUser?.uid;

  const [game, setGame] = useState<Game | null>(null);
  const [score, setScore] = useState<LiveScore | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [confirmedPlayers, setConfirmedPlayers] = useState<ConfirmedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [addEventDialog, setAddEventDialog] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<GameEventType>('GOAL');
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canManage = canManageGame(game, uid);

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const gameRef = doc(db, 'games', gameId);

    const unsubscribeGame = onSnapshot(
      gameRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const data = snakeToCamel(raw);
          const parsedGame = { id: docSnap.id, ...data } as Game;
          setGame(parsedGame);
          setIsRunning(raw.status === 'LIVE');
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching game:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    const scoreRef = doc(db, 'live_scores', gameId);
    const unsubscribeScore = onSnapshot(scoreRef, (docSnap) => {
      if (docSnap.exists()) {
        const raw = docSnap.data();
        setScore({
          id: docSnap.id,
          team1Score: raw.team1_score ?? 0,
          team2Score: raw.team2_score ?? 0,
          startedAt: (raw.started_at as { toDate?: () => Date })?.toDate?.() || new Date(),
        });
      }
    }, (err) => {
      logger.error('Error in score listener:', err);
      showErrorRef.current('Erro ao carregar placar do jogo');
    });

    const eventsQuery = query(collection(db, 'game_events'), where('game_id', '==', gameId));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map((d) => {
        const raw = d.data();
        const data = snakeToCamel(raw);
        return {
          id: d.id,
          ...data,
          createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
        };
      }) as GameEvent[];
      setEvents([...eventsData].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0)));
    }, (err) => {
      logger.error('Error in events listener:', err);
      showErrorRef.current('Erro ao carregar eventos do jogo');
    });

    const confirmationsQuery = query(
      collection(db, 'confirmations'),
      where('game_id', '==', gameId)
    );
    const unsubscribeConfirmations = onSnapshot(confirmationsQuery, (snapshot) => {
      const players = snapshot.docs
        .filter((d) => d.data().status === 'CONFIRMED')
        .map((d) => {
          const raw = d.data();
          return {
            id: raw.user_id,
            name: raw.user_name || 'Jogador',
            photo: raw.user_photo || undefined,
          };
        });
      setConfirmedPlayers(players);
    }, (err) => {
      logger.error('Error in confirmations listener:', err);
      showErrorRef.current('Erro ao carregar lista de presença');
    });

    return () => {
      unsubscribeGame();
      unsubscribeScore();
      unsubscribeEvents();
      unsubscribeConfirmations();
    };
  }, [gameId]);

  // Extrai o timestamp (number) para estabilizar a dep array do effect:
  // `score?.startedAt` é uma instância de Date nova a cada snapshot, recriando
  // o interval e gerando thrash. `getTime()` retorna number primitivo estável.
  const startedAtMs = score?.startedAt?.getTime();
  useEffect(() => {
    if (isRunning && startedAtMs) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startedAtMs) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, startedAtMs]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleAddEvent = async () => {
    if (!selectedPlayer || !gameId) return;
    if (!canManage) {
      showError('Apenas o organizador pode adicionar eventos');
      return;
    }

    try {
      const player = confirmedPlayers.find((p) => p.id === selectedPlayer);
      await addDoc(collection(db, 'game_events'), {
        game_id: gameId,
        event_type: selectedEventType,
        player_id: selectedPlayer,
        player_name: player?.name || 'Jogador',
        minute: Math.floor(elapsedTime / 60),
        created_by: uid,
        created_at: serverTimestamp(),
      });
      setAddEventDialog(false);
      setSelectedPlayer('');
    } catch (err) {
      logger.error('Error adding event:', err);
      showError(getFirestoreErrorMessage(err, 'Erro ao adicionar evento'));
    }
  };

  const handleFinishGame = async () => {
    if (!gameId || !game) return;
    if (!canManage) {
      showError('Apenas o organizador pode finalizar o jogo');
      return;
    }

    try {
      await updateDoc(doc(db, 'games', gameId), {
        status: 'FINISHED',
        team1_score: score?.team1Score || 0,
        team2_score: score?.team2Score || 0,
        updated_at: serverTimestamp(),
      });
      navigate(`/game/${gameId}/vote`);
    } catch (err) {
      logger.error('Error finishing game:', err);
      showError(getFirestoreErrorMessage(err, 'Erro ao finalizar jogo'));
    }
  };

  const handleStartGame = async () => {
    if (!gameId) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'games', gameId), {
        status: 'LIVE',
        updated_at: serverTimestamp(),
      });
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth={isDesktop ? 'md' : 'sm'} sx={{ py: 4, textAlign: 'center' }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" />
      </Container>
    );
  }

  if (error || !game) {
    return (
      <Container maxWidth={isDesktop ? 'md' : 'sm'} sx={{ py: 4 }}>
        <Alert severity="error">{error || t('games.notFound')}</Alert>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            {t('common.back')}
          </Button>
          {error && (
            <Button variant="contained" onClick={() => queryClient.invalidateQueries()}>
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
          <IconButton onClick={navigateBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, ml: 1 }}>
            {t('games.liveTitle')}
          </Typography>
          <Chip
            icon={<TimerIcon />}
            label={formatTime(elapsedTime)}
            color="error"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>

      <Container maxWidth={isDesktop ? 'md' : 'sm'} sx={{ py: 2 }}>
        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <CardContent>
            {/* Placar com cores distintas por time + destaque no líder (#1363) */}
            {(() => {
              const s1 = score?.team1Score || 0;
              const s2 = score?.team2Score || 0;
              const leader: 1 | 2 | 0 = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h5" fontWeight={600} color="text.secondary">
                      {game.team1Name || t('games.teamA')}
                    </Typography>
                    <Typography
                      variant="h2"
                      fontWeight={leader === 1 ? 800 : 600}
                      sx={{
                        color: 'primary.main',
                        opacity: leader === 2 ? 0.6 : 1,
                        transition: 'opacity 0.2s, font-weight 0.2s',
                      }}
                    >
                      {s1}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="text.secondary">
                    vs
                  </Typography>
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h5" fontWeight={600} color="text.secondary">
                      {game.team2Name || t('games.teamB')}
                    </Typography>
                    <Typography
                      variant="h2"
                      fontWeight={leader === 2 ? 800 : 600}
                      sx={{
                        color: 'secondary.main',
                        opacity: leader === 1 ? 0.6 : 1,
                        transition: 'opacity 0.2s, font-weight 0.2s',
                      }}
                    >
                      {s2}
                    </Typography>
                  </Box>
                </Box>
              );
            })()}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Eventos do Jogo
            </Typography>

            {events.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                Nenhum evento registrado
              </Typography>
            ) : (
              <List disablePadding aria-label="Eventos do jogo">
                {events.map((event, index) => (
                  <React.Fragment key={event.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor:
                              event.eventType === 'GOAL'
                                ? 'success.main'
                                : event.eventType === 'YELLOW_CARD'
                                ? 'warning.main'
                                : event.eventType === 'RED_CARD'
                                ? 'error.main'
                                : 'primary.main',
                          }}
                        >
                          {/* Ícones vetoriais por tipo de evento — fix #762 */}
                          {event.eventType === 'GOAL' && <SoccerIcon aria-label="Gol" />}
                          {/* warning.light sobre warning.main = ~1.7:1 no dark; warning.main isolado mantém amarelo legível */}
                          {event.eventType === 'YELLOW_CARD' && <YellowCardIcon aria-label="Cartão Amarelo" sx={{ color: 'warning.main' }} />}
                          {event.eventType === 'RED_CARD' && <RedCardIcon aria-label="Cartão Vermelho" />}
                          {event.eventType === 'ASSIST' && <AssistIcon aria-label="Assistência" />}
                          {event.eventType === 'SAVE' && <SaveIcon aria-label="Defesa" />}
                          {event.eventType === 'SUBSTITUTION' && <SubstitutionIcon aria-label="Substituição" />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={event.playerName}
                        secondary={`${
                          { GOAL: 'Gol', ASSIST: 'Assistência', SAVE: 'Defesa', YELLOW_CARD: 'Cartão Amarelo', RED_CARD: 'Cartão Vermelho', SUBSTITUTION: 'Substituição' }[event.eventType] || event.eventType
                        } - ${event.minute}'`}
                      />
                    </ListItem>
                    {index < events.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Container>

      {canManage && (
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
          <Container maxWidth={isDesktop ? 'md' : 'sm'}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isRunning ? (
                <>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddEventDialog(true)} fullWidth>
                    Adicionar Evento
                  </Button>
                  <Button variant="contained" color="error" startIcon={<StopIcon />} onClick={handleFinishGame} fullWidth>
                    Finalizar Jogo
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={actionLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                  onClick={handleStartGame}
                  disabled={actionLoading}
                  fullWidth
                >
                  {actionLoading ? 'Iniciando...' : 'Iniciar Jogo'}
                </Button>
              )}
            </Box>
          </Container>
        </Box>
      )}

      <Dialog open={addEventDialog} onClose={() => setAddEventDialog(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="add-event-dialog-title">
        <DialogTitle id="add-event-dialog-title">Adicionar Evento</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Tipo de Evento"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value as GameEventType)}
              fullWidth
            >
              {[
                { value: 'GOAL', label: 'Gol' },
                { value: 'ASSIST', label: 'Assistência' },
                { value: 'SAVE', label: 'Defesa' },
                { value: 'YELLOW_CARD', label: 'Cartão Amarelo' },
                { value: 'RED_CARD', label: 'Cartão Vermelho' },
              ].map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Jogador"
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              fullWidth
              required
            >
              {confirmedPlayers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEventDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddEvent} disabled={actionLoading}>Adicionar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
