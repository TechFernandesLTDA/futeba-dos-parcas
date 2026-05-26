import React, { useState, useCallback } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Grid,
  Alert,
  Button,
  Chip,
  Divider,
  useTheme,
  useMediaQuery,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Compare as CompareIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQuery } from '@tanstack/react-query';
import { useHeadToHead, HeadToHeadMatch } from '../../hooks/useHeadToHead';
import { PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('HeadToHeadScreen');

interface PlayerSearchResult {
  id: string;
  name: string;
  photoUrl?: string;
  favoriteTeam?: string;
  level: number;
}

async function searchPlayers(term: string): Promise<PlayerSearchResult[]> {
  if (term.trim().length < 2) return [];
  const q = query(
    collection(db, 'users'),
    where('name_lower', '>=', term.toLowerCase()),
    where('name_lower', '<=', term.toLowerCase() + '\uf8ff'),
    where('is_searchable', '==', true),
    orderBy('name_lower'),
    limit(10)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((doc) => {
      const raw = doc.data();
      const data = snakeToCamel(raw) as Record<string, unknown>;
      return {
        id: doc.id,
        name: (data.name as string) || 'Jogador',
        photoUrl: (data.photoUrl as string) || (raw.photo_url as string) || undefined,
        favoriteTeam: (data.favoriteTeam as string) || (raw.favorite_team as string) || undefined,
        level: (data.level as number) || 1,
      };
    });
  } catch (err) {
    logger.error('Error searching players:', err);
    throw err;
  }
}

export const HeadToHeadScreen: React.FC = () => {
  useDocumentTitle('Confronto Direto');
  const goBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));

  const [searchTerm, setSearchTerm] = useState('');
  const [selectingPlayer, setSelectingPlayer] = useState<1 | 2 | null>(null);
  const [player1, setPlayer1] = useState<PlayerSearchResult | null>(null);
  const [player2, setPlayer2] = useState<PlayerSearchResult | null>(null);

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ['playerSearch', searchTerm],
    queryFn: () => searchPlayers(searchTerm),
    enabled: searchTerm.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const { stats, loading, error } = useHeadToHead(player1?.id, player2?.id);

  const handleSelectPlayer = useCallback(
    (player: PlayerSearchResult) => {
      if (selectingPlayer === 1) {
        setPlayer1(player);
      } else if (selectingPlayer === 2) {
        setPlayer2(player);
      }
      setSelectingPlayer(null);
      setSearchTerm('');
    },
    [selectingPlayer]
  );

  const handleClearPlayer = useCallback(
    (which: 1 | 2) => {
      if (which === 1) setPlayer1(null);
      else setPlayer2(null);
    },
    []
  );

  const canCompare = !!player1 && !!player2 && player1.id !== player2.id;

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
          <IconButton
            onClick={goBack}
            aria-label="Voltar"
          >
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1 }}>
            Confronto Direto
          </Typography>
        </Box>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Selecionar Jogadores
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={5}>
                <PlayerSlot
                  label="Jogador 1"
                  player={player1}
                  onSelect={() => setSelectingPlayer(1)}
                  onClear={() => handleClearPlayer(1)}
                />
              </Grid>
              <Grid item xs={2} sx={{ textAlign: 'center' }}>
                <CompareIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                <Typography variant="caption" display="block" color="text.secondary">
                  VS
                </Typography>
              </Grid>
              <Grid item xs={5}>
                <PlayerSlot
                  label="Jogador 2"
                  player={player2}
                  onSelect={() => setSelectingPlayer(2)}
                  onClear={() => handleClearPlayer(2)}
                />
              </Grid>
            </Grid>
            {player1 && player2 && player1.id === player2.id && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Selecione jogadores diferentes para comparar.
              </Alert>
            )}
          </CardContent>
        </Card>

        {selectingPlayer && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Buscar Jogador {selectingPlayer}
              </Typography>
              <TextField
                aria-label="Buscar jogador"
                size="small"
                fullWidth
                placeholder="Digite o nome do jogador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                inputProps={{ maxLength: 200 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searching ? (
                    <InputAdornment position="end">
                      <CircularProgress size={16} />
                    </InputAdornment>
                  ) : searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')} aria-label="Limpar busca" sx={{ minWidth: 44, minHeight: 44 }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              {searchResults.length > 0 && (
                <List disablePadding sx={{ mt: 1 }}>
                  {searchResults.map((p) => (
                    <ListItemButton
                      key={p.id}
                      onClick={() => handleSelectPlayer(p)}
                      disabled={
                        (selectingPlayer === 1 && player2?.id === p.id) ||
                        (selectingPlayer === 2 && player1?.id === p.id)
                      }
                    >
                      <ListItemAvatar>
                        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={40} level={p.level} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {p.name}
                            </Typography>
                            <TeamBadge teamId={p.favoriteTeam} size={18} />
                          </Box>
                        }
                        secondary={`Nível ${p.level}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
              {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  Nenhum jogador encontrado
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {canCompare && !loading && !error && !stats && (
          <EmptyState
            icon={<SoccerIcon />}
            title="Selecione dois jogadores"
            description="Escolha dois jogadores para ver o histórico de confrontos."
          />
        )}

        {canCompare && loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {canCompare && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {canCompare && stats && stats.totalGames === 0 && (
          <EmptyState
            icon={<SoccerIcon />}
            title="Nenhum jogo em comum"
            description="Esses jogadores ainda não jogaram juntos."
          />
        )}

        {canCompare && stats && stats.totalGames > 0 && player1 && player2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Resumo Geral
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="primary">
                        {stats.totalGames}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Jogos
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="error.main">
                        {stats.gamesAgainst}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Adversários
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {stats.gamesTogether}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Mesmo Time
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {stats.gamesAgainst > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Confrontos Diretos
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {stats.p1WinsAgainst}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {player1.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={2} sx={{ textAlign: 'center' }}>
                      <Chip
                        label={`${stats.drawsAgainst}E`}
                        size="small"
                        sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'text.primary' }}
                      />
                    </Grid>
                    <Grid item xs={5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {stats.p2WinsAgainst}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {player2.name}
                      </Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', height: 8 }}>
                      <Box
                        sx={{
                          width: `${stats.gamesAgainst > 0 ? (stats.p1WinsAgainst / stats.gamesAgainst) * 100 : 0}%`,
                          bgcolor: 'success.main',
                        }}
                      />
                      <Box
                        sx={{
                          width: `${stats.gamesAgainst > 0 ? (stats.drawsAgainst / stats.gamesAgainst) * 100 : 0}%`,
                          bgcolor: 'warning.main',
                        }}
                      />
                      <Box
                        sx={{
                          width: `${stats.gamesAgainst > 0 ? (stats.p2WinsAgainst / stats.gamesAgainst) * 100 : 0}%`,
                          bgcolor: 'error.main',
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption">{stats.p1WinRate}%</Typography>
                      <Typography variant="caption">{stats.p2WinRate}%</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Estatísticas
                </Typography>
                <Grid container spacing={2}>
                  <StatCompareRow
                    label="Gols"
                    p1Value={stats.p1TotalGoals}
                    p2Value={stats.p2TotalGoals}
                    icon={<SoccerIcon sx={{ color: theme.palette.primary.main }} />}
                  />
                  <StatCompareRow
                    label="Assistências"
                    p1Value={stats.p1TotalAssists}
                    p2Value={stats.p2TotalAssists}
                    icon={<TrendingIcon sx={{ color: theme.palette.secondary.main }} />}
                  />
                  <StatCompareRow
                    label="MVP"
                    p1Value={stats.p1MvpCount}
                    p2Value={stats.p2MvpCount}
                    icon={<TrophyIcon sx={{ color: theme.palette.warning.main }} />}
                  />
                  <StatCompareRow
                    label="Média Gols/Jogo"
                    p1Value={stats.totalGames > 0 ? (stats.p1TotalGoals / stats.totalGames).toFixed(1) : '0.0'}
                    p2Value={stats.totalGames > 0 ? (stats.p2TotalGoals / stats.totalGames).toFixed(1) : '0.0'}
                  />
                  <StatCompareRow
                    label="Média Assist./Jogo"
                    p1Value={stats.totalGames > 0 ? (stats.p1TotalAssists / stats.totalGames).toFixed(1) : '0.0'}
                    p2Value={stats.totalGames > 0 ? (stats.p2TotalAssists / stats.totalGames).toFixed(1) : '0.0'}
                  />
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Histórico de Partidas
                </Typography>
                {stats.matches.map((match, idx) => (
                  <React.Fragment key={match.gameId}>
                    <MatchTimelineItem match={match} player1Name={player1.name} player2Name={player2.name} />
                    {idx < stats.matches.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          </Box>
        )}
      </Container>
    </Box>
  );
};

const PlayerSlot: React.FC<{
  label: string;
  player: PlayerSearchResult | null;
  onSelect: () => void;
  onClear: () => void;
}> = ({ label, player, onSelect, onClear }) => {
  const theme = useTheme();

  if (player) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={56} level={player.level} />
        <Typography variant="body2" fontWeight={600} noWrap sx={{ mt: 0.5 }}>
          {player.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 0.5 }}>
          <Button size="small" variant="outlined" onClick={onSelect} sx={{ fontSize: '0.7rem', textTransform: 'none', minHeight: 44 }}>
            Trocar
          </Button>
          <IconButton onClick={onClear} aria-label="Remover">
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box
        onClick={onSelect}
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: `2px dashed ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          cursor: 'pointer',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        <SearchIcon sx={{ color: 'text.disabled' }} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {label}
      </Typography>
    </Box>
  );
};

const StatCompareRow: React.FC<{
  label: string;
  p1Value: number | string;
  p2Value: number | string;
  icon?: React.ReactNode;
}> = ({ label, p1Value, p2Value, icon }) => {
  const p1Num = typeof p1Value === 'number' ? p1Value : parseFloat(p1Value);
  const p2Num = typeof p2Value === 'number' ? p2Value : parseFloat(p2Value);
  const p1Highlight = p1Num > p2Num;
  const p2Highlight = p2Num > p1Num;

  return (
    <Grid item xs={12}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          fontWeight={p1Highlight ? 700 : 400}
          color={p1Highlight ? 'primary.main' : 'text.primary'}
          sx={{ width: 40, textAlign: 'right' }}
        >
          {p1Value}
        </Typography>
        {icon && <Box sx={{ fontSize: 16 }}>{icon}</Box>}
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={p2Highlight ? 700 : 400}
          color={p2Highlight ? 'primary.main' : 'text.primary'}
          sx={{ width: 40, textAlign: 'left' }}
        >
          {p2Value}
        </Typography>
      </Box>
    </Grid>
  );
};

const MatchTimelineItem: React.FC<{
  match: HeadToHeadMatch;
  player1Name: string;
  player2Name: string;
}> = ({ match, player1Name, player2Name }) => {
  const theme = useTheme();
  const resultColor = match.draw
    ? theme.palette.warning.main
    : match.p1Won
    ? theme.palette.success.main
    : match.p2Won
    ? theme.palette.error.main
    : theme.palette.text.secondary;
  const resultLabel = match.draw
    ? 'Empate'
    : match.p1Won
    ? `${player1Name} venceu`
    : `${player2Name} venceu`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={match.sameTeam ? 'Mesmo Time' : 'Adversários'}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.75rem',
              bgcolor: match.sameTeam
                ? alpha(theme.palette.success.main, 0.1)
                : alpha(theme.palette.error.main, 0.1),
              color: 'text.primary',
            }}
          />
          {match.groupName && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {match.groupName}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {match.date} • {match.team1Name} {match.team1Score} x {match.team2Score} {match.team2Name}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography variant="caption" fontWeight={600} sx={{ color: resultColor }}>
          {resultLabel}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary">
            {player1Name}: {match.p1Goals}G {match.p1Assists}A
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {player2Name}: {match.p2Goals}G {match.p2Assists}A
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
