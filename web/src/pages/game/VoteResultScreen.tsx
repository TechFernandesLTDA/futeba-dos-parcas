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
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  ThumbDown as ThumbDownIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('VoteResultScreen');

interface VoteResult {
  mvp: {
    userId: string;
    userName: string;
    userPhoto?: string;
    votes: number;
  } | null;
  bolaMurcha: {
    userId: string;
    userName: string;
    userPhoto?: string;
    votes: number;
  } | null;
  topScorer: {
    userId: string;
    userName: string;
    userPhoto?: string;
    goals: number;
  } | null;
  topAssistant: {
    userId: string;
    userName: string;
    userPhoto?: string;
    assists: number;
  } | null;
}

interface GameResult {
  teamAScore: number;
  teamBScore: number;
  winner: 'A' | 'B' | 'DRAW';
}

export const VoteResultScreen: React.FC = () => {
  useDocumentTitle('Resultado da Votação');
  const navigateBack = useNavigateBack('/games');
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  useAuth();
  const { showError } = useToast();

  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const fetchData = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          const raw = gameDoc.data();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(raw) as Record<string, any>;
          setGameResult({
            teamAScore: data.teamAScore || data.team1Score || 0,
            teamBScore: data.teamBScore || data.team2Score || 0,
            winner: data.winnerTeam || 'DRAW',
          });

          const mvpId = data.mvpId;
          if (mvpId) {
            const userDoc = await getDoc(doc(db, 'users', mvpId));
            if (userDoc.exists()) {
              const userRaw = userDoc.data();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const userData = snakeToCamel(userRaw) as Record<string, any>;
              setVoteResult((prev) => ({
                ...prev,
                mvp: {
                  userId: mvpId,
                  userName: userData.name || 'Jogador',
                  userPhoto: userData.photoUrl,
                  votes: data.mvpVotes || 0,
                },
              }) as VoteResult);
            }
          }

          const bolaMurchaId = data.bolaMurchaId;
          if (bolaMurchaId) {
            const userDoc = await getDoc(doc(db, 'users', bolaMurchaId));
            if (userDoc.exists()) {
              const userRaw = userDoc.data();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const userData = snakeToCamel(userRaw) as Record<string, any>;
              setVoteResult((prev) => ({
                ...prev,
                bolaMurcha: {
                  userId: bolaMurchaId,
                  userName: userData.name || 'Jogador',
                  userPhoto: userData.photoUrl,
                  votes: data.bolaMurchaVotes || 0,
                },
              }) as VoteResult);
            }
          }
        }
      } catch (error) {
        logger.error('Error fetching vote results:', error);
        showError('Erro ao carregar resultado da votação.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameId]);

  if (loading) {
    return <LoadingState shimmerCount={4} itemType="CARD" />;
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
          <Typography variant="h6" sx={{ ml: 1 }}>
            Resultado da Votação
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {gameResult && (
          <Card sx={{ mb: 2, textAlign: 'center' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Resultado Final
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid xs={5}>
                  <Typography variant="h3" fontWeight={700} color={gameResult.winner === 'A' ? 'success.main' : 'text.primary'}>
                    {gameResult.teamAScore}
                  </Typography>
                  <Chip label="Time A" size="small" color={gameResult.winner === 'A' ? 'success' : 'default'} />
                </Grid>
                <Grid xs={2}>
                  <Typography variant="h5" color="text.secondary">
                    X
                  </Typography>
                </Grid>
                <Grid xs={5}>
                  <Typography variant="h3" fontWeight={700} color={gameResult.winner === 'B' ? 'success.main' : 'text.primary'}>
                    {gameResult.teamBScore}
                  </Typography>
                  <Chip label="Time B" size="small" color={gameResult.winner === 'B' ? 'success' : 'default'} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {voteResult?.mvp && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 56, height: 56 }}>
                  <TrophyIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="warning.main" fontWeight={600}>
                    MVP - Melhor Jogador
                  </Typography>
                  <Typography variant="h6">{voteResult.mvp.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {voteResult.mvp.votes} votos
                  </Typography>
                </Box>
                <PlayerAvatar
                  name={voteResult.mvp.userName}
                  photoUrl={voteResult.mvp.userPhoto}
                  size={48}
                />
              </Box>
            </CardContent>
          </Card>
        )}

        {voteResult?.bolaMurcha && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.error.main, width: 56, height: 56 }}>
                  <ThumbDownIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    Bola Murcha
                  </Typography>
                  <Typography variant="h6">{voteResult.bolaMurcha.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {voteResult.bolaMurcha.votes} votos
                  </Typography>
                </Box>
                <PlayerAvatar
                  name={voteResult.bolaMurcha.userName}
                  photoUrl={voteResult.bolaMurcha.userPhoto}
                  size={48}
                />
              </Box>
            </CardContent>
          </Card>
        )}

        {!voteResult?.mvp && !voteResult?.bolaMurcha && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <StarIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Votação ainda não realizada
            </Typography>
          </Box>
        )}

        <Button variant="outlined" fullWidth onClick={navigateBack}>
          Voltar
        </Button>
      </Container>
    </Box>
  );
};
