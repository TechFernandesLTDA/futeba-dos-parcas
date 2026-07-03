import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  SaveAlt as SaveIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { submitLiveGameEvent } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenFab } from '../../components/layout';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { PageContainer } from '../../components/common/PageContainer';
import { pageSpacing } from '../../theme/pageTokens';
import type { Team } from '../../types/game';

const logger = createLogger('LiveEventsScreen');

interface GameEvent {
  id: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE';
  playerId: string;
  playerName: string;
  playerPhoto?: string;
  teamId?: string;
  minute: number;
  createdAt: Date;
}

interface EventPlayerOption {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
}

// #2276: interface tipada para o doc games (substitui Record<string, any>).
interface RawGameOwner {
  ownerId?: string;
  owner_id?: string;
}

export const LiveEventsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.liveEvents'));
  const navigateBack = useNavigateBack('/?tab=1');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // #2238: dialog responsivo
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventType, setEventType] = useState<'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE'>('GOAL');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [minute, setMinute] = useState('0');
  const [players, setPlayers] = useState<EventPlayerOption[]>([]);
  const [teamsById, setTeamsById] = useState<Record<string, Team>>({});
  const [selectedPlayerTouched, setSelectedPlayerTouched] = useState(false);
  const [minuteTouched, setMinuteTouched] = useState(false); // #2231
  const [submitting, setSubmitting] = useState(false);
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  useEffect(() => {
    if (!gameId || !user) return;
    let cancelled = false; // #2278: evita setState após unmount

    // Verificar se o usuário pode gerenciar eventos (owner do jogo)
    const checkManagePermission = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists() && !cancelled) {
          const gameData = snakeToCamel<RawGameOwner>(gameDoc.data());
          const ownerId = gameData.ownerId || gameData.owner_id;
          setCanManage(user.id === ownerId);
        }
      } catch (err) {
        logger.error('Erro ao verificar permissão de gerenciamento:', err);
        if (!cancelled) showErrorRef.current('Erro ao verificar permissões. Tente novamente.');
      }
    };

    checkManagePermission();
    return () => {
      cancelled = true;
    };
  }, [gameId, user]);

  useEffect(() => {
    if (!gameId) return;

    const eventsRef = collection(db, 'game_events');
    const q = query(eventsRef, where('game_id', '==', gameId), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          const converted = snakeToCamel(raw);
          return {
            id: d.id,
            type: String(converted.eventType ?? converted.type ?? 'GOAL') as GameEvent['type'],
            playerId: String(converted.playerId ?? raw.player_id ?? ''),
            playerName: String(converted.playerName ?? raw.player_name ?? 'Jogador'),
            teamId: typeof (converted.teamId ?? raw.team_id) === 'string' ? String(converted.teamId ?? raw.team_id) : undefined,
            minute: Number(converted.minute ?? raw.minute ?? 0),
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
          } satisfies GameEvent;
        }) as GameEvent[];
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error in live game events listener:', err);
        showErrorRef.current('Erro ao carregar eventos do jogo.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    let currentTeamsById: Record<string, Team> = {};
    let currentConfirmationDocs: Array<{ data: () => Record<string, unknown> }> = [];

    const teamsQuery = query(collection(db, 'teams'), where('game_id', '==', gameId));
    const confirmationsQuery = query(
      collection(db, 'confirmations'),
      where('game_id', '==', gameId),
    );

    const syncPlayers = () => {
      const confirmedPlayers = currentConfirmationDocs
        .filter((confirmationDoc) => confirmationDoc.data().status === 'CONFIRMED')
        .map((confirmationDoc) => {
          const raw = confirmationDoc.data();
          const playerId = String(raw.user_id ?? '');
          const explicitTeamId = typeof raw.team_id === 'string' ? raw.team_id : undefined;
          const inferredTeamId = explicitTeamId ?? Object.values(currentTeamsById).find((team) => team.playerIds.includes(playerId))?.id;
          if (!playerId || !inferredTeamId) return null;
          return {
            id: playerId,
            name: String(raw.user_name ?? 'Jogador'),
            teamId: inferredTeamId,
            teamName: currentTeamsById[inferredTeamId]?.name ?? 'Time',
          } satisfies EventPlayerOption;
        })
        .filter((player): player is EventPlayerOption => player !== null);

      setPlayers(confirmedPlayers);
    };

    const unsubscribeTeams = onSnapshot(
      teamsQuery,
      (snapshot) => {
        const mappedTeams = snapshot.docs.reduce<Record<string, Team>>((acc, teamDoc) => {
          const raw = teamDoc.data();
          const converted = snakeToCamel(raw);
          acc[teamDoc.id] = {
            id: teamDoc.id,
            gameId: String(raw.game_id ?? converted.gameId ?? gameId),
            name: String(raw.name ?? converted.name ?? 'Time'),
            color: String(raw.color ?? converted.color ?? ''),
            playerIds: Array.isArray(raw.player_ids) ? raw.player_ids as string[] : Array.isArray(converted.playerIds) ? converted.playerIds as string[] : [],
            score: Number(raw.score ?? converted.score ?? 0),
          };
          return acc;
        }, {});
        currentTeamsById = mappedTeams;
        setTeamsById(mappedTeams);
        syncPlayers();
      },
      (err) => {
        logger.error('Erro ao carregar times do jogo:', err);
      },
    );

    const unsubscribeConfirmations = onSnapshot(
      confirmationsQuery,
      (snapshot) => {
        currentConfirmationDocs = snapshot.docs;
        syncPlayers();
      },
      (err) => {
        logger.error('Erro ao carregar jogadores confirmados:', err);
      },
    );

    return () => {
      unsubscribeTeams();
      unsubscribeConfirmations();
    };
  }, [gameId]);

  const handleAddEvent = async () => {
    if (!gameId || !user || !selectedPlayerId || !eventType) return;
    setSubmitting(true);
    try {
      const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
      if (!selectedPlayer) {
        showError('Selecione um jogador confirmado para registrar o evento.');
        return;
      }

      await submitLiveGameEvent({
        gameId,
        eventType,
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        teamId: selectedPlayer.teamId,
        minute: parseInt(minute, 10) || 0,
      });
      setDialogOpen(false);
      setSelectedPlayerId('');
      setMinute('0');
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, 'Erro ao adicionar evento'));
    } finally {
      setSubmitting(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'GOAL':
        return <SoccerIcon color="success" />;
      case 'ASSIST':
        return <TrendingIcon color="info" />;
      case 'YELLOW_CARD':
        return <Box sx={{ width: 12, height: 16, bgcolor: 'warning.main', borderRadius: 0.5 }} />;
      case 'RED_CARD':
        return <Box sx={{ width: 12, height: 16, bgcolor: 'error.main', borderRadius: 0.5 }} />;
      case 'SAVE':
        return <SaveIcon color="warning" />;
      default:
        return <PersonIcon />;
    }
  };

  const getEventStyle = (type: string) => {
    switch (type) {
      case 'GOAL':
        return {
          bgcolor: alpha(theme.palette.success.main, 0.12),
          borderColor: alpha(theme.palette.success.main, 0.3),
        };
      case 'ASSIST':
        return {
          bgcolor: alpha(theme.palette.info.main, 0.12),
          borderColor: alpha(theme.palette.info.main, 0.3),
        };
      case 'YELLOW_CARD':
        return {
          bgcolor: alpha(theme.palette.warning.main, 0.12),
          borderColor: alpha(theme.palette.warning.main, 0.3),
        };
      case 'RED_CARD':
        return {
          bgcolor: alpha(theme.palette.error.main, 0.12),
          borderColor: alpha(theme.palette.error.main, 0.3),
        };
      case 'SAVE':
        return {
          bgcolor: alpha(theme.palette.secondary.main, 0.12),
          borderColor: alpha(theme.palette.secondary.main, 0.3),
        };
      default:
        return {
          bgcolor: 'background.paper',
          borderColor: 'divider',
        };
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'GOAL': return 'Gol';
      case 'ASSIST': return 'Assistência';
      case 'YELLOW_CARD': return 'Cartão Amarelo';
      case 'RED_CARD': return 'Cartão Vermelho';
      case 'SAVE': return 'Defesa';
      default: return type;
    }
  };

  return (
    <Box sx={{ pb: 8 }}>
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
          <IconButton onClick={navigateBack} aria-label={t('a11y.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('games.live.gameEvents')}
          </Typography>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              Adicionar Evento
            </Button>
          )}
        </Box>
      </Box>

      <PageContainer maxWidth="list">
        {loading ? (
          <LoadingState shimmerCount={6} itemType="LIST" />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<SoccerIcon />}
            title={t('empty.noEvent')}
            description={t('empty.noEventDesc')}
          />
        ) : (
          <List disablePadding aria-label={t('a11y.gameEvents')}>
            {events.map((event, _index) => {
              const eventStyle = getEventStyle(event.type);
              return (
              <Card key={event.id} sx={{ mb: 1, ...eventStyle, borderWidth: 1, borderStyle: 'solid' }}>
                <ListItem sx={{ py: 1.5 }}>
                  <ListItemAvatar>
                    {/* #2213: avatar decorativo (ícone do evento) — texto adjacente já descreve. */}
                    <Avatar aria-hidden="true" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                      {getEventIcon(event.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {event.playerName}
                        <Chip
                          label={getEventLabel(event.type)}
                          size="small"
                          color={event.type === 'GOAL' ? 'success' : event.type === 'RED_CARD' ? 'error' : 'default'}
                        />
                      </Box>
                    }
                        secondary={event.teamId ? (teamsById[event.teamId]?.name ?? event.teamId) : 'Time não identificado'}
                  />
                  <Chip label={`${event.minute}'`} variant="outlined" />
                </ListItem>
              </Card>
              );
            })}
          </List>
        )}
      </PageContainer>

      {/* #2178: ScreenFab padronizado — #2161: acima da bottom nav */}
      {canManage && (
        <ScreenFab
          icon={<AddIcon />}
          aria-label={t('a11y.addEvent')}
          onClick={() => setDialogOpen(true)}
          sx={{
            display: { xs: 'flex', md: 'none' },
            bottom: { xs: pageSpacing.bottomBarHeight + 16, md: 24 },
            right: { xs: 16, sm: 'max(16px, calc(50% - 300px + 16px))' },
          }}
        />
      )}

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setSelectedPlayerTouched(false); setMinuteTouched(false); }} fullWidth fullScreen={isMobile} aria-labelledby="add-event-dialog-title">
        <DialogTitle id="add-event-dialog-title">{t('games.live.addEvent')}</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <ToggleButtonGroup
              value={eventType}
              exclusive
              onChange={(_, v) => v && setEventType(v)}
              fullWidth
              sx={{ mb: 2 }}
              aria-label={t('a11y.eventType')}
            >
              <ToggleButton value="GOAL">Gol</ToggleButton>
              <ToggleButton value="SAVE">Defesa</ToggleButton>
              <ToggleButton value="YELLOW_CARD">Amarelo</ToggleButton>
              <ToggleButton value="RED_CARD">Vermelho</ToggleButton>
            </ToggleButtonGroup>

            <TextField
              select
              fullWidth
              label="Jogador confirmado"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              onBlur={() => setSelectedPlayerTouched(true)}
              error={selectedPlayerTouched && !selectedPlayerId}
              helperText={selectedPlayerTouched && !selectedPlayerId ? t('validation.selectRequired') : ' '}
              sx={{ mb: 2 }}
            >
              {players.map((player) => (
                <MenuItem key={player.id} value={player.id}>
                  {player.name} - {player.teamName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Minuto"
              type="number"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              onBlur={() => setMinuteTouched(true)}
              error={minuteTouched && (minute === '' || Number(minute) < 0)}
              helperText={minuteTouched && (minute === '' || Number(minute) < 0) ? t('validation.positiveNumber') : ' '}
              inputProps={{ min: 0, max: 200 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleAddEvent} disabled={submitting || !selectedPlayerId || !eventType} startIcon={submitting ? <CircularProgress size={16} /> : undefined}>
            {submitting ? t('common.loading') : t('games.live.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
