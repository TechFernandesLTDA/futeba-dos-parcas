import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  ButtonBase,
  Typography,
  IconButton,
  Avatar,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import Grid from '@mui/material/Unstable_Grid2';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { PageContainer } from '../../components/common/PageContainer';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { getUsersByIds } from '../../utils/userBatch';
import { useHideMobileTopBar } from '../../hooks/useMobileTopBarVisibility';



const logger = createLogger('TacticalBoardScreen');

interface TacticalPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  x: number;
  y: number;
  team: 'A' | 'B';
}

interface RawPlayerData {
  id?: string;
  name?: string;
  photoUrl?: string;
}

interface RawGameData {
  ownerId?: string;
  owner_id?: string;
  team1Players?: string[];
  team1_players?: string[];
  team2Players?: string[];
  team2_players?: string[];
  team1TacticalPositions?: Array<{ userId?: string; user_id?: string; x?: number; y?: number }>;
  team1_tactical_positions?: Array<{ userId?: string; user_id?: string; x?: number; y?: number }>;
  team2TacticalPositions?: Array<{ userId?: string; user_id?: string; x?: number; y?: number }>;
  team2_tactical_positions?: Array<{ userId?: string; user_id?: string; x?: number; y?: number }>;
  tacticalFormationIndex?: number;
  tactical_formation_index?: number;
}

const FORMATIONS = [
  { name: '4-4-2', positions: [[50, 90], [20, 70], [40, 70], [60, 70], [80, 70], [20, 45], [40, 45], [60, 45], [80, 45], [35, 20], [65, 20]] },
  { name: '4-3-3', positions: [[50, 90], [20, 70], [40, 70], [60, 70], [80, 70], [30, 45], [50, 45], [70, 45], [25, 20], [50, 15], [75, 20]] },
  { name: '3-5-2', positions: [[50, 90], [30, 70], [50, 70], [70, 70], [15, 45], [35, 45], [50, 45], [65, 45], [85, 45], [35, 20], [65, 20]] },
];

