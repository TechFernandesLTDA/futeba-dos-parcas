import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { getPositionBadgeStyle } from '../../utils/gamificationStyle';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  alpha,
  List,
  Tooltip,
  Collapse,
  Divider,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useGroupLeague } from '../../hooks/useGroupLeague';
import { useIsGroupMember } from '../../hooks/useGroups';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { HallOfFame } from '../../components/group/HallOfFame';
import { ScreenHeader } from '../../components/common/ScreenHeader';

export const GroupLeagueScreen: React.FC = () => {
  useDocumentTitle('Liga do Grupo');
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();

  const { isMember, loading: memberLoading } = useIsGroupMember(groupId);
  const { standings, seasons, activeSeason, loading, error, refetch } = useGroupLeague(
    groupId,
    user?.id
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSeasonId && activeSeason) {
      setSelectedSeasonId(activeSeason.id);
    }
  }, [activeSeason, selectedSeasonId]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const positions = useMemo(() => {
    const posMap = new Map<string, number>();
    standings.forEach((s, i) => posMap.set(s.id, i + 1));
    return posMap;
  }, [standings]);

  const currentUserStanding = useMemo(
    () => standings.find((s) => s.isCurrentUser),
    [standings]
  );

  const currentUserPosition = useMemo(
    () => (currentUserStanding ? positions.get(currentUserStanding.id) || null : null),
    [currentUserStanding, positions]
  );

  const positionStyleCache = useRef(new Map<number, { bgcolor: string; color: string }>());
  const getPositionStyle = useCallback(
    (position: number) => {
      const cached = positionStyleCache.current.get(position);
      if (cached) return cached;
      const style = getPositionBadgeStyle(position, theme);
      positionStyleCache.current.set(position, style);
      return style;
    },
    [theme]
  );

  if (memberLoading || (!isMember && !memberLoading)) {
    if (!isMember && !memberLoading) {
      return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Você precisa ser membro do grupo para ver a liga.
          </Alert>
          <Button startIcon={<BackIcon />} onClick={goBack}>
            Voltar
          </Button>
        </Container>
      );
    }
  }

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title="Liga do Grupo"
        onBack={goBack}
        actions={
          <IconButton onClick={() => refetch()} aria-label="Atualizar" size="small">
            <RefreshIcon />
          </IconButton>
        }
      />
      {seasons.length > 1 && (
        <Box sx={{ px: 2, pb: 1 }}>
          <FormControl size="small" fullWidth>
            <Select
              value={selectedSeasonId || ''}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              variant="outlined"
              sx={{ fontSize: '0.875rem' }}
            >
              {seasons.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                  {s.isActive ? ' (Ativa)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={8} itemType="RANKING" />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => refetch()}
          />
        ) : standings.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon />}
            title="Liga não iniciada"
            description="A liga do grupo ainda não começou. Os jogos finalizados do grupo serão contabilizados automaticamente."
            actionLabel="Criar Jogo"
            actionIcon={<SoccerIcon />}
            onAction={() => navigate(`/game/create?groupId=${groupId}`)}
          />
        ) : (
          <Box>
            {currentUserStanding && currentUserPosition && (
              <Card sx={{ mb: 2, border: `2px solid ${theme.palette.primary.main}` }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={`${currentUserPosition}º`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700 }}
                    />
                    <PlayerAvatar
                      name={currentUserStanding.userName}
                      photoUrl={currentUserStanding.userPhoto}
                      size={40}
                      level={currentUserStanding.level}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} noWrap>
                        {currentUserStanding.userName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentUserStanding.gamesPlayed} jogos • {currentUserStanding.wins}V
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="primary">
                      {currentUserStanding.points}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}

            <List disablePadding>
              {standings.map((standing) => {
                const position = positions.get(standing.id) ?? -1;
                return (
                  <GroupLeagueItem
                    key={standing.id}
                    standing={standing}
                    position={position}
                    positionStyle={getPositionStyle(position)}
                    isExpanded={expandedId === standing.id}
                    onToggleExpand={handleToggleExpand}
                  />
                );
              })}
            </List>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        <HallOfFame groupId={groupId || ''} />
      </Container>
    </Box>
  );
};

const GroupLeagueItem = React.memo(function GroupLeagueItem({
  standing,
  position,
  positionStyle,
  isExpanded,
  onToggleExpand,
}: {
  standing: {
    id: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    favoriteTeam?: string;
    level: number;
    points: number;
    gamesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goalsScored: number;
    goalsConceded: number;
    goalDifference: number;
    mvpCount: number;
    isCurrentUser?: boolean;
  };
  position: number;
  positionStyle: { bgcolor: string; color: string };
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}) {
  const theme = useTheme();
  const winRate = standing.gamesPlayed > 0 ? Math.round((standing.wins / standing.gamesPlayed) * 100) : 0;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(standing.id);
    },
    [onToggleExpand, standing.id]
  );

  return (
    <Card
      onClick={() => onToggleExpand(standing.id)}
      sx={{
        mb: 1,
        cursor: 'pointer',
        bgcolor: standing.isCurrentUser
          ? (t) => alpha(t.palette.primary.main, 0.1)
          : 'background.paper',
        border: standing.isCurrentUser ? '2px solid' : '1px solid',
        borderColor: standing.isCurrentUser ? 'primary.main' : 'divider',
      }}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={`${position}ª posição`} arrow placement="top">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                ...positionStyle,
              }}
            >
              {position >= 1 && position <= 3 ? <TrophyIcon fontSize="small" /> : position > 0 ? position : '—'}
            </Box>
          </Tooltip>

          <PlayerAvatar
            name={standing.userName}
            photoUrl={standing.userPhoto}
            size={48}
            level={standing.level}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {standing.userName}
              </Typography>
              <TeamBadge teamId={standing.favoriteTeam} size={18} />
              {standing.isCurrentUser && <Chip label="Você" size="small" color="primary" />}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {standing.gamesPlayed}J
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {standing.wins}V {standing.draws}E {standing.losses}D
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {standing.goalsScored}G
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="h6" fontWeight={700} color="primary">
              {standing.points}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pts
            </Typography>
          </Box>

          <IconButton onClick={handleToggle} aria-label={isExpanded ? 'Recolher' : 'Expandir'}>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={isExpanded}>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, textAlign: 'center' }}>
            <StatBox label="Vitórias" value={standing.wins} color={theme.palette.success.main} />
            <StatBox label="Empates" value={standing.draws} color={theme.palette.warning.main} />
            <StatBox label="Derrotas" value={standing.losses} color={theme.palette.error.main} />
            <StatBox label="Gols Pró" value={standing.goalsScored} color={theme.palette.primary.main} />
            <StatBox label="Gols Contra" value={standing.goalsConceded} color={theme.palette.error.main} />
            <StatBox label="Saldo" value={standing.goalDifference >= 0 ? `+${standing.goalDifference}` : standing.goalDifference} color={standing.goalDifference >= 0 ? theme.palette.success.main : theme.palette.error.main} />
            <StatBox label="Win Rate" value={`${winRate}%`} color={theme.palette.info.main} />
            <StatBox label="MVPs" value={standing.mvpCount} color={theme.palette.secondary.main} />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
});

const StatBox = React.memo(function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ color }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
});
