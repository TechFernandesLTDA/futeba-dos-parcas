import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
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
  useMediaQuery,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  HowToVote as VoteIcon,
  EmojiEvents as TrophyIcon,
  SentimentVeryDissatisfied as BolaMurchaIcon,
  PersonOff as PersonOffIcon,
} from '@mui/icons-material';
import { doc, collection, query, where, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Game, GameConfirmation } from '../../types/game';
import { PlayerAvatar } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { FixedBottomBar } from '../../components/layout';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TeamBadge } from '../../components/team/TeamBadge';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MVPVoteScreen');

export const MVPVoteScreen: React.FC = () => {
  useDocumentTitle('Votação MVP');
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/?tab=1');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // #2238: layout responsivo
  const { currentUser } = useAuth();
  const { showError } = useToast();
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
      showErrorRef.current('Erro ao carregar dados do jogo.');
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
      showErrorRef.current('Erro ao carregar confirmações do jogo.');
    });

    return () => {
      unsubscribeGame();
      unsubscribeConfirmations();
    };
  }, [gameId]);

  const handleVote = async () => {
    if (!mvpVote || !gameId || !currentUser) return;

    const myConfirmation = confirmations.find(
      (c) => c.userId === currentUser.uid && c.status === 'CONFIRMED'
    );
    if (!myConfirmation) {
      showError('Apenas jogadores confirmados podem votar.');
      return;
    }

    setSubmitting(true);

    try {
      const batch = writeBatch(db);

      const mvpVoteId = `${gameId}_${currentUser.uid}_MVP`;
      batch.set(doc(db, 'mvp_votes', mvpVoteId), {
        id: mvpVoteId,
        game_id: gameId,
        voter_id: currentUser.uid,
        voted_player_id: mvpVote,
        category: 'MVP',
        voted_at: serverTimestamp(),
      });

      if (bestGkVote) {
        const bestGkVoteId = `${gameId}_${currentUser.uid}_BEST_GOALKEEPER`;
        batch.set(doc(db, 'mvp_votes', bestGkVoteId), {
          id: bestGkVoteId,
          game_id: gameId,
          voter_id: currentUser.uid,
          voted_player_id: bestGkVote,
          category: 'BEST_GOALKEEPER',
          voted_at: serverTimestamp(),
        });
      }

      if (worstPlayerVote) {
        const worstVoteId = `${gameId}_${currentUser.uid}_WORST`;
        batch.set(doc(db, 'mvp_votes', worstVoteId), {
          id: worstVoteId,
          game_id: gameId,
          voter_id: currentUser.uid,
          voted_player_id: worstPlayerVote,
          category: 'WORST',
          voted_at: serverTimestamp(),
        });
      }

      await batch.commit();

      setHasVoted(true);

      setTimeout(() => {
        navigate(`/game/${gameId}`);
      }, 2000);
    } catch (err) {
      logger.error('Error submitting vote:', err);
      showError((err as Error)?.message || 'Erro ao enviar voto');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={120} height={28} />
        </Box>
        <Container maxWidth={isMobile ? false : 'sm'} sx={{ py: 2, px: isMobile ? 1 : undefined }}>
          <Skeleton variant="rounded" height={80} sx={{ mb: 3 }} />
          <Skeleton variant="text" width="50%" height={24} sx={{ mb: 1 }} />
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2, flexShrink: 0 }} />
              <Skeleton variant="text" sx={{ flex: 1 }} height={20} />
              <Skeleton variant="circular" width={20} height={20} sx={{ ml: 2, flexShrink: 0 }} />
            </Box>
          ))}
        </Container>
      </Box>
    );
  }

  if (!game) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">Jogo não encontrado</Alert>
        <Button startIcon={<BackIcon />} onClick={navigateBack} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  if (hasVoted) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <Card>
          <CardContent sx={{ py: 6 }}>
            <TrophyIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Voto Registrado!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Obrigado por participar da votação
            </Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title="Votação MVP" onBack={navigateBack} />

      <Container maxWidth={isMobile ? false : 'sm'} sx={{ py: 2, px: isMobile ? 1 : undefined }}>
        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrophyIcon color="warning" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  Escolha o MVP do Jogo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vote no jogador que mais se destacou
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <FormLabel component="legend">
                <Typography variant="subtitle1" fontWeight={600}>
                  <TrophyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Melhor Jogador (MVP)
                </Typography>
              </FormLabel>
              <RadioGroup
                value={mvpVote}
                onChange={(e) => setMvpVote(e.target.value)}
                sx={{ mt: 2 }}
              >
                <List disablePadding aria-label="Candidatos a MVP">
                  {confirmations
                    .filter((p) => p.userId !== currentUser?.uid)
                    .map((player) => (
                    <ListItem
                      key={player.userId}
                      dense
                      onClick={() => setMvpVote(player.userId)}
                      secondaryAction={
                        <Radio
                          checked={mvpVote === player.userId}
                          value={player.userId}
                        />
                      }
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        cursor: 'pointer',
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
                        secondary={player.position === 'GOALKEEPER' ? 'Goleiro' : 'Jogador de Linha'}
                      />
                    </ListItem>
                  ))}
                </List>
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <FormControl component="fieldset" sx={{ width: '100%' }}>
                <FormLabel component="legend">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Melhor Goleiro
                  </Typography>
                </FormLabel>
                <RadioGroup
                  value={bestGkVote}
                  onChange={(e) => setBestGkVote(e.target.value)}
                  sx={{ mt: 2 }}
                >
                  <List disablePadding aria-label="Candidatos a melhor goleiro">
                    {confirmations
                      .filter((p) => p.position === 'GOALKEEPER')
                      .map((player) => (
                        <ListItem
                          key={player.userId}
                          dense
                          onClick={() => setBestGkVote(player.userId)}
                          secondaryAction={
                            <Radio
                              checked={bestGkVote === player.userId}
                              value={player.userId}
                            />
                          }
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          cursor: 'pointer',
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
                          />
                        </ListItem>
                      ))}
                    {confirmations.filter((p) => p.position === 'GOALKEEPER').length === 0 && (
                      <EmptyState icon={<PersonOffIcon />} title="Nenhum goleiro" description="Nenhum goleiro neste jogo" animate={false} />
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
                    Escolha a Bola Murcha
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vote no jogador que menos se destacou
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <FormControl component="fieldset" sx={{ width: '100%' }}>
                <FormLabel component="legend">
                  <Typography variant="subtitle1" fontWeight={600}>
                    <BolaMurchaIcon sx={{ verticalAlign: 'middle', mr: 1, color: theme.palette.error.main }} />
                    Bola Murcha
                  </Typography>
                </FormLabel>
                <RadioGroup
                  value={worstPlayerVote}
                  onChange={(e) => setWorstPlayerVote(e.target.value)}
                  sx={{ mt: 2 }}
                >
                  <List disablePadding aria-label="Candidatos a bola murcha">
                    {confirmations
                      .filter((p) => p.userId !== currentUser?.uid)
                      .map((player) => (
                        <ListItem
                          key={player.userId}
                          dense
                          onClick={() => setWorstPlayerVote(player.userId)}
                          secondaryAction={
                            <Radio
                              checked={worstPlayerVote === player.userId}
                              value={player.userId}
                            />
                          }
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          cursor: 'pointer',
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
                            secondary={player.position === 'GOALKEEPER' ? 'Goleiro' : 'Jogador de Linha'}
                          />
                        </ListItem>
                      ))}
                  </List>
                </RadioGroup>
              </FormControl>
            </CardContent>
          </Card>
        </Container>

      {/* #2178: FixedBottomBar. #2164: tela full-screen (rota fora do AppLayout),
          centraliza no viewport — sem offset de sidebar. */}
      <FixedBottomBar inLayout={false}>
        <Container maxWidth="sm">
          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={!mvpVote || !worstPlayerVote || submitting}
            onClick={handleVote}
            startIcon={submitting ? <CircularProgress size={20} /> : <VoteIcon />}
          >
            {submitting ? 'Enviando...' : 'Enviar Voto'}
          </Button>
        </Container>
      </FixedBottomBar>
    </Box>
  );
};
