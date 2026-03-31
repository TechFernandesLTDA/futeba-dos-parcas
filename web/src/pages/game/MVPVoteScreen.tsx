import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Alert,
  Skeleton,
  Chip,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  HowToVote as VoteIcon,
  EmojiEvents as TrophyIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { doc, collection, query, where, onSnapshot, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Game, GameConfirmation } from '../../types/game';
import { PlayerAvatar } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MVPVoteScreen');

export const MVPVoteScreen: React.FC = () => {
  useDocumentTitle('Votação MVP');
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();

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
    });

    return () => {
      unsubscribeGame();
      unsubscribeConfirmations();
    };
  }, [gameId]);

  const handleVote = async () => {
    if (!mvpVote || !gameId || !currentUser) return;

    setSubmitting(true);

    try {
      // Doc ID: {gameId}_{voterId} (determinístico, previne voto duplicado)
      const voteId = `${gameId}_${currentUser.uid}`;
      const voteRef = doc(db, 'mvp_votes', voteId);

      await setDoc(voteRef, {
        voter_id: currentUser.uid,
        game_id: gameId,
        mvp_id: mvpVote,
        best_gk_id: bestGkVote || null,
        worst_player_id: worstPlayerVote || null,
        voted_at: Timestamp.now(),
      }, { merge: true });

      setHasVoted(true);

      setTimeout(() => {
        navigate(`/game/${gameId}`);
      }, 2000);
    } catch (err) {
      logger.error('Error submitting vote:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" />
      </Container>
    );
  }

  if (!game) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">Jogo não encontrado</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
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
          <Typography variant="h6" sx={{ ml: 1 }}>
            Votação MVP
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
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
                  {confirmations.map((player) => (
                    <ListItem
                      key={player.userId}
                      dense
                      onClick={() => setMvpVote(player.userId)}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        cursor: 'pointer',
                        bgcolor: mvpVote === player.userId ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
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
                        primary={player.userName}
                        secondary={player.position === 'GOALKEEPER' ? 'Goleiro' : 'Jogador de Linha'}
                      />
                      <ListItemSecondaryAction>
                        <Radio
                          checked={mvpVote === player.userId}
                          value={player.userId}
                        />
                      </ListItemSecondaryAction>
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
                  🧤 Melhor Goleiro
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
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          bgcolor: bestGkVote === player.userId ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        }}
                      >
                        <ListItemAvatar>
                          <PlayerAvatar
                            name={player.userName}
                            photoUrl={player.userPhoto}
                            size={44}
                          />
                        </ListItemAvatar>
                        <ListItemText primary={player.userName} />
                        <ListItemSecondaryAction>
                          <Radio
                            checked={bestGkVote === player.userId}
                            value={player.userId}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                </List>
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>
      </Container>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: `1px solid ${theme.palette.divider}`,
          p: 2,
          zIndex: 10,
        }}
      >
        <Container maxWidth="sm">
          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={!mvpVote || submitting}
            onClick={handleVote}
            startIcon={submitting ? <CircularProgress size={20} /> : <VoteIcon />}
          >
            {submitting ? 'Enviando...' : 'Enviar Voto'}
          </Button>
        </Container>
      </Box>
    </Box>
  );
};
