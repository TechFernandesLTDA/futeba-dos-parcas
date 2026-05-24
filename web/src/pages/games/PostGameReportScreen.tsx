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
  Divider,
  Button,
  useTheme,
  alpha,
  Chip,
  List,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  Assessment as StatsIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { getLevelForXp, getLevelEntry, getXpProgress } from '../../types/gamification';

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

interface GamificationData {
  xpEarned: number;
  isMvp: boolean;
  isWorstPlayer: boolean;
}

interface LevelData {
  levelBefore: number;
  levelAfter: number;
  xpProgress: number;
  leveledUp: boolean;
  levelName: string;
}

interface FinancialData {
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  unpaidCount: number;
}

export const PostGameReportScreen: React.FC = () => {
  useDocumentTitle('Relatório Pós-Jogo');
  const navigateBack = useNavigateBack('/?tab=1');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [stats, setStats] = useState<PostGameStats | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;

    const fetchReport = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (cancelled) return;
        if (!gameDoc.exists()) {
          showErrorRef.current('Jogo não encontrado.');
          navigateRef.current('/?tab=1', { replace: true });
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = snakeToCamel(gameDoc.data()) as Record<string, any>;

        if (data.status !== 'FINISHED') {
          showErrorRef.current('Relatório só disponível após o jogo ser finalizado.');
          navigateRef.current(`/game/${gameId}`, { replace: true });
          return;
        }

        let mvpName = '';
        if (data.mvpId) {
          const mvpDoc = await getDoc(doc(db, 'users', data.mvpId));
          if (cancelled) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (mvpDoc.exists()) mvpName = (snakeToCamel(mvpDoc.data()) as Record<string, any>).name || '';
        }

        // Busca o nome do jogador "Bola Murcha" do Firestore, igual ao padrão do MVP
        let bolaMurchaName = '';
        if (data.bolaMurchaId) {
          const bolaMurchaDoc = await getDoc(doc(db, 'users', data.bolaMurchaId));
          if (cancelled) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (bolaMurchaDoc.exists()) bolaMurchaName = (snakeToCamel(bolaMurchaDoc.data()) as Record<string, any>).name || '';
        }

        if (cancelled) return;

        setStats({
          teamAScore: data.teamAScore || data.team1Score || 0,
          teamBScore: data.teamBScore || data.team2Score || 0,
          teamAName: data.team1Name || data.teamAName || undefined,
          teamBName: data.team2Name || data.teamBName || undefined,
          winner: data.winnerTeam || 'DRAW',
          mvpId: data.mvpId,
          mvpName,
          bolaMurchaId: data.bolaMurchaId,
          bolaMurchaName,
          scorers: data.scorers || [],
          assistants: data.assistants || [],
          participants: data.participants || [],
        });

        const uid = user?.id;
        if (uid) {
          const confirmationsRef = collection(db, 'confirmations');
          const confirmationQ = query(confirmationsRef, where('game_id', '==', gameId));
          const confirmationsSnap = await getDocs(confirmationQ);
          if (cancelled) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const confirmationsData = confirmationsSnap.docs.map((d) => snakeToCamel(d.data()) as Record<string, any>);

          const myConfirmation = confirmationsData.find((c) => c.userId === uid);
          if (myConfirmation) {
            setGamification({
              xpEarned: myConfirmation.xpEarned || 0,
              isMvp: myConfirmation.isMvp || false,
              isWorstPlayer: myConfirmation.isWorstPlayer || false,
            });
          }

          const paidConfirmations = confirmationsData.filter(
            (c) => c.paymentStatus === 'PAID' || c.paymentStatus === 'paid'
          );
          const unpaidConfirmations = confirmationsData.filter(
            (c) => c.status === 'CONFIRMED' && c.paymentStatus !== 'PAID' && c.paymentStatus !== 'paid'
          );

          const dailyPrice = data.dailyPrice || 0;
          setFinancialData({
            totalCollected: paidConfirmations.length * dailyPrice,
            totalPending: unpaidConfirmations.length * dailyPrice,
            paidCount: paidConfirmations.length,
            unpaidCount: unpaidConfirmations.length,
          });

          const userDoc = await getDoc(doc(db, 'users', uid));
          if (cancelled) return;
          if (userDoc.exists()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userData = snakeToCamel(userDoc.data()) as Record<string, any>;
            const currentXp = userData.xp || userData.totalXp || 0;
            const xpEarned = myConfirmation?.xpEarned || 0;
            const xpBefore = currentXp - xpEarned;
            const levelBefore = getLevelForXp(xpBefore > 0 ? xpBefore : 0);
            const levelAfter = getLevelForXp(currentXp);
            setLevelData({
              levelBefore,
              levelAfter,
              xpProgress: getXpProgress(currentXp),
              leveledUp: levelAfter > levelBefore,
              levelName: getLevelEntry(levelAfter).name,
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Error fetching report:', error);
          setError('Erro ao carregar dados. Tente novamente.');
          showErrorRef.current('Erro ao carregar dados. Tente novamente.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReport();
    return () => { cancelled = true; };
  }, [gameId, user?.id, retryCount]);

  const handleShare = async () => {
    if (!stats) return;

    const text = `⚽ Futeba dos Parças - Relatório do Jogo\n\n${stats.teamAName || 'Time A'} ${stats.teamAScore} x ${stats.teamBScore} ${stats.teamBName || 'Time B'}${stats.mvpName ? `\n\nMVP: ${stats.mvpName}` : ''}${gamification?.xpEarned ? `\nXP: +${gamification.xpEarned}` : ''}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Futeba dos Parças', text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(text);
        showSuccess('Resultado copiado para a área de transferência!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        showSuccess('Resultado copiado!');
      } catch {
        showError('Não foi possível compartilhar.');
      }
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
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Relatório do Jogo
          </Typography>
          <IconButton onClick={handleShare} aria-label="Compartilhar">
            <ShareIcon />
          </IconButton>
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

        {gamification && gamification.xpEarned > 0 && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.success.main, 0.06) }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1,
                }}
              >
                <Typography variant="h4" fontWeight={700} color="success.main">
                  +{gamification.xpEarned}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                XP ganho nesta partida
              </Typography>
              {gamification.isMvp && (
                <Chip
                  icon={<TrophyIcon />}
                  label="MVP da Partida"
                  color="warning"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        )}

        {levelData?.leveledUp && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" fontWeight={700} gutterBottom>
                Level Up!
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Chip label={`Nível ${levelData.levelBefore}`} size="small" variant="outlined" />
                <Typography variant="h6" color="primary">
                  →
                </Typography>
                <Chip label={`Nível ${levelData.levelAfter} - ${levelData.levelName}`} size="small" color="primary" />
              </Box>
            </CardContent>
          </Card>
        )}

        {levelData && !levelData.leveledUp && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Nível {levelData.levelAfter} · {levelData.levelName}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={levelData.xpProgress * 100}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {Math.round(levelData.xpProgress * 100)}% para o próximo nível
              </Typography>
            </CardContent>
          </Card>
        )}

        {financialData && financialData.paidCount > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Resumo Financeiro
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Pagantes ({financialData.paidCount})
                </Typography>
                <Typography variant="body2" fontWeight={600} color="success.main">
                  R$ {financialData.totalCollected.toFixed(2)}
                </Typography>
              </Box>
              {financialData.unpaidCount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Pendentes ({financialData.unpaidCount})
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="warning.main">
                    R$ {financialData.totalPending.toFixed(2)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

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

        {/* Card do Bola Murcha — exibido apenas quando o nome foi buscado do Firestore */}
        {stats.bolaMurchaName && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.error.main }}>
                  <SoccerIcon />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    Bola Murcha
                  </Typography>
                  <Typography variant="h6">{stats.bolaMurchaName}</Typography>
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
