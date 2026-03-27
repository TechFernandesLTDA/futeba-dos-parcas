import { useState, useEffect } from 'react';
import { gamificationColors } from '../../theme';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Chip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  Warning as WarningIcon,
  Star as StarIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

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
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventType, setEventType] = useState<'GOAL' | 'ASSIST' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE'>('GOAL');
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');
  const [minute, setMinute] = useState('0');
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    if (!gameId) return;

    const eventsRef = collection(db, 'game_events');
    const q = query(eventsRef, where('game_id', '==', gameId), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [gameId]);

  const handleAddEvent = async () => {
    if (!gameId || !user || !playerName) return;

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
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'GOAL':
        return <SoccerIcon color="success" />;
      case 'ASSIST':
        return <TrendingIcon color="info" />;
      case 'YELLOW_CARD':
        return <Box sx={{ width: 12, height: 16, bgcolor: gamificationColors.gold, borderRadius: 0.5 }} />;
      case 'RED_CARD':
        return <Box sx={{ width: 12, height: 16, bgcolor: '#f44336', borderRadius: 0.5 }} />;
      case 'SAVE':
        return <StarIcon color="warning" />;
      default:
        return <PersonIcon />;
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Eventos do Jogo
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={6} itemType="LIST" />
        ) : events.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum evento
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Adicione gols, assistências e cartões
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Eventos do jogo">
            {events.map((event, index) => (
              <Card key={event.id} sx={{ mb: 1 }}>
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
            ))}
          </List>
        )}
      </Container>

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setDialogOpen(true)}
        aria-label="Adicionar evento"
      >
        <AddIcon />
      </Fab>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth aria-labelledby="add-event-dialog-title">
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
              <ToggleButton value="GOAL">⚽ Gol</ToggleButton>
              <ToggleButton value="ASSIST">👟 Assist</ToggleButton>
              <ToggleButton value="YELLOW_CARD">🟨 Amarelo</ToggleButton>
              <ToggleButton value="RED_CARD">🟥 Vermelho</ToggleButton>
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
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddEvent} disabled={!playerName}>
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
