import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Avatar,
  Grid,
  Button,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  ThumbDown as ThumbDownIcon,
  Star as StarIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

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

// #2276: interfaces tipadas para os docs lidos (substituem Record<string, any>).
interface RawVoteGameDoc {
  teamAScore?: number;
  team1Score?: number;
  teamBScore?: number;
  team2Score?: number;
  winnerTeam?: GameResult['winner'];
  mvpId?: string;
  bolaMurchaId?: string;
  mvpVotes?: number;
  bolaMurchaVotes?: number;
}
interface RawVoteUserDoc {
  name?: string;
  photoUrl?: string;
}

export const VoteResultScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.voteResult'));
  const navigateBack = useNavigateBack('/?tab=1');
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: theme.palette.background.default,
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`resultado-jogo-${gameId}.pdf`);
    } catch (err) {
      logger.error('Error exporting PDF:', err);
      showErrorRef.current('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false; // #2278: evita setState após unmount

    const fetchData = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists() && !cancelled) {
          const raw = gameDoc.data();
          const data = snakeToCamel<RawVoteGameDoc>(raw);
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
              const userData = snakeToCamel<RawVoteUserDoc>(userRaw);
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
              const userData = snakeToCamel<RawVoteUserDoc>(userRaw);
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
        if (!cancelled) {
          setError('Erro ao carregar resultado da votação.');
          showErrorRef.current('Erro ao carregar resultado da votação.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [gameId, retryCount]);

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading) {
    return <LoadingState shimmerCount={4} itemType="CARD" />;
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title="Resultado da Votação" onBack={navigateBack} />

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <div ref={contentRef}>
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
          <EmptyState
            icon={<StarIcon />}
            title={t('mvp.notHeldYet')}
          />
        )}
        </div>

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={20} /> : <PdfIcon />}
            onClick={handleExportPdf}
            disabled={exporting}
            fullWidth
          >
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
          <Button variant="outlined" fullWidth onClick={navigateBack}>
            Voltar
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
