import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Grid,
  Paper,
  Divider,
  Button,
  Skeleton,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  Shuffle as ShuffleIcon,
  Save as SaveIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { getLevelForXp } from '../../types/gamification';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TeamFormationScreen');

interface TeamPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  level: number;
  position?: string;
}

export const TeamFormationScreen: React.FC = () => {
  useDocumentTitle('Formação de Times');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [teamA, setTeamA] = useState<TeamPlayer[]>([]);
  const [teamB, setTeamB] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          const data = snakeToCamel(gameDoc.data()) as Record<string, any>;
          const confirmedPlayers = data.confirmedPlayers || [];

          const players: TeamPlayer[] = await Promise.all(
            confirmedPlayers.map(async (uid: string) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const userData = snakeToCamel(userDoc.data()) as Record<string, any>;
                return {
                  id: uid,
                  name: userData.name || 'Jogador',
                  photoUrl: userData.photoUrl,
                  level: getLevelForXp(userData.experiencePoints ?? 0),
                };
              }
              return { id: uid, name: 'Jogador', level: 1 };
            })
          );

          const half = Math.ceil(players.length / 2);
          setTeamA(players.slice(0, half));
          setTeamB(players.slice(half));
        }
      } catch (error) {
        logger.error('Error fetching game:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  const shuffleTeams = () => {
    const allPlayers = [...teamA, ...teamB];
    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
    }
    const half = Math.ceil(allPlayers.length / 2);
    setTeamA(allPlayers.slice(0, half));
    setTeamB(allPlayers.slice(half));
  };

  const movePlayer = (player: TeamPlayer, fromTeam: 'A' | 'B') => {
    if (fromTeam === 'A') {
      setTeamA(teamA.filter((p) => p.id !== player.id));
      setTeamB([...teamB, player]);
    } else {
      setTeamB(teamB.filter((p) => p.id !== player.id));
      setTeamA([...teamA, player]);
    }
  };

  const handleSaveTeams = async () => {
    if (!gameId) return;
    setSaving(true);
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        team1_players: teamA.map(p => p.id),
        team2_players: teamB.map(p => p.id),
        team1_name: 'Time A',
        team2_name: 'Time B',
        updated_at: serverTimestamp(),
      });
      navigate(-1);
    } catch (error) {
      logger.error('Error saving teams:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState shimmerCount={6} itemType="CARD" />;
  }

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
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Formação de Times
          </Typography>
          <IconButton onClick={shuffleTeams} aria-label="Sortear times">
            <ShuffleIcon />
          </IconButton>
          <IconButton onClick={handleSaveTeams} disabled={saving} aria-label="Salvar times">
            <SaveIcon />
          </IconButton>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Grid container spacing={2}>
          <Grid xs={6}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Avatar sx={{ bgcolor: theme.palette.primary.main }}>A</Avatar>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Time A ({teamA.length})
                  </Typography>
                </Box>
                {teamA.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => movePlayer(player, 'A')}
                  >
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={32} level={player.level} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {player.name}
                    </Typography>
                    <Chip label="→" size="small" />
                  </Box>
                ))}
                {teamA.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Arraste jogadores aqui
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={6}>
            <Card sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.05) }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>B</Avatar>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Time B ({teamB.length})
                  </Typography>
                </Box>
                {teamB.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => movePlayer(player, 'B')}
                  >
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={32} level={player.level} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {player.name}
                    </Typography>
                    <Chip label="←" size="small" />
                  </Box>
                ))}
                {teamB.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Arraste jogadores aqui
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Clique em um jogador para movê-lo para o outro time
          </Typography>
        </Box>

        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          onClick={handleSaveTeams}
          disabled={saving}
          startIcon={saving ? <Skeleton width={20} /> : <SaveIcon />}
        >
          {saving ? 'Salvando...' : 'Confirmar Times'}
        </Button>
      </Container>
    </Box>
  );
};
