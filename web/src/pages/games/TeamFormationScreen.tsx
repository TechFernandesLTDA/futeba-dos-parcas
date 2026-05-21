import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward,
  ArrowBack,
  Shuffle as ShuffleIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { getLevelForXp } from '../../types/gamification';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

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
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { showError } = useToast();
  const { t } = useTranslation();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const userRef = useRef(user);
  userRef.current = user;

  const [teamA, setTeamA] = useState<TeamPlayer[]>([]);
  const [teamB, setTeamB] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      try {
        // Verificar se o usuário é dono do jogo antes de mostrar o formulário
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gameData = snakeToCamel(gameDoc.data()) as Record<string, any>;
          const ownerId = gameData.ownerId || gameData.owner_id;
          const currentUser = userRef.current;
          if (currentUser && currentUser.id !== ownerId) {
            showErrorRef.current('Apenas o dono do jogo pode formar os times.');
            navigateRef.current(`/game/${gameId}`);
            return;
          }
        }

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
        setError('Erro ao carregar dados. Tente novamente.');
        showErrorRef.current('Erro ao carregar dados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId, retryCount]);

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
      // Usa transação com campo de versão para detectar edições concorrentes (#949).
      // Se outro admin salvou os times enquanto este usuário editava, a transação
      // falha e o usuário recebe feedback para recarregar a página.
      await runTransaction(db, async (tx) => {
        const gameSnap = await tx.get(gameRef);
        if (!gameSnap.exists()) throw new Error(t('games.notFound'));
        const currentVersion = gameSnap.data()?.team_formation_version ?? 0;
        tx.update(gameRef, {
          team1_players: teamA.map(p => p.id),
          team2_players: teamB.map(p => p.id),
          team1_name: t('games.teams.A'),
          team2_name: t('games.teams.B'),
          team_formation_version: currentVersion + 1,
          updated_at: serverTimestamp(),
        });
      });
      navigateBack();
    } catch (error) {
      logger.error('Error saving teams:', error);
      showError(t('games.teams.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={handleRetry}>
            Tentar novamente
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

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
          <IconButton onClick={navigateBack} aria-label={t('common.back')}>
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
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                    }}
                    onClick={() => movePlayer(player, 'A')}
                  >
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={32} level={player.level} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {player.name}
                    </Typography>
                    <IconButton size="small" color="primary" aria-label={`Mover ${player.name} para Time B`}>
                      <ArrowForward fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                {teamA.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Clique para mover jogadores
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
                      '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.08) },
                    }}
                    onClick={() => movePlayer(player, 'B')}
                  >
                    <IconButton size="small" color="secondary" aria-label={`Mover ${player.name} para Time A`}>
                      <ArrowBack fontSize="small" />
                    </IconButton>
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={32} level={player.level} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {player.name}
                    </Typography>
                  </Box>
                ))}
                {teamB.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Clique para mover jogadores
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
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? 'Salvando...' : 'Confirmar Times'}
        </Button>
      </Container>
    </Box>
  );
};
