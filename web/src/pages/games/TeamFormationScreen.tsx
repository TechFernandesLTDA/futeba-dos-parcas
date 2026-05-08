import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Grid,
  Button,
  useTheme,
  alpha,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Shuffle as ShuffleIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { getLevelForXp } from '../../types/gamification';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';

const logger = createLogger('TeamFormationScreen');

interface TeamPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  level: number;
  position?: string;
}

interface ConfirmationData {
  user_id: string;
  user_name?: string;
  user_photo?: string;
  position?: string;
  status: string;
}

export const TeamFormationScreen: React.FC = () => {
  useDocumentTitle('Formação de Times');
  const navigateBack = useNavigateBack('/games');
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  useAuth();
  const { showError } = useToast();

  const [teamA, setTeamA] = useState<TeamPlayer[]>([]);
  const [teamB, setTeamB] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      try {
        // Buscar confirmações da coleção raiz (igual ao Android)
        const confirmationsRef = collection(db, 'confirmations');
        const q = query(confirmationsRef, where('game_id', '==', gameId));
        const snapshot = await getDocs(q);

        const confirmedDocs = snapshot.docs
          .filter((d) => d.data().status === 'CONFIRMED')
          .map((d) => d.data() as ConfirmationData);

        const players: TeamPlayer[] = await Promise.all(
          confirmedDocs.map(async (conf: ConfirmationData) => {
            const uid = conf.user_id;
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const userData = snakeToCamel(userDoc.data()) as Record<string, unknown>;
              return {
                id: uid,
                name: (userData.name as string | undefined) || conf.user_name || 'Jogador',
                photoUrl: (userData.photoUrl as string | undefined) || conf.user_photo,
                level: getLevelForXp((userData.experiencePoints as number | undefined) ?? 0),
                position: conf.position || 'FIELD',
              };
            }
            return { id: uid, name: conf.user_name || 'Jogador', level: 1, position: conf.position || 'FIELD' };
          })
        );

        if (players.length > 0) {
          // Sorteio automático: embaralhar e dividir em 2 times
          const shuffled = [...players].sort(() => Math.random() - 0.5);
          const half = Math.ceil(shuffled.length / 2);
          setTeamA(shuffled.slice(0, half));
          setTeamB(shuffled.slice(half));
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
      navigateBack();
    } catch (error) {
      logger.error('Error saving teams:', error);
      showError('Erro ao salvar os times. Tente novamente.');
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
          <IconButton onClick={navigateBack} aria-label="Voltar">
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
