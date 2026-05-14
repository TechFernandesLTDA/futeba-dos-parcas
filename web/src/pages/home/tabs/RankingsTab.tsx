import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamificationColors } from '../../../theme';
import { getPositionBadgeStyle } from '../../../utils/gamificationStyle';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Tabs,
  Tab,
  Chip,
  Skeleton,
  useTheme,
  useMediaQuery,
  alpha,
  LinearProgress,
  IconButton,
  Tooltip,
  Fade,
  Alert,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  EmojiEvents,
  MilitaryTech as MilitaryTechIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenIcon,
  SportsSoccer,
  SportsScore,
  AssistWalker,
  SportsMartialArts,
  Whatshot,
  Handshake,
  Shield,
  Star,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where, documentId, QueryConstraint } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { snakeToCamel } from '../../../utils/firestoreHelpers';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { PlayerAvatar } from '../../../components/common/GameCard';
import { PlayerCard } from '../../../components/player/PlayerCard';
import { TeamBadge } from '../../../components/team/TeamBadge';
import { DIVISION_CONFIG, LeagueDivision, getLevelForXp, getXpProgress } from '../../../types/gamification';
import { getLevelBadgeImage } from '../../../utils/levelBadge';
import {
  XP_PARTICIPATION, XP_GOAL, XP_ASSIST, XP_SAVE,
  XP_MVP, XP_WIN, XP_DRAW, XP_STREAK_3, XP_STREAK_5, XP_STREAK_7, XP_STREAK_10,
} from '../../../utils/constants';
import { useGroups } from '../../../hooks/useGroups';
import { createLogger } from '../../../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('RankingsTab');

const spinnerKeyframes = {
  '@keyframes spin': {
    '100%': { transform: 'rotate(360deg)' },
  },
};

interface RankingPlayer {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  favoriteTeam?: string;
  level: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  division: LeagueDivision;
  isCurrentUser?: boolean;
  experiencePoints?: number;
}

// Tabela de XP por ação para referência rápida
const XP_TABLE = [
  { label: 'Participação', xp: XP_PARTICIPATION, Icon: SportsSoccer, color: 'primary' as const },
  { label: 'Gol', xp: XP_GOAL, Icon: SportsScore, color: 'success' as const },
  { label: 'Assistência', xp: XP_ASSIST, Icon: AssistWalker, color: 'info' as const },
  { label: 'Defesa (GK)', xp: XP_SAVE, Icon: Shield, color: 'secondary' as const },
  { label: 'MVP', xp: XP_MVP, Icon: StarIcon, color: 'warning' as const },
  { label: 'Vitória', xp: XP_WIN, Icon: TrophyIcon, color: 'warning' as const },
  { label: 'Empate', xp: XP_DRAW, Icon: Handshake, color: 'default' as const },
  { label: 'Streak 3+', xp: XP_STREAK_3, Icon: Whatshot, color: 'error' as const },
  { label: 'Streak 5+', xp: XP_STREAK_5, Icon: Whatshot, color: 'error' as const },
  { label: 'Streak 7+', xp: XP_STREAK_7, Icon: Whatshot, color: 'error' as const },
  { label: 'Streak 10+', xp: XP_STREAK_10, Icon: SportsMartialArts, color: 'error' as const },
];

