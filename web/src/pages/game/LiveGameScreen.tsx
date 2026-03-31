import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  useTheme,
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
} from '@mui/icons-material';
import { doc, collection, query, where, onSnapshot, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Game, GameEvent, LiveGameScore, GameEventType } from '../../types/game';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LiveGameScreen');

export const LiveGameScreen: React.FC = () => {
  useDocumentTitle('Jogo ao Vivo');
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();

  const [game, setGame] = useState<Game | null>(null);
  const [score, setScore] = useState<LiveGameScore | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [addEventDialog, setAddEventDialog] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<GameEventType>('GOAL');
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const gameRef = doc(db, 'games', gameId);
    const scoreRef = doc(db, 'live_scores', gameId);
    const eventsRef = query(collection(db, 'game_events'), where('game_id', '==', gameId));

    const unsubscribeGame = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const raw = doc.data();
        const data = snakeToCamel(raw);
        setGame({ id: doc.id, ...data } as Game);
        setIsRunning(raw.status === 'LIVE');
      }
      setLoading(false);
    });

    const unsubscribeScore = onSnapshot(scoreRef, (doc) => {
      if (doc.exists()) {
        setScore({ ...snakeToCamel<LiveGameScore>(doc.data()), id: doc.id });
      }
    });

    const unsubscribeEvents = onSnapshot(eventsRef, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => {
        const raw = doc.data();
        const data = snakeToCamel(raw);
        return {
          id: doc.id,
          ...data,
          createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
        };
      }) as GameEvent[];
      setEvents(eventsData.sort((a, b) => b.minute - a.minute));
    });

    return () => {
      unsubscribeGame();
      unsubscribeScore();
      unsubscribeEvents();
    };
  }, [gameId]);

  useEffect(() => {
    if (isRunning && score?.startedAt) {
      timerRef.current = setInterval(() => {
        const started = typeof score.startedAt === 'object' && 'toDate' in score.startedAt 
          ? (score.startedAt as any).toDate() 
          : new Date(score.startedAt as any);
        const elapsed = Math.floor((Date.now() - started.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, score?.startedAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddEvent = async () => {
    if (!selectedPlayer || !gameId) return;

    try {
      const eventData = {
        game_id: gameId,
        event_type: selectedEventType,
        player_id: selectedPlayer,
        player_name: 'Jogador',
        team_id: 'team1',
        minute: Math.floor(elapsedTime / 60),
        created_by: currentUser?.uid,
        created_at: Timestamp.now(),
      };

      await addDoc(collection(db, 'game_events'), eventData);
      setAddEventDialog(false);
      setSelectedPlayer('');
    } catch (err) {
      logger.error('Error adding event:', err);
    }
  };

  const handleFinishGame = async () => {
    if (!gameId || !game) return;

    try {
      await updateDoc(doc(db, 'games', gameId), {
        status: 'FINISHED',
        team1_score: score?.team1Score || 0,
        team2_score: score?.team2Score || 0,
        updated_at: Timestamp.now(),
      });
      navigate(`/game/${gameId}/vote`);
    } catch (err) {
      logger.error('Error finishing game:', err);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" />
      </Container>
    );
  }

  if (!game) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">Jogo não encontrado</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Voltar
        </Button>
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, ml: 1 }}>
            Jogo ao Vivo
          </Typography>
          <Chip
            icon={<TimerIcon />}
            label={formatTime(elapsedTime)}
            color="error"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h2" fontWeight={700}>
                  {game.team1Name || 'Time 1'}
                </Typography>
                <Typography variant="h2" fontWeight={700} color="primary">
                  {score?.team1Score || 0}
                </Typography>
              </Box>
              <Typography variant="h4" color="text.secondary">
                X
              </Typography>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h2" fontWeight={700}>
                  {game.team2Name || 'Time 2'}
                </Typography>
                <Typography variant="h2" fontWeight={700} color="primary">
                  {score?.team2Score || 0}
                </Typography>
              </Box>
            </Box>
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
                      <Avatar sx={{ 
                        bgcolor: event.eventType === 'GOAL' ? 'success.main' 
                          : event.eventType === 'YELLOW_CARD' ? 'warning.main'
                          : event.eventType === 'RED_CARD' ? 'error.main'
                          : 'primary.main'
                      }}>
                        {event.eventType === 'GOAL' && <SoccerIcon />}
                        {event.eventType === 'YELLOW_CARD' && <Typography>🟨</Typography>}
                        {event.eventType === 'RED_CARD' && <Typography>🔴</Typography>}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={event.playerName}
                      secondary={`${event.eventType} - ${event.minute}'`}
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

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: `1px solid ${theme.palette.divider}`,
          p: 2,
          zIndex: 10,
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isRunning ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setAddEventDialog(true)}
                  fullWidth
                >
                  Adicionar Evento
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={handleFinishGame}
                  fullWidth
                >
                  Finalizar Jogo
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayIcon />}
                fullWidth
              >
                Iniciar Jogo
              </Button>
            )}
          </Box>
        </Container>
      </Box>

      <Dialog open={addEventDialog} onClose={() => setAddEventDialog(false)} aria-labelledby="add-event-dialog-title">
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
              {['GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SAVE'].map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Jogador"
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              fullWidth
              placeholder="ID do jogador"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEventDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddEvent}>Adicionar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