export const TacticalBoardScreen: React.FC = () => {
  useHideMobileTopBar();
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.tacticalBoard'));
  const navigateBack = useNavigateBack('/?tab=1');
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const showSuccessRef = useRef(showSuccess);
  showSuccessRef.current = showSuccess;

  const [players, setPlayers] = useState<TacticalPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFormation, setSelectedFormation] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [canSave, setCanSave] = useState(false);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false; // #2278: evita setState após unmount

    const fetchPlayers = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists() && !cancelled) {
          const data = snakeToCamel(gameDoc.data()) as RawGameData;
          const ownerId = data.ownerId || data.owner_id;
          const team1PlayerIds = data.team1Players ?? data.team1_players ?? [];
          const team2PlayerIds = data.team2Players ?? data.team2_players ?? [];
          const formationIndex = data.tacticalFormationIndex ?? data.tactical_formation_index ?? 0;
          const normalizedFormationIndex = FORMATIONS[formationIndex] ? formationIndex : 0;
          const team1SavedPositions = data.team1TacticalPositions ?? data.team1_tactical_positions ?? [];
          const team2SavedPositions = data.team2TacticalPositions ?? data.team2_tactical_positions ?? [];
          const usersById = await getUsersByIds([...team1PlayerIds, ...team2PlayerIds]);
          if (cancelled) return;

          setCanSave(user?.id === ownerId);
          setSelectedFormation(normalizedFormationIndex);

          const teamA = team1PlayerIds.map((playerId, index) => {
            const savedPosition = team1SavedPositions.find((position) => (position.userId ?? position.user_id) === playerId);
            const userData = usersById.get(playerId) as RawPlayerData | undefined;
            const fallbackPosition = FORMATIONS[normalizedFormationIndex].positions[index] ?? [50, 90];
            return {
              id: playerId || `a-${index}`,
              name: userData?.name || t('tactical.defaultPlayerName'),
              photoUrl: userData?.photoUrl,
              x: typeof savedPosition?.x === 'number' ? savedPosition.x : fallbackPosition[0],
              y: typeof savedPosition?.y === 'number' ? savedPosition.y : fallbackPosition[1],
              team: 'A' as const,
            };
          });
          const teamB = team2PlayerIds.map((playerId, index) => {
            const savedPosition = team2SavedPositions.find((position) => (position.userId ?? position.user_id) === playerId);
            const userData = usersById.get(playerId) as RawPlayerData | undefined;
            const fallbackPosition = FORMATIONS[normalizedFormationIndex].positions[index] ?? [50, 10];
            return {
              id: playerId || `b-${index}`,
              name: userData?.name || t('tactical.defaultPlayerName'),
              photoUrl: userData?.photoUrl,
              x: typeof savedPosition?.x === 'number' ? savedPosition.x : fallbackPosition[0],
              y: typeof savedPosition?.y === 'number' ? savedPosition.y : 100 - fallbackPosition[1],
              team: 'B' as const,
            };
          });
          setPlayers([...teamA, ...teamB]);
        }
      } catch (error) {
        logger.error('Error fetching players:', error);
        if (!cancelled) {
          setError(t('feedback.tactical.loadError'));
          showErrorRef.current(t('feedback.tactical.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPlayers();
    return () => {
      cancelled = true;
    };
  }, [gameId, retryCount, t, user?.id]);

  const applyFormation = (formationIndex: number) => {
    setSelectedFormation(formationIndex);
    const positions = FORMATIONS[formationIndex].positions;
    setPlayers((prev) => {
      const teamA = prev
        .filter((p) => p.team === 'A')
        .map((player, index) => ({
          ...player,
          x: positions[index]?.[0] ?? player.x,
          y: positions[index]?.[1] ?? player.y,
        }));
      const teamB = prev
        .filter((p) => p.team === 'B')
        .map((player, index) => ({
          ...player,
          x: positions[index]?.[0] ?? player.x,
          y: positions[index] ? 100 - positions[index][1] : player.y,
        }));

      return [...teamA, ...teamB];
    });
  };

  const handleSave = async () => {
    if (!gameId || !canSave || players.length === 0) return;

    setSaving(true);
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        tactical_formation_index: selectedFormation,
        team1_tactical_positions: players
          .filter((player) => player.team === 'A')
          .map((player) => ({ user_id: player.id, x: player.x, y: player.y })),
        team2_tactical_positions: players
          .filter((player) => player.team === 'B')
          .map((player) => ({ user_id: player.id, x: player.x, y: player.y })),
        updated_at: serverTimestamp(),
      });
      showSuccessRef.current(t('tactical.saveSuccess'));
    } catch (error) {
      logger.error('Error saving tactical board:', error);
      showErrorRef.current(t('tactical.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading) {
    return <LoadingState shimmerCount={3} itemType="CARD" />;
  }

  return (
    <Box>
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
          <IconButton onClick={navigateBack} aria-label={t('a11y.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('tactical.title')}
          </Typography>
          <IconButton onClick={() => applyFormation(0)} aria-label={t('a11y.resetFormation')}>
            <RefreshIcon />
          </IconButton>
          <IconButton
            onClick={handleSave}
            aria-label={t('a11y.saveFormation')}
            disabled={!canSave || saving || players.length === 0}
          >
            {saving ? <CircularProgress size={20} /> : <SaveIcon />}
          </IconButton>
        </Box>
      </Box>

      <PageContainer maxWidth="detail">
        <ToggleButtonGroup
          value={selectedFormation}
          exclusive
          onChange={(_, v) => v !== null && applyFormation(v)}
          fullWidth
          sx={{ mb: 2 }}
          aria-label={t('a11y.selectFormation')}
        >
          {FORMATIONS.map((f, i) => (
            <ToggleButton key={f.name} value={i}>
              {f.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Paper
          sx={{
            aspectRatio: '3/4',
            bgcolor: theme.palette.success.dark,
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            mb: 2,
          }}
        >
          {/* Field lines */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              borderTop: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
            }}
          />
          
          {/* Goal areas */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: '25%',
              right: '25%',
              height: '15%',
              borderTop: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
              borderLeft: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
              borderRight: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '25%',
              right: '25%',
              height: '15%',
              borderBottom: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
              borderLeft: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
              borderRight: `2px solid ${alpha(theme.palette.common.white, 0.5)}`,
            }}
          />

          {/* Players */}
          {players.map((player) => (
            <ButtonBase
              key={player.id}
              onClick={() => setSelectedPlayer(player.id)}
              aria-label={t('tactical.selectPlayerAria', { name: player.name })}
              aria-pressed={selectedPlayer === player.id}
              focusRipple
              sx={{
                position: 'absolute',
                left: `${player.x}%`,
                top: `${player.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                transition: (t) => t.transitions.create('all', { duration: t.transitions.duration.shorter }),
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: 0.5,
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.common.white}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Avatar
                src={player.photoUrl}
                alt={player.name}
                sx={{
                  width: selectedPlayer === player.id ? 48 : 36,
                  height: selectedPlayer === player.id ? 48 : 36,
                  border: `2px solid ${player.team === 'A' ? theme.palette.primary.main : theme.palette.secondary.main}`,
                  bgcolor: player.team === 'A' ? alpha(theme.palette.primary.main, 0.8) : alpha(theme.palette.secondary.main, 0.8),
                }}
              >
                {player.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  color: 'common.white',
                  fontSize: theme.typography.caption.fontSize,
                  mt: 0.5,
                  textShadow: `1px 1px 2px ${alpha(theme.palette.common.black, 0.8)}`,
                }}
              >
                {player.name.split(' ')[0]}
              </Typography>
            </ButtonBase>
          ))}

          {/* Ball */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'common.white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* #2293: o círculo de fundo é sempre branco (bola no centro do
                campo). Em dark mode, `text.primary` fica branco → ícone
                invisível. Cor fixa escura garante contraste nos dois temas. */}
            <SoccerIcon sx={{ fontSize: 16, color: 'common.black' }} />
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid xs={6} md={4} lg={3}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                {t('games.teamA')}
              </Typography>
              <Typography variant="body2">
                {t('tactical.playersCount', { count: players.filter((p) => p.team === 'A').length })}
              </Typography>
            </Paper>
          </Grid>
          <Grid xs={6} md={4} lg={3}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" color="secondary" gutterBottom>
                {t('games.teamB')}
              </Typography>
              <Typography variant="body2">
                {t('tactical.playersCount', { count: players.filter((p) => p.team === 'B').length })}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </PageContainer>
    </Box>
  );
};
