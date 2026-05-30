import React, { useState } from 'react';
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
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
  Timer as TimerIcon,
  Group as GroupIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { usePublicGames, useJoinPublicGame } from '../../hooks/usePublicGames';
import { EmptyState } from '../../components/common/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Game, FIELD_TYPE_LABELS } from '../../types/game';
import { useTranslation } from 'react-i18next';

export const PublicGamesScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('games.public.title'));
  const goBack = useNavigateBack('/?tab=1');
  const { data: games, loading: isLoading, error, refetch } = usePublicGames('open');
  const joinGame = useJoinPublicGame();
  const [joiningId, setJoiningId] = useState<string | null>(null);

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
        <IconButton onClick={goBack} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          {t('games.public.title')}
        </Typography>
        <IconButton onClick={() => refetch()} aria-label="Atualizar">
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Alert severity="info" icon={<SoccerIcon />} sx={{ mb: 3 }}>
        {t('games.public.info')}
      </Alert>

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

      {!isLoading && !error && (!games || games.length === 0) && (
        <EmptyState
          icon={<SoccerIcon />}
          title={t('games.public.empty')}
          description={t('games.public.emptyDesc')}
        />
      )}

      {!isLoading && !error && games && games.length > 0 && (
        <Stack spacing={2}>
          {games.map((game) => (
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
