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
  VolumeUp as SoundOnIcon,
  VolumeOff as SoundOffIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { doc, collection, query, where, onSnapshot, updateDoc, addDoc, setDoc, getDocs, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { Game, GameEvent, GameEventType } from '../../types/game';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/GameCard';
import { FixedBottomBar } from '../../components/layout';

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

function getStreamEmbedUrl(streamUrl: string): string | null {
  try {
    const url = new URL(streamUrl);
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.hostname.includes('youtu.be')
        ? url.pathname.slice(1)
        : url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    if (url.hostname.includes('twitch.tv')) {
      const channel = url.pathname.split('/').filter(Boolean)[0];
      if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
    }
  } catch {
    return null;
  }
  return null;
}

function getEventTypeLabel(t: ReturnType<typeof useTranslation>['t'], eventType: string): string {
  return t(`games.events.${eventType.toLowerCase()}`, { defaultValue: eventType });
}

export const LiveGameScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('games.liveTitle'));
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigateBack = useNavigateBack('/?tab=1');
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
  const [showStream, setShowStream] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canManage = canManageGame(game, uid);

  const [actionLoading, setActionLoading] = useState(false);
  const [scoreUpdating, setScoreUpdating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('live_sound_enabled');
      return stored !== 'false';
    } catch (error) {
      console.warn('Failed to read sound setting from localStorage:', error);
      return true;
    }
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevEventCountRef = useRef(0);

  useEffect(() => {
    // #2229: sem gameId não há o que carregar — encerra o loading e sinaliza
    // erro em vez de deixar o spinner girando indefinidamente.
    if (!gameId) {
      setError(t('games.notFound'));
      setLoading(false);
      return;
    }

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
      showErrorRef.current(t('games.live.errorLoadScore'));
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
      showErrorRef.current(t('games.live.errorLoadEvents'));
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
      showErrorRef.current(t('games.live.errorLoadPresence'));
    });

    return () => {
      unsubscribeGame();
      unsubscribeScore();
      unsubscribeEvents();
      unsubscribeConfirmations();
    };
  }, [gameId, t]);

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

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch {
      /* Web Audio API not available */
    }
  }, [soundEnabled]);

  const triggerFeedback = useCallback((eventType: string) => {
    if (eventType === 'GOAL') {
      if (navigator.vibrate) navigator.vibrate(100);
      playTone(880, 300, 'sine');
    } else if (eventType === 'YELLOW_CARD' || eventType === 'RED_CARD') {
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      playTone(1200, 150, 'square');
    }
  }, [playTone]);

  useEffect(() => {
    if (events.length > prevEventCountRef.current && prevEventCountRef.current > 0) {
      const newEvents = events.slice(0, events.length - prevEventCountRef.current);
      newEvents.forEach((event) => triggerFeedback(event.eventType));
    }
    prevEventCountRef.current = events.length;
  }, [events, triggerFeedback]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('live_sound_enabled', String(next));
      } catch (error) {
        console.warn('Failed to save sound setting to localStorage:', error);
      }
      return next;
    });
  }, []);

  const handleAddEvent = async () => {
    if (!selectedPlayer || !gameId) return;
    if (!canManage) {
      showError(t('games.live.onlyOrganizerAddEvents'));
      return;
    }

    try {
      const player = confirmedPlayers.find((p) => p.id === selectedPlayer);
      await addDoc(collection(db, 'game_events'), {
        game_id: gameId,
        event_type: selectedEventType,
        player_id: selectedPlayer,
        player_name: player?.name || t('profile.defaultPlayerName'),
        minute: Math.floor(elapsedTime / 60),
        created_by: uid,
        created_at: serverTimestamp(),
      });
      setAddEventDialog(false);
      setSelectedPlayer('');
    } catch (err) {
      logger.error('Error adding event:', err);
      showError(getFirestoreErrorMessage(err, t('games.live.errorAddEvent')));
    }
  };

  // #1539: abre diálogo de confirmação antes de finalizar
  const handleFinishGameClick = () => {
    if (!canManage) {
      showError(t('games.live.onlyOrganizerFinish'));
      return;
    }
    setConfirmFinishOpen(true);
  };

  // #1537: finaliza o jogo com loading state via try/finally
  const handleFinishGame = async () => {
    if (!gameId || !game) return;
    setConfirmFinishOpen(false);
    setFinishing(true);
    try {
      // #1530 (Opção A): Antes de finalizar, agregar game_events por jogador
      // e escrever nas confirmações individuais (goals/assists/saves).
      // Isso garante que as estatísticas do jogo fiquem sincronizadas antes
      // do Cloud Function de XP processar o jogo finalizado.
      const eventsSnap = await getDocs(
        query(collection(db, 'game_events'), where('game_id', '==', gameId))
      );

      // Agrega contagens por jogador
      const aggregated = new Map<string, { goals: number; assists: number; saves: number }>();
      for (const eventDoc of eventsSnap.docs) {
        const raw = eventDoc.data();
        const playerId: string = raw.player_id ?? raw.playerId ?? '';
        if (!playerId) continue;
        const type: string = raw.event_type ?? raw.eventType ?? '';
        const current = aggregated.get(playerId) ?? { goals: 0, assists: 0, saves: 0 };
        if (type === 'GOAL') current.goals += 1;
        else if (type === 'ASSIST') current.assists += 1;
        else if (type === 'SAVE') current.saves += 1;
        aggregated.set(playerId, current);
      }

      // #2291: escreve todas as confirmações em um único writeBatch atômico,
      // evitando o estado inconsistente que Promise.allSettled permitia (parte
      // dos jogadores atualizados, parte não). Contagem de jogadores << 500.
      if (aggregated.size > 0) {
        try {
          const statsBatch = writeBatch(db);
          for (const [playerId, stats] of aggregated.entries()) {
            const confirmRef = doc(db, 'confirmations', `${gameId}_${playerId}`);
            statsBatch.set(confirmRef, stats, { merge: true });
          }
          await statsBatch.commit();
        } catch (statsErr) {
          // Não bloquear o finish — o CF pode re-agregar via game_events se necessário,
          // mas avisamos o usuário de forma não-bloqueante (#2291).
          logger.error('Falha ao sincronizar stats de jogadores:', statsErr);
          showError(t('games.live.statsDelayWarning'));
        }
      }

      // Finaliza o jogo — o score já está populado via listener live_scores
      await updateDoc(doc(db, 'games', gameId), {
        status: 'FINISHED',
        team1_score: score?.team1Score || 0,
        team2_score: score?.team2Score || 0,
        updated_at: serverTimestamp(),
      });
      navigate(`/game/${gameId}/vote`);
    } catch (err) {
      logger.error('Error finishing game:', err);
      showError(getFirestoreErrorMessage(err, t('games.live.errorFinish')));
    } finally {
      setFinishing(false);
    }
  };

  // #1529: guard de status — só inicia se o jogo estiver em CONFIRMED
  const handleStartGame = async () => {
    if (!gameId) return;
    if (game?.status !== 'CONFIRMED') {
      showError(t('games.live.mustBeConfirmedToStart'));
      return;
    }
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

  // #1528: Incrementa ou decrementa o placar de um time no live_scores.
  // Usa setDoc com merge para criar o documento caso ainda não exista.
  const handleScoreUpdate = async (team: 1 | 2, delta: 1 | -1) => {
    if (!gameId || !canManage) return;
    setScoreUpdating(true);
    try {
      const scoreRef = doc(db, 'live_scores', gameId);
      const field = team === 1 ? 'team1_score' : 'team2_score';
      await setDoc(scoreRef, { [field]: increment(delta), updated_at: serverTimestamp() }, { merge: true });
    } catch (err) {
      logger.error('Erro ao atualizar placar:', err);
      showError(getFirestoreErrorMessage(err, t('games.live.errorUpdateScore')));
    } finally {
      setScoreUpdating(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth={isDesktop ? 'md' : 'sm'} sx={{ py: 4 }}>
        <LoadingState shimmerCount={3} itemType="CARD" />
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
              {t('common.retry')}
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
          bgcolor: 'background.paper', // #2273: token canônico de sticky header
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
          <IconButton onClick={toggleSound} aria-label={soundEnabled ? t('games.live.disableSounds') : t('games.live.enableSounds')}>
            {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
          </IconButton>
          <Chip
            icon={<TimerIcon />}
            label={formatTime(elapsedTime)}
            color="error"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>

      <Container maxWidth={isDesktop ? 'md' : 'sm'} sx={{ py: 2 }}>
        <Card
          sx={{
            mb: 2,
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.14)} 100%)`,
          }}
        >
          <CardContent>
            {/* Scorecard ao vivo com linguagem de placar esportivo. */}
            {(() => {
              const s1 = score?.team1Score || 0;
              const s2 = score?.team2Score || 0;
              const leader: 1 | 2 | 0 = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;
              return (
                <Box sx={{ textAlign: 'center' }}>
                  <Chip
                    size="small"
                    color="error"
                    label={t('games.statusLive')}
                    sx={{ fontWeight: 800, letterSpacing: 0.8, mb: 1.5 }}
                  />
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: { xs: 1.5, sm: 3 } }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="text.secondary" noWrap>
                        {game.team1Name || t('games.teamA')}
                      </Typography>
                      <Typography
                        key={`team-1-${s1}`}
                        variant="h1"
                        fontWeight={leader === 1 ? 800 : 600}
                        sx={{
                          color: 'primary.main',
                          opacity: leader === 2 ? 0.6 : 1,
                          lineHeight: 1,
                          animation: 'scoreFlash 280ms ease-out',
                          '@keyframes scoreFlash': {
                            '0%': { transform: 'scale(1.12)' },
                            '100%': { transform: 'scale(1)' },
                          },
                          transition: (t) => t.transitions.create(['opacity', 'font-weight'], { duration: t.transitions.duration.shorter }),
                        }}
                      >
                        {s1}
                      </Typography>
                    </Box>
                    <Typography variant="h2" color="text.secondary" fontWeight={300} sx={{ px: 1 }}>
                      –
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="text.secondary" noWrap>
                        {game.team2Name || t('games.teamB')}
                      </Typography>
                      <Typography
                        key={`team-2-${s2}`}
                        variant="h1"
                        fontWeight={leader === 2 ? 800 : 600}
                        sx={{
                          color: 'secondary.main',
                          opacity: leader === 1 ? 0.6 : 1,
                          lineHeight: 1,
                          animation: 'scoreFlash 280ms ease-out',
                          transition: (t) => t.transitions.create(['opacity', 'font-weight'], { duration: t.transitions.duration.shorter }),
                        }}
                      >
                        {s2}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })()}

            {/* #1528: Controles de placar — visíveis apenas para o organizador */}
            {canManage && isRunning && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5, flex: 1, justifyContent: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleScoreUpdate(1, -1)}
                    disabled={scoreUpdating || (score?.team1Score ?? 0) <= 0}
                    aria-label={t('games.live.decreaseScore', { team: game.team1Name || t('games.teamA') })}
                  >
                    −
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleScoreUpdate(1, 1)}
                    disabled={scoreUpdating}
                    aria-label={t('games.live.increaseScore', { team: game.team1Name || t('games.teamA') })}
                  >
                    +
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flex: 1, justifyContent: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleScoreUpdate(2, -1)}
                    disabled={scoreUpdating || (score?.team2Score ?? 0) <= 0}
                    aria-label={t('games.live.decreaseScore', { team: game.team2Name || t('games.teamB') })}
                  >
                    −
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleScoreUpdate(2, 1)}
                    disabled={scoreUpdating}
                    aria-label={t('games.live.increaseScore', { team: game.team2Name || t('games.teamB') })}
                  >
                    +
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {t('games.live.gameEvents')}
            </Typography>

            {events.length === 0 ? (
              <EmptyState
                icon={<HistoryIcon />}
                title={t('games.live.noEvents')}
                description={t('games.live.noEventsDesc')}
              />
            ) : (
              <List disablePadding aria-label={t('games.live.gameEvents')}>
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
                          {event.eventType === 'GOAL' && <SoccerIcon aria-label={t('games.events.goal')} />}
                          {/* warning.light sobre warning.main = ~1.7:1 no dark; warning.main isolado mantém amarelo legível */}
                          {event.eventType === 'YELLOW_CARD' && <YellowCardIcon aria-label={t('games.events.yellow_card')} sx={{ color: 'warning.main' }} />}
                          {event.eventType === 'RED_CARD' && <RedCardIcon aria-label={t('games.events.red_card')} />}
                          {event.eventType === 'ASSIST' && <AssistIcon aria-label={t('games.events.assist')} />}
                          {event.eventType === 'SAVE' && <SaveIcon aria-label={t('games.events.save')} />}
                          {event.eventType === 'SUBSTITUTION' && <SubstitutionIcon aria-label={t('games.events.substitution')} />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={event.playerName}
                        secondary={`${getEventTypeLabel(t, event.eventType)} - ${event.minute}'`}
                      />
                    </ListItem>
                    {index < events.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {game.streamUrl && (() => {
          const embedUrl = getStreamEmbedUrl(game.streamUrl);
          return embedUrl ? (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('games.live.liveStream')}
                  </Typography>
                  <Button size="small" onClick={() => setShowStream(!showStream)} sx={{ minHeight: 44 }}>
                    {showStream ? t('games.live.hide') : t('games.live.show')}
                  </Button>
                </Box>
                {showStream && (
                  <Box sx={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                    <iframe
                      src={embedUrl}
                      title={t('games.live.liveStream')}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: `${theme.shape.borderRadius / 1.5}px`,
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          ) : null;
        })()}
      </Container>

      {/* #2178: FixedBottomBar. #2164: tela full-screen (fora do AppLayout),
          centraliza no viewport — sem offset de sidebar. */}
      {canManage && (
        <FixedBottomBar inLayout={false}>
          <Container maxWidth={isDesktop ? 'md' : 'sm'}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isRunning ? (
                <>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddEventDialog(true)} fullWidth>
                    {t('games.live.addEvent')}
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={finishing ? <CircularProgress size={20} color="inherit" /> : <StopIcon />}
                    onClick={handleFinishGameClick}
                    disabled={finishing}
                    fullWidth
                  >
                    {finishing ? t('games.live.finishing') : t('games.live.finishGame')}
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
                  {actionLoading ? t('games.live.starting') : t('games.live.startGame')}
                </Button>
              )}
            </Box>
          </Container>
        </FixedBottomBar>
      )}

      {/* #1539: Diálogo de confirmação para finalizar jogo */}
      <Dialog open={confirmFinishOpen} onClose={() => setConfirmFinishOpen(false)} maxWidth="xs" fullWidth aria-labelledby="confirm-finish-dialog-title">
        <DialogTitle id="confirm-finish-dialog-title">{t('games.live.finishGame')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('games.live.finishConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFinishOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleFinishGame}>
            {t('games.live.finish')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addEventDialog} onClose={() => setAddEventDialog(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="add-event-dialog-title">
        <DialogTitle id="add-event-dialog-title">{t('games.live.addEvent')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label={t('games.live.eventType')}
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value as GameEventType)}
              fullWidth
            >
              {[
                { value: 'GOAL', label: t('games.events.goal') },
                { value: 'ASSIST', label: t('games.events.assist') },
                { value: 'SAVE', label: t('games.events.save') },
                { value: 'YELLOW_CARD', label: t('games.events.yellow_card') },
                { value: 'RED_CARD', label: t('games.events.red_card') },
              ].map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('games.players')}
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              fullWidth
              required
              error={!selectedPlayer && actionLoading}
              helperText={!selectedPlayer && actionLoading ? t('validation.selectRequired') : ' '}
            >
              {confirmedPlayers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEventDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddEvent} disabled={actionLoading || !selectedPlayer} startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}>{t('games.live.add')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
