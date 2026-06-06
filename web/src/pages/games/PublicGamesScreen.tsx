import React, { useState, useMemo } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
  Timer as TimerIcon,
  Group as GroupIcon,
  SportsSoccer as SoccerIcon,
  Wc as GenderIcon,
} from '@mui/icons-material';
import { usePublicGames, useJoinPublicGame } from '../../hooks/usePublicGames';
import { EmptyState } from '../../components/common/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Game, FIELD_TYPE_LABELS, GameGender } from '../../types/game';
import { useTranslation } from 'react-i18next';

export const PublicGamesScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  useDocumentTitle(t('games.public.title'));
  const goBack = useNavigateBack('/?tab=1');
  const { data: games, loading: isLoading, error, refetch } = usePublicGames('open');
  const joinGame = useJoinPublicGame();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<'all' | GameGender>('all');

  // Filtro de gênero no cliente: ausência de gender é tratada como MIXED
  const filteredGames = useMemo(() => {
    if (!games || genderFilter === 'all') return games;
    return games.filter((g: Game) => (g.gender ?? 'MIXED') === genderFilter);
  }, [games, genderFilter]);

  const handleJoin = async (game: Game) => {
    setJoiningId(game.id);
    try {
      await joinGame.mutateAsync(game);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label={t('a11y.back')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          {t('games.public.title')}
        </Typography>
        <IconButton onClick={() => refetch()} aria-label={t('a11y.refresh')}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Alert severity="info" icon={<SoccerIcon />} sx={{ mb: 2 }}>
        {t('games.public.info')}
      </Alert>

      {/* Filtro de gênero */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <GenderIcon fontSize="small" color="action" />
        <ToggleButtonGroup
          value={genderFilter}
          exclusive
          onChange={(_, v: 'all' | GameGender | null) => { if (v !== null) setGenderFilter(v); }}
          size="small"
          aria-label={t('games.genderFilter.all')}
        >
          <ToggleButton value="all" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: '0.8rem' }}>
            {t('games.genderFilter.all')}
          </ToggleButton>
          <ToggleButton value="MALE" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: '0.8rem' }}>
            {t('games.genderFilter.male')}
          </ToggleButton>
          <ToggleButton value="FEMALE" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: '0.8rem' }}>
            {t('games.genderFilter.female')}
          </ToggleButton>
          <ToggleButton value="MIXED" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: '0.8rem' }}>
            {t('games.genderFilter.mixed')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isLoading && (
        <Stack spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="circular" width={56} height={56} />
                  <Box flex={1}>
                    <Skeleton width="60%" height={28} />
                    <Skeleton width="90%" />
                    <Stack direction="row" spacing={1} mt={1}>
                      <Skeleton variant="rounded" width={80} height={24} />
                      <Skeleton variant="rounded" width={100} height={24} />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {!isLoading && error && (
        <Alert severity="error">{error || 'Erro ao carregar peladas.'}</Alert>
      )}

      {!isLoading && !error && (!filteredGames || filteredGames.length === 0) && (
        <EmptyState
          icon={<SoccerIcon />}
          title={t('games.public.empty')}
          description={t('games.public.emptyDesc')}
        />
      )}

      {!isLoading && !error && filteredGames && filteredGames.length > 0 && (
        <Stack spacing={2}>
          {filteredGames.map((game) => (
            <Card key={game.id}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                    <SoccerIcon />
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="h6" noWrap fontWeight="bold">
                      {game.locationName || 'Pelada'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {game.locationAddress || ''}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                      <Chip icon={<CalendarIcon />} label={game.date} size="small" variant="outlined" />
                      <Chip icon={<TimerIcon />} label={game.time} size="small" variant="outlined" />
                      <Chip
                        icon={<SoccerIcon />}
                        label={FIELD_TYPE_LABELS[game.fieldType] || 'Society'}
                        size="small"
                        variant="outlined"
                      />
                      {/* Badge de gênero: exibido apenas para MALE ou FEMALE */}
                      {(game.gender === 'MALE' || game.gender === 'FEMALE') && (
                        <Chip
                          label={game.gender === 'MALE' ? t('games.genderFilter.male') : t('games.genderFilter.female')}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            backgroundColor: alpha(
                              game.gender === 'MALE'
                                ? theme.palette.info.main
                                : theme.palette.secondary.main,
                              0.12
                            ),
                            color: theme.palette.mode === 'dark'
                              ? (game.gender === 'MALE' ? theme.palette.info.light : theme.palette.secondary.light)
                              : (game.gender === 'MALE' ? theme.palette.info.dark : theme.palette.secondary.dark),
                          }}
                        />
                      )}
                      <Chip
                        icon={<GroupIcon />}
                        label={`${game.playersCount ?? 0}/${game.maxPlayers}`}
                        size="small"
                        color={game.playersCount >= game.maxPlayers ? 'error' : 'success'}
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                  <Stack direction="column" spacing={1} alignItems="center">
                    {game.playersCount >= game.maxPlayers ? (
                      <Chip label={t('games.public.full')} color="error" size="small" />
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        disabled={joiningId === game.id}
                        onClick={() => handleJoin(game)}
                        sx={{ minWidth: 100 }}
                      >
                        {joiningId === game.id ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          t('games.public.join')
                        )}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
};
