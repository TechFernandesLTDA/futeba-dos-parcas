import { useState, useEffect } from 'react';
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
  Divider,
  Button,
  useTheme,
  alpha,
  Chip,
  List,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  Assessment as StatsIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PostGameReportScreen');

interface PostGameStats {
  teamAScore: number;
  teamBScore: number;
  teamAName?: string;
  teamBName?: string;
  winner: 'A' | 'B' | 'DRAW';
  mvpId?: string;
  mvpName?: string;
  bolaMurchaId?: string;
  bolaMurchaName?: string;
  scorers: { userId: string; userName: string; goals: number }[];
  assistants: { userId: string; userName: string; assists: number }[];
  participants: { userId: string; userName: string; team: 'A' | 'B' }[];
}

export const PostGameReportScreen: React.FC = () => {
  useDocumentTitle('Relatório Pós-Jogo');
  const navigateBack = useNavigateBack('/games');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  useAuth();
  const { showError } = useToast();

  const [stats, setStats] = useState<PostGameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const fetchReport = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(gameDoc.data()) as Record<string, any>;

          // Relatório só disponível após jogo finalizado
          if (data.status !== 'FINISHED') {
            showError('Relatório só disponível após o jogo ser finalizado.');
            navigate(`/game/${gameId}`, { replace: true });
            return;
          }

          let mvpName = '';
          if (data.mvpId) {
            const mvpDoc = await getDoc(doc(db, 'users', data.mvpId));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (mvpDoc.exists()) mvpName = (snakeToCamel(mvpDoc.data()) as Record<string, any>).name || '';
          }

          setStats({
            teamAScore: data.teamAScore || data.team1Score || 0,
            teamBScore: data.teamBScore || data.team2Score || 0,
            teamAName: data.team1Name || data.teamAName || undefined,
            teamBName: data.team2Name || data.teamBName || undefined,
            winner: data.winnerTeam || 'DRAW',
            mvpId: data.mvpId,
            mvpName,
            scorers: data.scorers || [],
            assistants: data.assistants || [],
            participants: data.participants || [],
          });
        }
      } catch (error) {
        logger.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (loading) {
    return <LoadingState shimmerCount={6} itemType="CARD" />;
  }

  if (!stats) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <StatsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Relatório não disponível
        </Typography>
      </Box>
    );
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
            Relatório do Jogo
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Resultado Final
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid xs={5}>
                <Typography
                  variant="h3"
                  fontWeight={700}
                  color={stats.winner === 'A' ? 'success.main' : 'text.primary'}
                >
                  {stats.teamAScore}
                </Typography>
                <Chip
                  label={stats.teamAName || 'Time A'}
                  size="small"
                  color={stats.winner === 'A' ? 'success' : 'default'}
                />
              </Grid>
              <Grid xs={2}>
                <Typography variant="h5" color="text.secondary">
                  X
                </Typography>
              </Grid>
              <Grid xs={5}>
                <Typography
                  variant="h3"
                  fontWeight={700}
                  color={stats.winner === 'B' ? 'success.main' : 'text.primary'}
                >
                  {stats.teamBScore}
                </Typography>
                <Chip
                  label={stats.teamBName || 'Time B'}
                  size="small"
                  color={stats.winner === 'B' ? 'success' : 'default'}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {stats.mvpName && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
                  <TrophyIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="warning.main" fontWeight={600}>
                    MVP
                  </Typography>
                  <Typography variant="h6">{stats.mvpName}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Artilheiros
            </Typography>
            {stats.scorers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum gol registrado
              </Typography>
            ) : (
              <List dense disablePadding>
                {stats.scorers.slice(0, 5).map((scorer, index) => (
                  <Box key={scorer.userId}>
                    {index > 0 && <Divider />}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
                      <Typography variant="body2" sx={{ width: 24 }}>
                        {index + 1}.
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {scorer.userName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SoccerIcon fontSize="small" color="success" />
                        <Typography variant="body2" fontWeight={600}>
                          {scorer.goals}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Garçons (Assistências)
            </Typography>
            {stats.assistants.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma assistência registrada
              </Typography>
            ) : (
              <List dense disablePadding>
                {stats.assistants.slice(0, 5).map((assistant, index) => (
                  <Box key={assistant.userId}>
                    {index > 0 && <Divider />}
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
                      <Typography variant="body2" sx={{ width: 24 }}>
                        {index + 1}.
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {assistant.userName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingIcon fontSize="small" color="info" />
                        <Typography variant="body2" fontWeight={600}>
                          {assistant.assists}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Button variant="outlined" fullWidth onClick={navigateBack}>
          Voltar
        </Button>
      </Container>
    </Box>
  );
};