// #1217 - Podium section for top 3 players with distinct visual hierarchy
const PodiumSection: React.FC<{
  players: RankingPlayer[];
  showXP: boolean;
  positionChanges: Record<string, number | null>;
  onAvatarClick: (userId: string) => void;
}> = ({ players, showXP, positionChanges, onAvatarClick }) => {
  const theme = useTheme();

  if (players.length === 0) return null;

  const top3 = players.slice(0, 3);
  const podiumConfig = [
    {
      position: 1,
      label: '1º',
      Icon: EmojiEvents,
      size: 64,
      borderColor: gamificationColors.gold,
      bgColor: alpha(gamificationColors.gold, 0.12),
      gradient: `linear-gradient(180deg, ${alpha(gamificationColors.gold, 0.18)}, ${alpha(gamificationColors.gold, 0.04)})`,
      iconColor: gamificationColors.gold,
    },
    {
      position: 2,
      label: '2º',
      Icon: MilitaryTechIcon,
      size: 56,
      borderColor: gamificationColors.silver,
      bgColor: alpha(gamificationColors.silver, 0.12),
      gradient: `linear-gradient(180deg, ${alpha(gamificationColors.silver, 0.15)}, ${alpha(gamificationColors.silver, 0.03)})`,
      iconColor: gamificationColors.silver,
    },
    {
      position: 3,
      label: '3º',
      Icon: Star,
      size: 48,
      borderColor: gamificationColors.bronze,
      bgColor: alpha(gamificationColors.bronze, 0.12),
      gradient: `linear-gradient(180deg, ${alpha(gamificationColors.bronze, 0.15)}, ${alpha(gamificationColors.bronze, 0.03)})`,
      iconColor: gamificationColors.bronze,
    },
  ];

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: { xs: 1, sm: 2 }, mb: 3, mt: 1 }}>
      {podiumConfig.map((config, idx) => {
        const player = top3[idx];
        if (!player) return null;
        const divisionConfig = DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE;
        const change = positionChanges[player.userId];

        return (
          <Card
            key={player.id}
            sx={{
              flex: 1,
              maxWidth: 170,
              background: config.gradient,
              border: `2px solid ${config.borderColor}`,
              borderColor: config.borderColor,
              borderRadius: 2,
              transition: 'transform 0.15s ease',
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            <CardContent sx={{ py: 1.5, textAlign: 'center', '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ mb: 0.5 }}>
                <config.Icon sx={{ color: config.iconColor, fontSize: 22 }} />
              </Box>
              <Typography variant="caption" fontWeight={700} sx={{ color: config.borderColor, mb: 1, display: 'block' }}>
                {config.label}
              </Typography>
              <Box
                onClick={() => onAvatarClick(player.userId)}
                sx={{ cursor: 'pointer', display: 'inline-block' }}
                role="button"
                aria-label={`Ver figurinha de ${player.userName}`}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onAvatarClick(player.userId)}
              >
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <PlayerAvatar
                    name={player.userName}
                    photoUrl={player.userPhoto}
                    size={config.size}
                    level={player.level}
                  />
                  {player.level > 0 && (
                    <Box
                      component="img"
                      src={getLevelBadgeImage(player.level)}
                      loading="lazy"
                      alt={`Nível ${player.level}`}
                      sx={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: `2px solid ${theme.palette.background.paper}`,
                      }}
                    />
                  )}
                </Box>
              </Box>
              <Typography
                variant="body2"
                fontWeight={700}
                noWrap
                sx={{ mt: 1, maxWidth: 130, mx: 'auto' }}
              >
                {player.userName}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <TeamBadge teamId={player.favoriteTeam} size={16} />
                {player.isCurrentUser && (
                  <Chip label="Você" size="small" color="primary" sx={{ height: 16, fontSize: '0.65rem' }} />
                )}
              </Box>
              <Typography variant="subtitle2" fontWeight={700} color={showXP ? 'primary.main' : divisionConfig.color} sx={{ mt: 0.5 }}>
                {(showXP ? (player.experiencePoints || 0) : player.points).toLocaleString('pt-BR')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {showXP ? 'XP' : divisionConfig.label} · Nv. {player.level}
              </Typography>
              {change !== null && change !== 0 && (
                <Typography variant="caption" fontWeight={700} color={change > 0 ? 'success.main' : 'error.main'} sx={{ display: 'block', mt: 0.25 }}>
                  {change > 0 ? '▲' : '▼'} {Math.abs(change)}
                </Typography>
              )}
              {change === 0 && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                  —
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export function RankingsTab() {
    const theme = useTheme();
    const isMd = useMediaQuery(theme.breakpoints.up('md'));
    const navigate = useNavigate();
  const { user } = useAuth();
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const { t } = useTranslation();

  const [tabValue, setTabValue] = useState(0); // 0=Liga, 1=Ranking, 2=XP
  const [players, setPlayers] = useState<RankingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [ligaPositionChanges, setLigaPositionChanges] = useState<Record<string, number | null>>({});
  const [xpPositionChanges, setXpPositionChanges] = useState<Record<string, number | null>>({});
  const { groups: userGroups } = useGroups();

  // Buscar temporada ativa para filtrar season_participation (#1204)
  useEffect(() => {
    const fetchSeason = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'seasons'), where('isActive', '==', true), limit(1)));
        setActiveSeasonId(snap.docs[0]?.id || null);
      } catch (err) {
        logger.error('Error fetching active season:', err);
      }
    };
    fetchSeason();
  }, []);

  const loadData = useCallback(() => {
    setRefreshing(true);
    let cancelled = false;
    const seasonRef = collection(db, 'season_participation');

    const constraints: QueryConstraint[] = [];
    if (activeSeasonId) {
      constraints.push(where('season_id', '==', activeSeasonId));
    }
    if (selectedGroupId) {
      constraints.push(where('group_id', '==', selectedGroupId));
    }
    constraints.push(orderBy('points', 'desc'));
    constraints.push(limit(100));
    const q = query(seasonRef, ...constraints);

    // Alias local para que o ESLint reconheça o padrão showError no catch
    const showError = showErrorRef.current;

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          // Extrair participação e user IDs do snapshot
          const participationDocs = snapshot.docs.map((docSnapshot) => {
            const raw = docSnapshot.data();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = snakeToCamel(raw) as Record<string, any>;
            const userId = data.userId || raw.user_id || docSnapshot.id;
            return { docSnapshot, data, userId };
          });

          // Batch fetch de usuários em chunks de 10 (whereIn limit)
          // Privacidade: jogadores com is_searchable=false ficam ocultos no ranking (#1027 — Privacy by Default)
          const userIds = [...new Set(participationDocs.map((p) => p.userId))];
          const usersMap = new Map<string, { name: string; photoUrl: string | null; xp: number; favoriteTeam: string | null }>();
          const userChunks: string[][] = [];
          for (let i = 0; i < userIds.length; i += 10) {
            userChunks.push(userIds.slice(i, i + 10));
          }
          const chunkResults = await Promise.allSettled(
            userChunks.map((chunk) =>
              getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk), where('is_searchable', '==', true)))
            )
          );

          if (cancelled) return;

          for (const result of chunkResults) {
            if (result.status === 'rejected') continue;
            for (const userDoc of result.value.docs) {
              const d = userDoc.data();
              const xp = (d.experience_points ?? d.experiencePoints ?? 0) as number;
              usersMap.set(userDoc.id, {
                name: (d.name as string) || 'Jogador',
                photoUrl: (d.photo_url as string) || (d.photoUrl as string) || null,
                xp,
                favoriteTeam: ((d.favorite_team as string) || (d.favoriteTeam as string) || null),
              });
            }
          }

          const playersData = participationDocs.map(({ docSnapshot, data, userId }) => {
            const userData = usersMap.get(userId) ?? { name: 'Jogador', photoUrl: null, xp: 0, favoriteTeam: null };
            return {
              id: docSnapshot.id,
              userId,
              userName: userData.name,
              userPhoto: userData.photoUrl || undefined,
              favoriteTeam: userData.favoriteTeam || undefined,
              level: getLevelForXp(userData.xp),
              points: (data.points as number) || 0,
              gamesPlayed: (data.gamesPlayed as number) || (data.games_played as number) || 0,
              wins: (data.wins as number) || 0,
              goals: (data.goals as number) || 0,
              assists: (data.assists as number) || 0,
              mvpCount: (data.mvpCount as number) || (data.mvp_count as number) || 0,
              division: (data.division as string) || 'BRONZE',
              isCurrentUser: userId === user?.id,
              experiencePoints: userData.xp,
            } as RankingPlayer;
          });

          // Deduplicar por userId (manter a entrada com mais pontos)
          const uniqueMap = new Map<string, RankingPlayer>();
          for (const p of playersData) {
            const existing = uniqueMap.get(p.userId);
            if (!existing || p.points > existing.points) {
              uniqueMap.set(p.userId, p);
            }
          }
          const deduplicated = Array.from(uniqueMap.values())
            .sort((a, b) => b.points - a.points);

          if (!cancelled) {
            setPlayers(deduplicated);
            setErrorState(null);

            // #1238 - Position change tracking via localStorage
            let prevLiga: Record<string, number> = {};
            let prevXp: Record<string, number> = {};
            try {
              prevLiga = JSON.parse(localStorage.getItem('rankings_prev_positions_liga') || '{}') as Record<string, number>;
              prevXp = JSON.parse(localStorage.getItem('rankings_prev_positions_xp') || '{}') as Record<string, number>;
            } catch {
              // corrupt data, reset
            }
            const currentLiga: Record<string, number> = {};
            deduplicated.forEach((p, i) => { currentLiga[p.userId] = i + 1; });
            const xpSorted = [...deduplicated].sort((a, b) => (b.experiencePoints || 0) - (a.experiencePoints || 0));
            const currentXp: Record<string, number> = {};
            xpSorted.forEach((p, i) => { currentXp[p.userId] = i + 1; });
            const ligaChanges: Record<string, number | null> = {};
            for (const [uid, pos] of Object.entries(currentLiga)) {
              const prev = prevLiga[uid];
              ligaChanges[uid] = prev !== undefined ? prev - pos : null;
            }
            const xpChanges: Record<string, number | null> = {};
            for (const [uid, pos] of Object.entries(currentXp)) {
              const prev = prevXp[uid];
              xpChanges[uid] = prev !== undefined ? prev - pos : null;
            }
            try {
              localStorage.setItem('rankings_prev_positions_liga', JSON.stringify(currentLiga));
              localStorage.setItem('rankings_prev_positions_xp', JSON.stringify(currentXp));
            } catch {
              // quota exceeded or storage unavailable
            }
            setLigaPositionChanges(ligaChanges);
            setXpPositionChanges(xpChanges);
          }
        } catch (err) {
          logger.error('Erro ao carregar rankings:', err);
          if (!cancelled) {
            showError('Erro ao processar dados do ranking.');
            setErrorState('Erro ao processar dados do ranking.');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      (err) => {
        logger.error('Error in rankings listener:', err);
        showError('Erro ao carregar ranking.');
        setErrorState('Erro ao carregar ranking.');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id, activeSeasonId, selectedGroupId]);

  useEffect(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = loadData();
    return () => unsubscribeRef.current?.();
  }, [loadData]);

  // Posição do usuário atual
  const currentUserRank = players.findIndex(p => p.isCurrentUser) + 1;
  const currentPlayer = players.find(p => p.isCurrentUser);

  const positionChanges = tabValue === 1 ? xpPositionChanges : ligaPositionChanges;

  const getPositionStyle = (position: number) => getPositionBadgeStyle(position, theme);

  // Memoizado: recalcula apenas quando players ou tabValue mudam
  const sortedPlayers = useMemo(() => {
    if (tabValue === 1) {
      // Ranking por XP global
      return [...players].sort((a, b) => (b.experiencePoints || 0) - (a.experiencePoints || 0));
    }
    // Liga por pontos da temporada
    return players;
  }, [players, tabValue]);

  return (
    <Box sx={{ minHeight: '100%' }}>
      {/* Header com tabs */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 0.5 }}>
          <TrophyIcon sx={{ color: 'primary.main', mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            {t('nav.league')}
          </Typography>
          <Tooltip title="Atualizar">
            <IconButton
              onClick={() => { setLoading(true); setErrorState(null); unsubscribeRef.current?.(); unsubscribeRef.current = loadData(); }}
              size="small"
              aria-label="Atualizar rankings"
            >
              <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', ...spinnerKeyframes }} />
            </IconButton>
          </Tooltip>
        </Box>
        {userGroups.length > 0 && (
          <Box sx={{ px: 2, pt: 0.5, pb: 1, overflowX: 'auto' }}>
            <ToggleButtonGroup
              value={selectedGroupId ?? '__global__'}
              exclusive
              onChange={(_, v) => setSelectedGroupId(v === '__global__' ? null : v)}
              size="small"
              sx={{ flexWrap: 'nowrap' }}
            >
              <ToggleButton value="__global__" aria-label="Global" sx={{ px: 1.5, textTransform: 'none', fontWeight: 600 }}>
                Global
              </ToggleButton>
              {userGroups.map((g) => (
                <ToggleButton key={g.id} value={g.id} aria-label={g.name} sx={{ px: 1.5, textTransform: 'none', fontWeight: 600 }}>
                  {g.name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="fullWidth"
          aria-label="Categorias de ranking"
          sx={{ minHeight: 40 }}
        >
          <Tab label={t('nav.league')} sx={{ minHeight: 40, py: 0 }} />
          <Tab label="XP Global" sx={{ minHeight: 40, py: 0 }} />
          <Tab label="Sistema XP" sx={{ minHeight: 40, py: 0 }} />
        </Tabs>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {errorState && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => { setLoading(true); unsubscribeRef.current?.(); unsubscribeRef.current = loadData(); }}>
                Tentar novamente
              </Button>
            }
          >
            {errorState}
          </Alert>
        )}

        {/* Card de posição do usuário atual */}
        {tabValue !== 2 && currentPlayer && (
          <Fade in>
            <Card
              sx={{
                mb: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.main, 0.05)})`,
                border: `2px solid ${theme.palette.primary.main}`,
              }}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ position: 'relative' }}>
                    <PlayerAvatar
                      name={currentPlayer.userName}
                      photoUrl={currentPlayer.userPhoto}
                      size={56}
                      level={currentPlayer.level}
                    />
                    {currentPlayer.level > 0 && (
                      <Box
                        component="img"
                        src={getLevelBadgeImage(currentPlayer.level)}
                        loading="lazy"
                        alt={`Nível ${currentPlayer.level}`}
                        sx={{
                          position: 'absolute',
                          bottom: -4,
                          right: -4,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: `2px solid ${theme.palette.background.paper}`,
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('ranking.myPosition')}
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color="primary.main">
                      #{currentUserRank}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h5" fontWeight={700}>
                      {(tabValue === 1 ? currentPlayer.experiencePoints : currentPlayer.points)?.toLocaleString('pt-BR')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tabValue === 1 ? 'XP Total' : t('ranking.points')}
                    </Typography>
                    {tabValue === 0 && (
                      <Chip
                        label={DIVISION_CONFIG[currentPlayer.division]?.label || 'Bronze'}
                        size="small"
                        sx={{
                          mt: 0.5,
                          bgcolor: alpha(DIVISION_CONFIG[currentPlayer.division]?.color || theme.palette.text.primary, 0.15),
                          color: DIVISION_CONFIG[currentPlayer.division]?.color || theme.palette.text.primary,
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                </Box>
                {/* Barra de progresso de XP */}
                {currentPlayer.experiencePoints !== undefined && (
                  <Box sx={{ mt: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.level')} {currentPlayer.level}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentPlayer.experiencePoints?.toLocaleString('pt-BR')} XP
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getXpProgress(currentPlayer.experiencePoints || 0) * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: 'primary.main',
                        },
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* Aba Sistema XP */}
        {tabValue === 2 && (
          <Fade in>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Como funciona o XP
              </Typography>
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: 0 }}>
                  {XP_TABLE.map((item, index) => (
                    <Box
                      key={item.label}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.5,
                        borderBottom: index < XP_TABLE.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                      }}
                    >
                      <Box sx={{ mr: 1.5, width: 36, display: 'flex', justifyContent: 'center' }}>
                        <item.Icon color={item.color === 'default' ? 'action' : item.color} fontSize="small" />
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1 }} fontWeight={500}>
                        {item.label}
                      </Typography>
                      <Chip
                        label={`+${item.xp} XP`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 700, minWidth: 72 }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                {t('league.divisions')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(Object.entries(DIVISION_CONFIG) as [LeagueDivision, typeof DIVISION_CONFIG[LeagueDivision]][]).map(([key, config]) => (
                  <Card key={key} sx={{ border: `1px solid ${alpha(config.color, 0.3)}` }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <MilitaryTechIcon sx={{ color: config.color, fontSize: 28 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: config.color }}>
                            {config.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {config.minPoints ? `${config.minPoints}+ pontos` : 'Divisão inicial'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {/* Links para telas detalhadas */}
              <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                <Card sx={{ flex: 1 }}>
                  <CardActionArea onClick={() => navigate('/league')} sx={{ p: 2, textAlign: 'center' }}>
                    <MilitaryTechIcon sx={{ fontSize: 32, color: 'primary.main', mb: 0.5 }} />
                    <Typography variant="body2" fontWeight={600}>
                      Liga Completa
                    </Typography>
                    <OpenIcon sx={{ fontSize: 14, color: 'text.disabled', mt: 0.5 }} />
                  </CardActionArea>
                </Card>
                <Card sx={{ flex: 1 }}>
                  <CardActionArea onClick={() => navigate('/level-journey')} sx={{ p: 2, textAlign: 'center' }}>
                    <StarIcon sx={{ fontSize: 32, color: gamificationColors.gold, mb: 0.5 }} />
                    <Typography variant="body2" fontWeight={600}>
                      {t('profile.levelJourney')}
                    </Typography>
                    <OpenIcon sx={{ fontSize: 14, color: 'text.disabled', mt: 0.5 }} />
                  </CardActionArea>
                </Card>
              </Box>
            </Box>
          </Fade>
        )}

        {/* Lista de jogadores (Liga ou XP Global) */}
        {tabValue !== 2 && (
          loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="circular" width={48} height={48} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="40%" />
                    </Box>
                    <Skeleton variant="text" width={40} />
                  </Box>
                </CardContent>
              </Card>
            ))
          ) : sortedPlayers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <TrophyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Nenhum jogador no ranking
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                Os 100 melhores jogadores aparecem aqui. Participe de jogos para entrar no ranking!
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/games')}>
                Ver jogos disponíveis
              </Button>
            </Box>
          ) : (
            <>
              <PodiumSection
                players={sortedPlayers}
                showXP={tabValue === 1}
                positionChanges={positionChanges}
                onAvatarClick={setSelectedPlayerId}
              />
              {sortedPlayers.slice(3).map((player, index) => (
                <RankingCard
                  key={player.id}
                  player={player}
                  position={index + 4}
                  positionStyle={getPositionStyle(index + 4)}
                  showXP={tabValue === 1}
                  onAvatarClick={setSelectedPlayerId}
                  positionChange={positionChanges[player.userId]}
                />
              ))}
            </>
          )
        )}
      </Container>

      {/* Figurinha do jogador */}
      <PlayerCard
        userId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </Box>
  );
}

// Card de ranking individual
const RankingCard = React.memo(function RankingCard({
  player,
  position,
  positionStyle,
  showXP,
  onAvatarClick,
  positionChange,
}: {
  player: RankingPlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
  showXP: boolean;
  onAvatarClick: (userId: string) => void;
  positionChange: number | null;
}) {
  const divisionConfig = DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE;

  return (
    <Card
      sx={{
        mb: 1,
        bgcolor: player.isCurrentUser ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'background.paper',
        border: player.isCurrentUser ? (theme) => `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: player.isCurrentUser ? 'primary.main' : 'divider',
        transition: 'transform 0.15s ease',
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Posição */}
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              flexShrink: 0,
              ...positionStyle,
            }}
          >
            {position <= 3 ? <TrophyIcon sx={{ fontSize: 16 }} /> : position}
          </Box>

          {/* Avatar — clique abre a figurinha do jogador */}
          <Box
            onClick={() => onAvatarClick(player.userId)}
            sx={{ cursor: 'pointer', flexShrink: 0 }}
            role="button"
            aria-label={`Ver figurinha de ${player.userName}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAvatarClick(player.userId)}
          >
            <PlayerAvatar
              name={player.userName}
              photoUrl={player.userPhoto}
              size={44}
              level={player.level}
            />
          </Box>

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ maxWidth: { xs: 80, sm: 140, md: 200 } }}
              >
                {player.userName}
              </Typography>
              <TeamBadge teamId={player.favoriteTeam} size={18} />
              {player.isCurrentUser && (
                <Chip label="Você" size="small" color="primary" sx={{ height: 18, fontSize: '0.75rem' }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" noWrap>
                {player.gamesPlayed.toLocaleString('pt-BR')}J · {player.wins.toLocaleString('pt-BR')}V · {player.goals.toLocaleString('pt-BR')}G
              </Typography>
              {positionChange !== null && positionChange !== 0 && (
                <Typography variant="caption" fontWeight={700} color={positionChange > 0 ? 'success.main' : 'error.main'} sx={{ whiteSpace: 'nowrap' }}>
                  {positionChange > 0 ? '▲' : '▼'} {Math.abs(positionChange)}
                </Typography>
              )}
              {positionChange === 0 && (
                <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                  —
                </Typography>
              )}
            </Box>
          </Box>

          {/* Pontuação */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} color={showXP ? 'primary.main' : divisionConfig.color}>
              {(showXP ? (player.experiencePoints || 0) : player.points).toLocaleString('pt-BR')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {showXP ? 'XP' : divisionConfig.label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});
