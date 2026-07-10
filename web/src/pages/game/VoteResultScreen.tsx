import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  EmojiEvents as TrophyIcon,
  ThumbDown as ThumbDownIcon,
  Star as StarIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ReactionBar } from '../../components/reactions/ReactionBar';
import { ReactionsMap } from '../../constants/reactions';
import { GameCommentsPanel } from './GameCommentsPanel';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PageContainer } from '../../components/common/PageContainer';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { getUsersByIds } from '../../utils/userBatch';

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
  bestGoalkeeper: {
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
  worstPlayerId?: string;
  bestGkId?: string;
  mvpVotes?: number;
  bolaMurchaVotes?: number;
  worstPlayerVotes?: number;
  bestGkVotes?: number;
  voteResultReactions?: ReactionsMap;
  votingConcludedAt?: Date;
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
  const { currentUser } = useAuth();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [voteResultReactions, setVoteResultReactions] = useState<ReactionsMap>({});
  const [votingConcludedAt, setVotingConcludedAt] = useState<Date | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const interactionEndsAt = votingConcludedAt
    ? new Date(votingConcludedAt.getTime() + 72 * 60 * 60 * 1000)
    : null;
  const canInteract = Boolean(currentUser?.uid && interactionEndsAt && interactionEndsAt.getTime() > Date.now());

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
      showErrorRef.current(t('mvp.exportError'));
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;
    let snapshotVersion = 0;

    const unsubscribe = onSnapshot(
      doc(db, 'games', gameId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError(t('games.notFound'));
          setLoading(false);
          return;
        }

        const version = ++snapshotVersion;
        const raw = snapshot.data();
        const data = snakeToCamel<RawVoteGameDoc>(raw);
        const teamAScore = data.teamAScore ?? data.team1Score ?? 0;
        const teamBScore = data.teamBScore ?? data.team2Score ?? 0;
        setGameResult({
          teamAScore,
          teamBScore,
          winner: data.winnerTeam
            ?? (teamAScore > teamBScore ? 'A' : teamBScore > teamAScore ? 'B' : 'DRAW'),
        });
        setVoteResultReactions((raw.vote_result_reactions as ReactionsMap | undefined) ?? {});
        setVotingConcludedAt(raw.voting_concluded_at?.toDate?.() ?? null);

        const mvpId = data.mvpId;
        const worstPlayerId = data.worstPlayerId ?? data.bolaMurchaId;
        const bestGkId = data.bestGkId;
        void getUsersByIds([mvpId, worstPlayerId, bestGkId].filter(Boolean) as string[])
          .then((awardUsersById) => {
            if (cancelled || version !== snapshotVersion) return;
            const buildAward = (userId: string | undefined, votes: number) => {
              if (!userId) return null;
              const profile = awardUsersById.get(userId) as RawVoteUserDoc | undefined;
              return {
                userId,
                userName: profile?.name || t('players.defaultName'),
                userPhoto: profile?.photoUrl,
                votes,
              };
            };
            setVoteResult({
              mvp: buildAward(mvpId, data.mvpVotes ?? 0),
              bolaMurcha: buildAward(
                worstPlayerId,
                data.worstPlayerVotes ?? data.bolaMurchaVotes ?? 0,
              ),
              bestGoalkeeper: buildAward(bestGkId, data.bestGkVotes ?? 0),
              topScorer: null,
              topAssistant: null,
            });
            setError(null);
            setLoading(false);
          })
          .catch((err) => {
            if (cancelled || version !== snapshotVersion) return;
            logger.error('Error resolving vote result users:', err);
            setError(t('feedback.games.voteResultError'));
            setLoading(false);
          });
      },
      (err) => {
        logger.error('Error listening authoritative vote result:', err);
        setError(t('feedback.games.voteResultError'));
        setLoading(false);
        showErrorRef.current(t('mvp.voteResultError'));
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [gameId, retryCount, t]);

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading) {
    return <LoadingState shimmerCount={4} itemType="CARD" />;
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title={t('page.title.voteResult')} onBack={navigateBack} />

      <PageContainer maxWidth="detail">
        <div ref={contentRef}>
        {gameResult && (
          <Card sx={{ mb: 2, textAlign: 'center' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('mvp.finalResult')}
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
                    {t('mvp.bestPlayerCaption')}
                  </Typography>
                  <Typography variant="h6">{voteResult.mvp.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('mvp.votesCount', { count: voteResult.mvp.votes })}
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

        {voteResult?.bestGoalkeeper && (
          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: theme.palette.info.main, width: 56, height: 56 }}>
                  <StarIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="info.main" fontWeight={600}>
                    {t('mvp.bestGoalkeeper')}
                  </Typography>
                  <Typography variant="h6">{voteResult.bestGoalkeeper.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('mvp.votesCount', { count: voteResult.bestGoalkeeper.votes })}
                  </Typography>
                </Box>
                <PlayerAvatar
                  name={voteResult.bestGoalkeeper.userName}
                  photoUrl={voteResult.bestGoalkeeper.userPhoto}
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
                    {t('mvp.worstPlayer')}
                  </Typography>
                  <Typography variant="h6">{voteResult.bolaMurcha.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('mvp.votesCount', { count: voteResult.bolaMurcha.votes })}
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

        {!voteResult?.mvp && !voteResult?.bestGoalkeeper && !voteResult?.bolaMurcha && (
          <EmptyState
            icon={<StarIcon />}
            title={t('mvp.notHeldYet')}
          />
        )}
        </div>

        {gameId && (voteResult?.mvp || voteResult?.bestGoalkeeper || voteResult?.bolaMurcha) && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>
                {t('voteResultSocial.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {canInteract
                  ? t('voteResultSocial.description')
                  : t('voteResultSocial.readOnly')}
              </Typography>
              <ReactionBar
                targetPath={`games/${gameId}`}
                reactions={voteResultReactions}
                reactionField="vote_result_reactions"
                enabled={canInteract}
              />
            </CardContent>
          </Card>
        )}

        {gameId && (
          <GameCommentsPanel
            gameId={gameId}
            canWrite={canInteract}
            canManage={false}
            context="vote_result"
            title={t('voteResultSocial.commentsTitle')}
            description={t('voteResultSocial.commentsDescription')}
            emptyTitle={t('voteResultSocial.emptyTitle')}
            emptyDesc={t('voteResultSocial.emptyDesc')}
          />
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={20} /> : <PdfIcon />}
            onClick={handleExportPdf}
            disabled={exporting}
            fullWidth
          >
            {exporting ? t('mvp.exporting') : t('mvp.exportPdf')}
          </Button>
          <Button variant="outlined" fullWidth onClick={navigateBack}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    </Box>
  );
};
