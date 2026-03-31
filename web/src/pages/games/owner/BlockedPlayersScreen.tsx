import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  Divider,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Block as BlockIcon,
  Person as PersonIcon,
  RemoveCircle as UnblockIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../../components/common/GameCard';
import { snakeToCamel } from '../../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('BlockedPlayersScreen');

interface BlockedPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  reason?: string;
  blockedAt?: Date;
}

export const BlockedPlayersScreen: React.FC = () => {
  useDocumentTitle('Jogadores Bloqueados');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const fetchBlocked = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          const gameData = snakeToCamel(gameDoc.data()) as Record<string, any>;
          const blockedIds = gameData.blockedPlayers || [];

          const players = await Promise.all(
            blockedIds.map(async (uid: string) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const data = snakeToCamel(userDoc.data()) as Record<string, any>;
                return {
                  id: uid,
                  name: data.name || 'Jogador',
                  photoUrl: data.photoUrl,
                };
              }
              return null;
            })
          );
          
          setBlockedPlayers(players.filter(Boolean) as BlockedPlayer[]);
        }
      } catch (error) {
        logger.error('Error fetching blocked players:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBlocked();
  }, [gameId]);

  const handleUnblock = async (playerId: string) => {
    if (!gameId) return;
    
    try {
      await updateDoc(doc(db, 'games', gameId), {
        blocked_players: arrayRemove(playerId),
      });
      setBlockedPlayers((prev) => prev.filter((p) => p.id !== playerId));
    } catch (error) {
      logger.error('Error unblocking player:', error);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
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
            Jogadores Bloqueados
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={4} itemType="LIST" />
        ) : blockedPlayers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <BlockIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogador bloqueado
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Jogadores bloqueados não poderão participar deste jogo
            </Typography>
          </Box>
        ) : (
          <Card>
            <List disablePadding aria-label="Jogadores bloqueados">
              {blockedPlayers.map((player, index) => (
                <Box key={player.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemAvatar>
                      <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={48} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={player.name}
                      secondary="Bloqueado para este jogo"
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<UnblockIcon />}
                        onClick={() => handleUnblock(player.id)}
                      >
                        Desbloquear
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}

        <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Dica:</strong> Jogadores bloqueados não receberão notificações sobre este jogo e não poderão confirmar presença.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};
