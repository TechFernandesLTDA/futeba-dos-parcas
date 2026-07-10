import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
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
  ArrowBack as BackIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PageContainer } from '../../components/common/PageContainer';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  deleteLiveGameEvent,
  finishGameLifecycle,
  startGameLifecycle,
  submitLiveGameEvent,
} from '../../services/cloudFunctions';
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
  teamId?: string;
}

function canManageGame(game: Game | null, uid?: string, isAdmin = false): boolean {
  if (!game || !uid) return false;
  if (isAdmin) return true;
  if (game.ownerId === uid) return true;
  if (game.coOrganizers?.includes(uid)) return true;
  return false;
}

function createEventRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

const STREAM_SOURCE_PROTOCOLS = new Set(['http:', 'https:']);
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const TWITCH_HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv']);
const YOUTUBE_PATH_PREFIXES = new Set(['embed', 'live', 'shorts']);
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
const TWITCH_CHANNEL = /^[A-Za-z0-9_]{3,25}$/;

function getYouTubeVideoId(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  let candidate: string | null | undefined;

  if (YOUTUBE_SHORT_HOSTS.has(url.hostname)) {
    candidate = segments[0];
  } else {
    candidate = url.searchParams.get('v');
    if (!candidate && YOUTUBE_PATH_PREFIXES.has(segments[0])) {
      candidate = segments[1];
    }
  }

  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
}

