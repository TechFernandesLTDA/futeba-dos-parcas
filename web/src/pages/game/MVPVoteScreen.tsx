import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Alert,
  Skeleton,
  useTheme,
  alpha,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  HowToVote as VoteIcon,
  EmojiEvents as TrophyIcon,
  SentimentVeryDissatisfied as BolaMurchaIcon,
  PersonOff as PersonOffIcon,
} from '@mui/icons-material';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  concludeMvpVoting,
  submitMvpVotes,
  type MvpVoteCategory,
} from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Game, GameConfirmation } from '../../types/game';
import { PlayerAvatar } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { FixedBottomBar } from '../../components/layout';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { PageContainer } from '../../components/common/PageContainer';
import { TeamBadge } from '../../components/team/TeamBadge';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { hasContradictoryVoteSelection } from './mvpVoteSemantics';

const logger = createLogger('MVPVoteScreen');

export const MVPVoteScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.mvpVote'));
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/?tab=1');
  const theme = useTheme();
  const { currentUser, user } = useAuth();
  const { showError } = useToast();
  const reduceMotion = useReducedMotion();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [game, setGame] = useState<Game | null>(null);
  const [confirmations, setConfirmations] = useState<GameConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mvpVote, setMvpVote] = useState<string>('');
  const [bestGkVote, setBestGkVote] = useState<string>('');
  const [worstPlayerVote, setWorstPlayerVote] = useState<string>('');
  const [hasVoted, setHasVoted] = useState(false);
  const [redirectAfterVote, setRedirectAfterVote] = useState(false);
  const [ballotVotes, setBallotVotes] = useState<Partial<Record<MvpVoteCategory, string>>>({});
  const [loadedBallotCategories, setLoadedBallotCategories] = useState<Set<MvpVoteCategory>>(new Set());
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [concluding, setConcluding] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const gameRef = doc(db, 'games', gameId);
    const confirmationsRef = collection(db, 'confirmations');

    const unsubscribeGame = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const raw = doc.data();
        const data = snakeToCamel(raw);
        setGame({
          id: doc.id,
          ...data,
          dateTime: (raw.date_time || raw.dateTime)?.toDate?.() || data.dateTime,
        } as Game);
      }
      setLoading(false);
    }, (err) => {
      logger.error('Error in MVP vote game listener:', err);
      showErrorRef.current(t('feedback.mvp.loadGameError'));
      setLoading(false);
    });

    const unsubscribeConfirmations = onSnapshot(query(confirmationsRef, where('game_id', '==', gameId)), (snapshot) => {
      const confirmationsData = snapshot.docs
        .filter((doc) => doc.data().status === 'CONFIRMED')
        .map((doc) => {
          const raw = doc.data();
          const data = snakeToCamel(raw);
          return {
            id: doc.id,
            ...data,
            confirmedAt: (raw.confirmed_at || raw.confirmedAt)?.toDate?.(),
          };
        }) as GameConfirmation[];
      setConfirmations(confirmationsData);
    }, (err) => {
      logger.error('Error in MVP vote confirmations listener:', err);
      showErrorRef.current(t('feedback.mvp.loadConfirmationsError'));
    });

    return () => {
      unsubscribeGame();
      unsubscribeConfirmations();
    };
  }, [gameId, t]);

  useEffect(() => {
    if (!gameId || !currentUser?.uid) {
      setBallotVotes({});
      setLoadedBallotCategories(new Set());
      return undefined;
    }

    const categories: MvpVoteCategory[] = ['MVP', 'BEST_GOALKEEPER', 'WORST'];
    const unsubscribes = categories.map((category) => onSnapshot(
      doc(db, 'mvp_votes', `${gameId}_${currentUser.uid}_${category}`),
      (snapshot) => {
        const votedPlayerId = snapshot.exists()
          ? String(snapshot.data().voted_player_id ?? '')
          : '';
        setBallotVotes((current) => {
          const next = { ...current };
          if (votedPlayerId) next[category] = votedPlayerId;
          else delete next[category];
          return next;
        });
        setLoadedBallotCategories((current) => new Set(current).add(category));
      },
      (err) => {
        logger.error(`Error in own ${category} vote listener:`, err);
        showErrorRef.current(t('mvp.ballotLoadError', { defaultValue: 'Erro ao carregar seu voto.' }));
        setLoadedBallotCategories((current) => new Set(current).add(category));
      },
    ));

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentUser?.uid, gameId, t]);

  useEffect(() => {
    if (ballotVotes.MVP) setMvpVote(ballotVotes.MVP);
    if (ballotVotes.BEST_GOALKEEPER) setBestGkVote(ballotVotes.BEST_GOALKEEPER);
    if (ballotVotes.WORST) setWorstPlayerVote(ballotVotes.WORST);
    setHasVoted(Boolean(ballotVotes.MVP && ballotVotes.WORST));
  }, [ballotVotes]);

  useEffect(() => {
    if (!hasVoted || !redirectAfterVote) return;

    const timer = setTimeout(() => {
      navigate(`/game/${gameId}`);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasVoted, redirectAfterVote, gameId, navigate]);

  // #2724: motion de celebração no reveal de voto registrado. Respeita prefers-reduced-motion.
  useEffect(() => {
    if (!hasVoted || reduceMotion) return;
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
        disableForReducedMotion: true,
      });
    });
  }, [hasVoted, reduceMotion]);

  const ballotReady = loadedBallotCategories.size === 3;
  const myConfirmation = confirmations.find(
    (confirmation) => confirmation.userId === currentUser?.uid && confirmation.status === 'CONFIRMED'
  );
  const canVote = Boolean(myConfirmation);
  const canManageVoting = Boolean(
    currentUser?.uid && game && (
      user?.role === 'ADMIN'
      || game.ownerId === currentUser.uid
      || game.coOrganizers?.includes(currentUser.uid)
    )
  );
  const votingConcluded = Boolean(game?.votingConcluded || game?.votingStatus === 'CONCLUDED');
  const hasVoteConflict = hasContradictoryVoteSelection(
    mvpVote,
    bestGkVote,
    worstPlayerVote,
  );

  const selectMvp = (playerId: string) => {
    if (playerId !== worstPlayerVote) setMvpVote(playerId);
  };

  const selectBestGoalkeeper = (playerId: string) => {
    if (playerId !== worstPlayerVote) setBestGkVote(playerId);
  };

  const selectWorstPlayer = (playerId: string) => {
    if (playerId !== mvpVote && playerId !== bestGkVote) {
      setWorstPlayerVote(playerId);
    }
  };

  const handleVote = async () => {
    if (!mvpVote || !worstPlayerVote || !gameId || !currentUser || !ballotReady) return;

    if (hasVoteConflict) {
      showError(t('mvp.conflictingVotesError'));
      return;
    }

    if (!myConfirmation) {
      showError(t('feedback.games.onlyConfirmedCanVote'));
      return;
    }

    setSubmitting(true);

    try {
      const votes: Array<{ category: MvpVoteCategory; votedPlayerId: string }> = [];
      if (!ballotVotes.MVP) votes.push({ category: 'MVP', votedPlayerId: mvpVote });
      if (!ballotVotes.WORST) votes.push({ category: 'WORST', votedPlayerId: worstPlayerVote });

      if (bestGkVote && !ballotVotes.BEST_GOALKEEPER) {
        votes.push({ category: 'BEST_GOALKEEPER', votedPlayerId: bestGkVote });
      }

      if (votes.length === 0) {
        setHasVoted(true);
        return;
      }

      const response = await submitMvpVotes({
        gameId,
        votes,
      });

      setRedirectAfterVote(response.data.ballotComplete);
      setHasVoted(response.data.ballotComplete);
    } catch (err) {
      logger.error('Error submitting vote:', err);
      showError((err as Error)?.message || t('feedback.mvp.submitVoteError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConcludeVoting = async () => {
    if (!gameId || !canManageVoting) return;
    setConcluding(true);
    try {
      await concludeMvpVoting({ gameId });
      setConcludeDialogOpen(false);
      navigate(`/game/${gameId}/results`);
    } catch (err) {
      logger.error('Error concluding MVP voting:', err);
      showError((err as Error)?.message || t('mvp.concludeError', {
        defaultValue: 'Não foi possível encerrar a votação.',
      }));
    } finally {
      setConcluding(false);
    }
  };

  const concludeDialog = (
    <Dialog open={concludeDialogOpen} onClose={() => !concluding && setConcludeDialogOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{t('mvp.concludeVoting', { defaultValue: 'Encerrar votação' })}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('mvp.concludeConfirm', {
            defaultValue: 'Encerrar a votação agora e publicar o resultado para todos?',
          })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConcludeDialogOpen(false)} disabled={concluding}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleConcludeVoting}
          disabled={concluding}
          startIcon={concluding ? <CircularProgress size={16} color="inherit" /> : <TrophyIcon />}
        >
          {concluding
            ? t('mvp.concluding', { defaultValue: 'Encerrando...' })
            : t('mvp.concludeVoting', { defaultValue: 'Encerrar votação' })}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={120} height={28} />
        </Box>
        <PageContainer maxWidth="form">
          <Skeleton variant="rounded" height={80} sx={{ mb: 3 }} />
          <Skeleton variant="text" width="50%" height={24} sx={{ mb: 1 }} />
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2, flexShrink: 0 }} />
              <Skeleton variant="text" sx={{ flex: 1 }} height={20} />
              <Skeleton variant="circular" width={20} height={20} sx={{ ml: 2, flexShrink: 0 }} />
            </Box>
          ))}
        </PageContainer>
      </Box>
    );
  }

  if (!game) {
    return (
      <PageContainer maxWidth="form">
        <Alert severity="error">{t('games.notFound')}</Alert>
        <Button startIcon={<BackIcon />} onClick={navigateBack} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </PageContainer>
    );
  }

  if (votingConcluded) {
    return (
      <PageContainer maxWidth="form">
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <TrophyIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>{t('mvp.results')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('mvp.resultsAvailable', { defaultValue: 'A votação foi encerrada e o resultado já está disponível.' })}
            </Typography>
            <Button variant="contained" onClick={() => navigate(`/game/${gameId}/results`)}>
              {t('mvp.viewResults', { defaultValue: 'Ver resultados' })}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (game.status !== 'FINISHED') {
    return (
      <PageContainer maxWidth="form">
        <Alert severity="info">
          {t('mvp.availableAfterFinish', {
            defaultValue: 'A votação fica disponível assim que a partida for finalizada.',
          })}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={navigateBack} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </PageContainer>
    );
  }

  if (hasVoted) {
    return (
      <PageContainer maxWidth="form">
        <Card>
          <CardContent sx={{ py: 6 }}>
            <TrophyIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
                {t('mvp.voteRegistered')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('mvp.thankYou')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 3 }}>
              {canManageVoting && (
                <Button variant="contained" onClick={() => setConcludeDialogOpen(true)}>
                  {t('mvp.concludeVoting', { defaultValue: 'Encerrar votação' })}
                </Button>
              )}
              <Button variant="outlined" onClick={() => navigate(`/game/${gameId}`)}>
                {t('common.back')}
              </Button>
            </Box>
          </CardContent>
        </Card>
        {concludeDialog}
      </PageContainer>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title={t('mvp.title')} onBack={navigateBack} />

      <PageContainer maxWidth="form">
        {!ballotReady && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('mvp.loadingBallot', { defaultValue: 'Carregando seu voto...' })}
          </Alert>
        )}
        {ballotReady && !canVote && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('feedback.games.onlyConfirmedCanVote')}
          </Alert>
        )}
        <Alert severity="info" id="vote-conflict-help" role="note" sx={{ mb: 2 }}>
          {t('mvp.conflictingVotesHelp')}
        </Alert>
        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrophyIcon color="warning" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {t('mvp.chooseMvp')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('mvp.chooseMvpDesc')}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <FormControl component="fieldset" sx={{ width: '100%' }} disabled={Boolean(ballotVotes.MVP)}>
              <FormLabel component="legend">
                <Typography variant="subtitle1" fontWeight={600}>
                  <TrophyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  {t('mvp.bestPlayerLabel')}
                </Typography>
              </FormLabel>
              <RadioGroup
                value={mvpVote}
                onChange={(e) => selectMvp(e.target.value)}
                sx={{ mt: 2 }}
              >
                <List disablePadding aria-label={t('a11y.mvpCandidates')}>
                  {confirmations
                    .filter((p) => p.userId !== currentUser?.uid)
                    .map((player) => {
                      const conflictsWithWorst = player.userId === worstPlayerVote;
                      return (
                    <ListItem
                      key={player.userId}
                      dense
                      aria-disabled={conflictsWithWorst}
                      onClick={() => !ballotVotes.MVP && !conflictsWithWorst && selectMvp(player.userId)}
                      secondaryAction={
                        <Radio
                          checked={mvpVote === player.userId}
                          value={player.userId}
                          disabled={conflictsWithWorst}
                          inputProps={{
                            'aria-label': player.userName,
                            'aria-describedby': conflictsWithWorst ? 'vote-conflict-help' : undefined,
                          }}
                        />
                      }
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        cursor: conflictsWithWorst ? 'not-allowed' : 'pointer',
                        transition: (t) => t.transitions.create('all', { duration: t.transitions.duration.shorter }),
                        transform: mvpVote === player.userId ? 'scale(1.02)' : 'scale(1)',
                        bgcolor: mvpVote === player.userId ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        boxShadow: mvpVote === player.userId ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.4)}` : 'none',
                      }}
                    >
                      <ListItemAvatar>
                        <PlayerAvatar
                          name={player.userName}
                          photoUrl={player.userPhoto}
                          size={44}
                        />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {player.userName}
                            <TeamBadge teamId={player.favoriteTeam} size={18} />
                          </Box>
                        }
                        secondary={conflictsWithWorst
                          ? t('mvp.conflictingCandidate')
                          : player.position === 'GOALKEEPER'
                            ? t('a11y.goalkeeper')
                            : t('games.detail.fieldPlayer')}
                      />
                    </ListItem>
                      );
                    })}
                </List>
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <FormControl component="fieldset" sx={{ width: '100%' }} disabled={Boolean(ballotVotes.BEST_GOALKEEPER)}>
                <FormLabel component="legend">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('mvp.bestGoalkeeper')}
                  </Typography>
                </FormLabel>
                <RadioGroup
                  value={bestGkVote}
                  onChange={(e) => selectBestGoalkeeper(e.target.value)}
                  sx={{ mt: 2 }}
                >
                  <List disablePadding aria-label={t('a11y.bestGoalkeeperCandidates')}>
                    {confirmations
                      .filter((p) => p.position === 'GOALKEEPER' && p.userId !== currentUser?.uid)
                      .map((player) => {
                        const conflictsWithWorst = player.userId === worstPlayerVote;
                        return (
                        <ListItem
                          key={player.userId}
                          dense
                          aria-disabled={conflictsWithWorst}
                          onClick={() => !ballotVotes.BEST_GOALKEEPER && !conflictsWithWorst && selectBestGoalkeeper(player.userId)}
                          secondaryAction={
                            <Radio
                              checked={bestGkVote === player.userId}
                              value={player.userId}
                              disabled={conflictsWithWorst}
                              inputProps={{
                                'aria-label': player.userName,
                                'aria-describedby': conflictsWithWorst ? 'vote-conflict-help' : undefined,
                              }}
                            />
                          }
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          cursor: conflictsWithWorst ? 'not-allowed' : 'pointer',
                          transition: (t) => t.transitions.create('all', { duration: t.transitions.duration.shorter }),
                          transform: bestGkVote === player.userId ? 'scale(1.02)' : 'scale(1)',
                          bgcolor: bestGkVote === player.userId ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                          boxShadow: bestGkVote === player.userId ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.4)}` : 'none',
                        }}
                        >
                          <ListItemAvatar>
                            <PlayerAvatar
                              name={player.userName}
                              photoUrl={player.userPhoto}
                              size={44}
                            />
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {player.userName}
                                <TeamBadge teamId={player.favoriteTeam} size={18} />
                              </Box>
                            }
                            secondary={conflictsWithWorst ? t('mvp.conflictingCandidate') : undefined}
                          />
                        </ListItem>
                        );
                      })}
                    {confirmations.filter((p) => p.position === 'GOALKEEPER' && p.userId !== currentUser?.uid).length === 0 && (
                      <EmptyState icon={<PersonOffIcon />} title={t('empty.noGoalkeeper')} description={t('empty.noGoalkeeperDesc')} animate={false} />
                    )}
                  </List>
                </RadioGroup>
              </FormControl>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.error.main, 0.08) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BolaMurchaIcon sx={{ fontSize: 40, color: theme.palette.error.main }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('mvp.chooseWorstPlayer')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('mvp.chooseWorstPlayerDesc')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <FormControl component="fieldset" sx={{ width: '100%' }} disabled={Boolean(ballotVotes.WORST)}>
                <FormLabel component="legend">
                  <Typography variant="subtitle1" fontWeight={600}>
                    <BolaMurchaIcon sx={{ verticalAlign: 'middle', mr: 1, color: theme.palette.error.main }} />
                    {t('mvp.worstPlayer')}
                  </Typography>
                </FormLabel>
                <RadioGroup
                  value={worstPlayerVote}
                  onChange={(e) => selectWorstPlayer(e.target.value)}
                  sx={{ mt: 2 }}
                >
                  <List disablePadding aria-label={t('a11y.worstPlayerCandidates')}>
                    {confirmations
                      .filter((p) => p.userId !== currentUser?.uid)
                      .map((player) => {
                        const conflictsWithPositive = (
                          player.userId === mvpVote || player.userId === bestGkVote
                        );
                        return (
                        <ListItem
                          key={player.userId}
                          dense
                          aria-disabled={conflictsWithPositive}
                          onClick={() => !ballotVotes.WORST && !conflictsWithPositive && selectWorstPlayer(player.userId)}
                          secondaryAction={
                            <Radio
                              checked={worstPlayerVote === player.userId}
                              value={player.userId}
                              disabled={conflictsWithPositive}
                              inputProps={{
                                'aria-label': player.userName,
                                'aria-describedby': conflictsWithPositive ? 'vote-conflict-help' : undefined,
                              }}
                            />
                          }
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          cursor: conflictsWithPositive ? 'not-allowed' : 'pointer',
                          transition: (t) => t.transitions.create('all', { duration: t.transitions.duration.shorter }),
                          transform: worstPlayerVote === player.userId ? 'scale(1.02)' : 'scale(1)',
                          bgcolor: worstPlayerVote === player.userId ? alpha(theme.palette.error.main, 0.1) : 'transparent',
                          boxShadow: worstPlayerVote === player.userId ? `0 0 0 1px ${alpha(theme.palette.error.main, 0.4)}` : 'none',
                        }}
                        >
                          <ListItemAvatar>
                            <PlayerAvatar
                              name={player.userName}
                              photoUrl={player.userPhoto}
                              size={44}
                            />
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {player.userName}
                                <TeamBadge teamId={player.favoriteTeam} size={18} />
                              </Box>
                            }
                            secondary={conflictsWithPositive
                              ? t('mvp.conflictingCandidate')
                              : player.position === 'GOALKEEPER'
                                ? t('a11y.goalkeeper')
                                : t('games.detail.fieldPlayer')}
                          />
                        </ListItem>
                        );
                      })}
                  </List>
                </RadioGroup>
              </FormControl>
            </CardContent>
          </Card>
        </PageContainer>

      {/* #2178: FixedBottomBar. #2164: tela full-screen (rota fora do AppLayout),
          centraliza no viewport — sem offset de sidebar. */}
      <FixedBottomBar inLayout={false}>
        <Box sx={{ width: '100%' }}>
          {canManageVoting && (
            <Button
              variant="outlined"
              fullWidth
              sx={{ mb: 1 }}
              onClick={() => setConcludeDialogOpen(true)}
              disabled={concluding}
            >
              {t('mvp.concludeVoting', { defaultValue: 'Encerrar votação' })}
            </Button>
          )}
          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={!canVote || !ballotReady || !mvpVote || !worstPlayerVote || hasVoteConflict || submitting}
            onClick={handleVote}
            startIcon={submitting ? <CircularProgress size={20} /> : <VoteIcon />}
          >
            {submitting ? t('feedback.sending') : t('mvp.submitVote')}
          </Button>
        </Box>
      </FixedBottomBar>
      {concludeDialog}
    </Box>
  );
};
