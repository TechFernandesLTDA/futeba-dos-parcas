import { useState, useEffect, useRef, useCallback } from 'react';
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
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward,
  ArrowBack,
  Shuffle as ShuffleIcon,
  Save as SaveIcon,
  Balance as BalanceIcon,
  DragIndicator as DragIcon,
  AutoAwesome as AutoAwesomeIcon,
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
import { balancedDraw, PlayerForDraw } from '../../utils/balancedDraw';

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
  const navigateBack = useNavigateBack('/?tab=1');
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
  const [draggedPlayer, setDraggedPlayer] = useState<TeamPlayer | null>(null);
  const [dragFromTeam, setDragFromTeam] = useState<'A' | 'B' | null>(null);
  const [dropTarget, setDropTarget] = useState<'A' | 'B' | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; player: TeamPlayer; team: 'A' | 'B' } | null>(null);
  const touchCloneRef = useRef<HTMLDivElement | null>(null);

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
          const drawPlayers: PlayerForDraw[] = players.map((p) => ({
            id: p.id,
            name: p.name,
            photoUrl: p.photoUrl,
            level: p.level,
            position: p.position === 'GOALKEEPER' ? 'GOALKEEPER' : 'FIELD',
          }));
          const result = balancedDraw(drawPlayers, 2, 1, 'SNAKE_DRAFT');
          const teamAPlayers = players.filter((p) => result.teams[0].players.some((dp) => dp.id === p.id));
          const teamBPlayers = players.filter((p) => result.teams[1].players.some((dp) => dp.id === p.id));
          setTeamA(teamAPlayers);
          setTeamB(teamBPlayers);
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

  const runBalancedDraw = () => {
    const allPlayers = [...teamA, ...teamB];
    const drawPlayers: PlayerForDraw[] = allPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: p.photoUrl,
      level: p.level,
      position: (p.position === 'GOALKEEPER' ? 'GOALKEEPER' : 'FIELD') as 'GOALKEEPER' | 'FIELD',
    }));
    const result = balancedDraw(drawPlayers, 2, 1, 'SNAKE_DRAFT');
    setTeamA(allPlayers.filter((p) => result.teams[0].players.some((dp) => dp.id === p.id)));
    setTeamB(allPlayers.filter((p) => result.teams[1].players.some((dp) => dp.id === p.id)));
  };

  const movePlayer = useCallback((player: TeamPlayer, fromTeam: 'A' | 'B') => {
    if (fromTeam === 'A') {
      setTeamA(teamA.filter((p) => p.id !== player.id));
      setTeamB([...teamB, player]);
    } else {
      setTeamB(teamB.filter((p) => p.id !== player.id));
      setTeamA([...teamA, player]);
    }
  }, [teamA, teamB]);

  const handleDragStart = useCallback((player: TeamPlayer, team: 'A' | 'B') => {
    setDraggedPlayer(player);
    setDragFromTeam(team);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, team: 'A' | 'B') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(team);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetTeam: 'A' | 'B') => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggedPlayer || !dragFromTeam) return;
    if (dragFromTeam === targetTeam) {
      setDraggedPlayer(null);
      setDragFromTeam(null);
      return;
    }
    movePlayer(draggedPlayer, dragFromTeam);
    setDraggedPlayer(null);
    setDragFromTeam(null);
  }, [draggedPlayer, dragFromTeam, movePlayer]);

  const handleDragEnd = useCallback(() => {
    setDraggedPlayer(null);
    setDragFromTeam(null);
    setDropTarget(null);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, player: TeamPlayer, team: 'A' | 'B') => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, player, team };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    if (dx < 10 && dy < 10) return;

    if (!touchCloneRef.current) {
      const clone = document.createElement('div');
      clone.style.position = 'fixed';
      clone.style.zIndex = '10000';
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '0.8';
      clone.style.padding = '8px 16px';
      clone.style.borderRadius = '8px';
      clone.style.backgroundColor = theme.palette.background.paper;
      clone.style.boxShadow = theme.shadows[6];
      clone.textContent = touchStartRef.current.player.name;
      document.body.appendChild(clone);
      touchCloneRef.current = clone;
      setDraggedPlayer(touchStartRef.current.player);
      setDragFromTeam(touchStartRef.current.team);
    }

    if (touchCloneRef.current) {
      touchCloneRef.current.style.left = `${touch.clientX - 50}px`;
      touchCloneRef.current.style.top = `${touch.clientY - 20}px`;
    }

    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const teamCard = elemBelow?.closest('[data-team]');
    if (teamCard) {
      setDropTarget(teamCard.getAttribute('data-team') as 'A' | 'B');
    } else {
      setDropTarget(null);
    }
  }, [theme]);

  const handleTouchEnd = useCallback(() => {
    if (touchCloneRef.current) {
      document.body.removeChild(touchCloneRef.current);
      touchCloneRef.current = null;
    }

    if (draggedPlayer && dragFromTeam && dropTarget && dropTarget !== dragFromTeam) {
      movePlayer(draggedPlayer, dragFromTeam);
    }

    touchStartRef.current = null;
    setDraggedPlayer(null);
    setDragFromTeam(null);
    setDropTarget(null);
  }, [draggedPlayer, dragFromTeam, dropTarget, movePlayer]);

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

  const avgLevelA = teamA.length > 0 ? teamA.reduce((sum, p) => sum + p.level, 0) / teamA.length : 0;
  const avgLevelB = teamB.length > 0 ? teamB.reduce((sum, p) => sum + p.level, 0) / teamB.length : 0;
  const levelDiff = Math.abs(avgLevelA - avgLevelB);
  const balanceRatio = (avgLevelA + avgLevelB) > 0 ? Math.min(avgLevelA, avgLevelB) / Math.max(avgLevelA, avgLevelB) : 1;
  const isBalanced = levelDiff <= 1;

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
          <Tooltip title={t('games.teams.balancedDraw')}>
            <IconButton onClick={runBalancedDraw} aria-label={t('games.teams.balancedDraw')}>
              <AutoAwesomeIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={shuffleTeams} aria-label={t('games.sortTeams')}>
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
            <Card
              data-team="A"
              onDragOver={(e) => handleDragOver(e, 'A')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'A')}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: dropTarget === 'A' ? `2px dashed ${theme.palette.primary.main}` : '2px solid transparent',
                transition: theme.transitions.create('border-color', { duration: theme.transitions.duration.shorter }),
              }}
            >
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
                    draggable
                    onDragStart={() => handleDragStart(player, 'A')}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(e, player, 'A')}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      cursor: 'grab',
                      opacity: draggedPlayer?.id === player.id ? 0.4 : 1,
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                      '&:active': { cursor: 'grabbing' },
                    }}
                    onClick={() => movePlayer(player, 'A')}
                  >
                    <DragIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'grab' }} />
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={32} level={player.level} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {player.name}
                    </Typography>
                    <IconButton color="primary" aria-label={`Mover ${player.name} para Time B`}>
                      <ArrowForward fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                {teamA.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Arraste ou clique para mover jogadores
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={6}>
            <Card
              data-team="B"
              onDragOver={(e) => handleDragOver(e, 'B')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'B')}
              sx={{
                bgcolor: alpha(theme.palette.secondary.main, 0.05),
                border: dropTarget === 'B' ? `2px dashed ${theme.palette.secondary.main}` : '2px solid transparent',
                transition: theme.transitions.create('border-color', { duration: theme.transitions.duration.shorter }),
              }}
            >
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
                    draggable
                    onDragStart={() => handleDragStart(player, 'B')}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(e, player, 'B')}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      cursor: 'grab',
                      opacity: draggedPlayer?.id === player.id ? 0.4 : 1,
                      '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.08) },
                      '&:active': { cursor: 'grabbing' },
                    }}
                    onClick={() => movePlayer(player, 'B')}
                  >
                    <IconButton color="secondary" aria-label={`Mover ${player.name} para Time A`}>
                      <ArrowBack fontSize="small" />
                    </IconButton>
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={32} level={player.level} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {player.name}
                    </Typography>
                    <DragIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'grab' }} />
                  </Box>
                ))}
                {teamB.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Arraste ou clique para mover jogadores
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mt: 2, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BalanceIcon color={isBalanced ? 'success' : 'warning'} />
              <Typography variant="subtitle2" fontWeight={600}>
                Equilíbrio dos Times
              </Typography>
              <Chip
                label={isBalanced ? 'Equilibrado' : 'Desequilibrado'}
                size="small"
                color={isBalanced ? 'success' : 'warning'}
                variant="outlined"
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Time A: Nível médio {avgLevelA.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Time B: Nível médio {avgLevelB.toFixed(1)}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={balanceRatio * 100}
              color={isBalanced ? 'success' : 'warning'}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Arraste os jogadores entre os times ou clique para mover
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