// Exportado apenas para os testes de segurança do parser.
// eslint-disable-next-line react-refresh/only-export-components
export function getStreamEmbedUrl(
  streamUrl: string,
  parentHostname = window.location.hostname,
): string | null {
  try {
    const url = new URL(streamUrl);
    if (
      !STREAM_SOURCE_PROTOCOLS.has(url.protocol)
      || url.username
      || url.password
      || url.port
    ) {
      return null;
    }

    if (YOUTUBE_HOSTS.has(url.hostname) || YOUTUBE_SHORT_HOSTS.has(url.hostname)) {
      const videoId = getYouTubeVideoId(url);
      if (!videoId) return null;

      const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
      embedUrl.searchParams.set('autoplay', '1');
      return embedUrl.toString();
    }

    if (TWITCH_HOSTS.has(url.hostname)) {
      const channel = url.pathname.split('/').filter(Boolean)[0];
      if (!channel || !TWITCH_CHANNEL.test(channel) || !parentHostname.trim()) return null;

      const embedUrl = new URL('https://player.twitch.tv/');
      embedUrl.searchParams.set('channel', channel);
      embedUrl.searchParams.set('parent', parentHostname.trim().toLowerCase());
      return embedUrl.toString();
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
  const navigateBack = useNavigateBack('/?tab=1');
  const { currentUser, user } = useAuth();
  const { showError } = useToast();
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
  const [selectedAssist, setSelectedAssist] = useState('');
  const [showStream, setShowStream] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isAdmin = user?.role === 'ADMIN';
  const canManage = canManageGame(game, uid, isAdmin);
  const isConfirmedPlayer = Boolean(uid && confirmedPlayers.some((player) => player.id === uid));
  const canSubmitEvents = canManage || isConfirmedPlayer;

  const [actionLoading, setActionLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<GameEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [listenerRetryKey, setListenerRetryKey] = useState(0);
  const [listenerErrors, setListenerErrors] = useState<Record<string, string>>({});
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
  const eventRequestIdRef = useRef<string | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const hydratedEventsGameIdRef = useRef<string | null>(null);

  const setListenerError = useCallback((stream: string, message?: string) => {
    setListenerErrors((current) => {
      if (!message) {
        if (!(stream in current)) return current;
        const next = { ...current };
        delete next[stream];
        return next;
      }
      return { ...current, [stream]: message };
    });
  }, []);

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
          setError(null);
        } else {
          setGame(null);
          setError(t('games.notFound'));
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
      } else {
        setScore(null);
      }
      setListenerError('score');
    }, (err) => {
      logger.error('Error in score listener:', err);
      const message = t('games.live.errorLoadScore');
      setListenerError('score', message);
      showErrorRef.current(message);
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
      setEvents([...eventsData].sort((a, b) => {
        const minuteDiff = (b.minute ?? 0) - (a.minute ?? 0);
        if (minuteDiff !== 0) return minuteDiff;
        const createdAtDiff = (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
        return createdAtDiff !== 0 ? createdAtDiff : a.id.localeCompare(b.id);
      }));
      setListenerError('events');
    }, (err) => {
      logger.error('Error in events listener:', err);
      const message = t('games.live.errorLoadEvents');
      setListenerError('events', message);
      showErrorRef.current(message);
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
            teamId: raw.team_id || undefined,
          };
        });
      setConfirmedPlayers(players);
      setListenerError('confirmations');
    }, (err) => {
      logger.error('Error in confirmations listener:', err);
      const message = t('games.live.errorLoadPresence');
      setListenerError('confirmations', message);
      showErrorRef.current(message);
    });

    return () => {
      unsubscribeGame();
      unsubscribeScore();
      unsubscribeEvents();
      unsubscribeConfirmations();
    };
  }, [gameId, listenerRetryKey, setListenerError, t]);

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
    const currentIds = new Set(events.map((event) => event.id));
    if (hydratedEventsGameIdRef.current !== gameId) {
      hydratedEventsGameIdRef.current = gameId ?? null;
      seenEventIdsRef.current = currentIds;
      return;
    }

    events
      .filter((event) => !seenEventIdsRef.current.has(event.id))
      .forEach((event) => triggerFeedback(event.eventType));
    seenEventIdsRef.current = currentIds;
  }, [events, gameId, triggerFeedback]);

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

  const openAddEventDialog = () => {
    eventRequestIdRef.current = createEventRequestId();
    setSelectedAssist('');
    setAddEventDialog(true);
  };

  const closeAddEventDialog = () => {
    if (actionLoading) return;
    eventRequestIdRef.current = null;
    setSelectedAssist('');
    setAddEventDialog(false);
  };

  const retryLiveListeners = () => {
    setError(null);
    setListenerErrors({});
    setLoading(true);
    setListenerRetryKey((current) => current + 1);
  };

  const handleAddEvent = async () => {
    if (!selectedPlayer || !gameId) return;
    if (!canSubmitEvents) {
      showError(t('games.live.onlyOrganizerAddEvents'));
      return;
    }

    setActionLoading(true);
    try {
      const player = confirmedPlayers.find((p) => p.id === selectedPlayer);
      if (!player?.teamId) {
        showError('Selecione um jogador confirmado com time definido para registrar o evento.');
        return;
      }

      const assistant = selectedEventType === 'GOAL' && selectedAssist
        ? confirmedPlayers.find((candidate) => candidate.id === selectedAssist)
        : undefined;
      if (assistant && (assistant.id === player.id || assistant.teamId !== player.teamId)) {
        showError(t('games.live.invalidAssist', { defaultValue: 'A assistência deve ser de outro jogador do mesmo time.' }));
        return;
      }

      await submitLiveGameEvent({
        gameId,
        requestId: eventRequestIdRef.current ?? createEventRequestId(),
        eventType: selectedEventType as 'GOAL' | 'SAVE' | 'YELLOW_CARD' | 'RED_CARD',
        playerId: selectedPlayer,
        playerName: player.name || t('profile.defaultPlayerName'),
        teamId: player.teamId,
        minute: Math.floor(elapsedTime / 60),
        assistedById: assistant?.id ?? null,
        assistedByName: assistant?.name ?? null,
      });
      eventRequestIdRef.current = null;
      setAddEventDialog(false);
      setSelectedPlayer('');
      setSelectedAssist('');
    } catch (err) {
      logger.error('Error adding event:', err);
      showError(getFirestoreErrorMessage(err, t('games.live.errorAddEvent')));
    } finally {
      setActionLoading(false);
    }
  };

  const canDeleteEvent = (event: GameEvent) => (
    canManage || Boolean(uid && isConfirmedPlayer && event.createdBy === uid)
  );

  const handleDeleteEvent = async () => {
    if (!gameId || !eventToDelete || !canDeleteEvent(eventToDelete)) return;
    setDeletingEventId(eventToDelete.id);
    try {
      await deleteLiveGameEvent({ gameId, eventId: eventToDelete.id });
      setEventToDelete(null);
    } catch (err) {
      logger.error('Error deleting live event:', err);
      showError(getFirestoreErrorMessage(err, t('games.live.errorDeleteEvent', {
        defaultValue: 'Não foi possível remover o evento.',
      })));
    } finally {
      setDeletingEventId(null);
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
      await finishGameLifecycle({ gameId });
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
      await startGameLifecycle({ gameId });
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="detail">
        <LoadingState shimmerCount={3} itemType="CARD" />
      </PageContainer>
    );
  }

  if (error || !game) {
    return (
      <PageContainer maxWidth="detail">
        <Alert severity="error">{error || t('games.notFound')}</Alert>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            {t('common.back')}
          </Button>
          {error && (
            <Button variant="contained" onClick={retryLiveListeners}>
              {t('common.retry')}
            </Button>
          )}
        </Box>
      </PageContainer>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Cabeçalho padronizado — som e timer passados via prop `actions` */}
      <ScreenHeader
        title={t('games.liveTitle')}
        onBack={navigateBack}
        backAriaLabel={t('common.back')}
        actions={
          <>
            <IconButton
              onClick={toggleSound}
              aria-label={soundEnabled ? t('games.live.disableSounds') : t('games.live.enableSounds')}
            >
              {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
            </IconButton>
            <Chip
              icon={<TimerIcon />}
              label={formatTime(elapsedTime)}
              color="error"
              sx={{ fontWeight: 700 }}
            />
          </>
        }
      />

      <PageContainer maxWidth="detail">
        {Object.keys(listenerErrors).length > 0 && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={(
              <Button color="inherit" size="small" onClick={retryLiveListeners}>
                {t('common.retry')}
              </Button>
            )}
          >
            {Object.values(listenerErrors)[0]}
          </Alert>
        )}
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

            {/* O placar segue apenas eventos validados no servidor. */}
            {canManage && isRunning && (
              <Alert severity="info" sx={{ mt: 2 }}>
                O placar ao vivo segue apenas eventos validados no servidor. Para ajustar o resultado, registre ou reverta eventos oficiais do jogo.
              </Alert>
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
                    <ListItem
                      secondaryAction={canDeleteEvent(event) ? (
                        <IconButton
                          edge="end"
                          aria-label={t('games.live.deleteEvent', { defaultValue: 'Remover evento' })}
                          onClick={() => setEventToDelete(event)}
                          disabled={deletingEventId === event.id}
                        >
                          {deletingEventId === event.id
                            ? <CircularProgress size={20} />
                            : <DeleteIcon />}
                        </IconButton>
                      ) : undefined}
                    >
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
                        secondary={event.assistedByName
                          ? `${getEventTypeLabel(t, event.eventType)} · ${t('games.events.assist')}: ${event.assistedByName} · ${event.minute}'`
                          : `${getEventTypeLabel(t, event.eventType)} · ${event.minute}'`}
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
      </PageContainer>

      {/* #2178: FixedBottomBar. #2164: tela full-screen (fora do AppLayout),
          centraliza no viewport — sem offset de sidebar. */}
      {((isRunning && (canSubmitEvents || canManage)) || (game.status === 'CONFIRMED' && canManage)) && (
        <FixedBottomBar inLayout={false}>
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isRunning ? (
                <>
                  {canSubmitEvents && (
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddEventDialog} fullWidth>
                      {t('games.live.addEvent')}
                    </Button>
                  )}
                  {canManage && (
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
                  )}
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
          </Box>
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

      <Dialog open={addEventDialog} onClose={closeAddEventDialog} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="add-event-dialog-title">
        <DialogTitle id="add-event-dialog-title">{t('games.live.addEvent')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label={t('games.live.eventType')}
              value={selectedEventType}
              onChange={(e) => {
                setSelectedEventType(e.target.value as GameEventType);
                setSelectedAssist('');
              }}
              fullWidth
            >
              {[
                { value: 'GOAL', label: t('games.events.goal') },
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
              onChange={(e) => {
                setSelectedPlayer(e.target.value);
                setSelectedAssist('');
              }}
              fullWidth
              required
              error={!selectedPlayer && actionLoading}
              helperText={!selectedPlayer && actionLoading ? t('validation.selectRequired') : ' '}
            >
              {confirmedPlayers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
            {selectedEventType === 'GOAL' && selectedPlayer && (
              <TextField
                select
                label={t('games.live.assistedBy', { defaultValue: 'Assistência (opcional)' })}
                value={selectedAssist}
                onChange={(event) => setSelectedAssist(event.target.value)}
                fullWidth
                helperText={t('games.live.assistedByHint', {
                  defaultValue: 'Selecione outro jogador do mesmo time.',
                })}
              >
                <MenuItem value="">{t('games.live.noAssist', { defaultValue: 'Sem assistência' })}</MenuItem>
                {confirmedPlayers
                  .filter((candidate) => {
                    const scorer = confirmedPlayers.find((player) => player.id === selectedPlayer);
                    return candidate.id !== selectedPlayer && Boolean(scorer?.teamId) && candidate.teamId === scorer?.teamId;
                  })
                  .map((candidate) => (
                    <MenuItem key={candidate.id} value={candidate.id}>{candidate.name}</MenuItem>
                  ))}
              </TextField>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddEventDialog} disabled={actionLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddEvent} disabled={actionLoading || !selectedPlayer} startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}>{t('games.live.add')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(eventToDelete)}
        onClose={() => !deletingEventId && setEventToDelete(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="delete-live-event-dialog-title"
      >
        <DialogTitle id="delete-live-event-dialog-title">
          {t('games.live.deleteEvent', { defaultValue: 'Remover evento' })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('games.live.deleteEventConfirm', {
              defaultValue: 'Deseja remover este evento? Placar e estatísticas serão recalculados.',
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventToDelete(null)} disabled={Boolean(deletingEventId)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteEvent}
            disabled={Boolean(deletingEventId)}
            startIcon={deletingEventId ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
