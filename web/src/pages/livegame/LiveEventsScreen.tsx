import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  Star as StarIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';

const logger = createLogger('LiveEventsScreen');

interface GameEvent {
  id: string;
  type: 'GOAL' | 'ASSIST' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE';
  playerId: string;
  playerName: string;
  playerPhoto?: string;
  team: 'A' | 'B';
  minute: number;
  createdAt: Date;
}

export const LiveEventsScreen: React.FC = () => {
  useDocumentTitle('Eventos ao Vivo');
  const navigateBack = useNavigateBack('/?tab=1');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // #2238: dialog responsivo
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventType, setEventType] = useState<'GOAL' | 'ASSIST' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE'>('GOAL');
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');
  const [minute, setMinute] = useState('0');
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  useEffect(() => {
    if (!gameId || !user) return;

    // Verificar se o usuário pode gerenciar eventos (owner do jogo)
    const checkManagePermission = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gameData = snakeToCamel(gameDoc.data()) as Record<string, any>;
          const ownerId = gameData.ownerId || gameData.owner_id;
          setCanManage(user.id === ownerId);
        }
      } catch (err) {
        logger.error('Erro ao verificar permissão de gerenciamento:', err);
        showErrorRef.current('Erro ao verificar permissões. Tente novamente.');
      }
    };

    checkManagePermission();
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
            ...converted,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
          };
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

  const handleAddEvent = async () => {
    if (!gameId || !user || !playerName.trim() || !eventType) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'game_events'), {
        game_id: gameId,
        type: eventType,
        player_id: 'manual',
        player_name: playerName,
        team: selectedTeam,
        minute: parseInt(minute) || 0,
        created_by: user.id,
        created_at: serverTimestamp(),
      });
      setDialogOpen(false);
      setPlayerName('');
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
        return <StarIcon color="warning" />;
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
          <IconButton onClick={navigateBack} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Eventos do Jogo
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

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={6} itemType="LIST" />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<SoccerIcon />}
            title="Nenhum evento"
            description="Adicione gols, assistências e cartões"
          />
        ) : (
          <List disablePadding aria-label="Eventos do jogo">
            {events.map((event, _index) => {
              const eventStyle = getEventStyle(event.type);
              return (
              <Card key={event.id} sx={{ mb: 1, ...eventStyle, borderWidth: 1, borderStyle: 'solid' }}>
                <ListItem sx={{ py: 1.5 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
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
                    secondary={`Time ${event.team}`}
                  />
                  <Chip label={`${event.minute}'`} variant="outlined" />
                </ListItem>
              </Card>
              );
            })}
          </List>
        )}
      </Container>

      {canManage && (
        <Fab
          color="primary"
          sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', bottom: 16, right: { xs: 16, sm: 'max(16px, calc(50% - 300px + 16px))' } }}
          onClick={() => setDialogOpen(true)}
          aria-label="Adicionar evento"
        >
          <AddIcon />
        </Fab>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth fullScreen={isMobile} aria-labelledby="add-event-dialog-title">
        <DialogTitle id="add-event-dialog-title">Adicionar Evento</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <ToggleButtonGroup
              value={eventType}
              exclusive
              onChange={(_, v) => v && setEventType(v)}
              fullWidth
              sx={{ mb: 2 }}
              aria-label="Tipo de evento"
            >
              <ToggleButton value="GOAL">Gol</ToggleButton>
              <ToggleButton value="ASSIST">Assist</ToggleButton>
              <ToggleButton value="YELLOW_CARD">Amarelo</ToggleButton>
              <ToggleButton value="RED_CARD">Vermelho</ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup
              value={selectedTeam}
              exclusive
              onChange={(_, v) => v && setSelectedTeam(v)}
              fullWidth
              sx={{ mb: 2 }}
              aria-label="Selecionar time"
            >
              <ToggleButton value="A">Time A</ToggleButton>
              <ToggleButton value="B">Time B</ToggleButton>
            </ToggleButtonGroup>

            <TextField
              fullWidth
              label="Nome do Jogador"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 100 }}
            />

            <TextField
              fullWidth
              label="Minuto"
              type="number"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddEvent} disabled={submitting || !playerName.trim() || !eventType} startIcon={submitting ? <CircularProgress size={16} /> : undefined}>
            {submitting ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
