import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Button,
} from '@mui/material';
import PageContainer from '../../components/common/PageContainer';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  SportsSoccer as SoccerIcon,
  Map as MapIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePublicGames } from '../../hooks/usePublicGames';
import { LoadingState, GameCard } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenFab } from '../../components/layout';
import { Game } from '../../types/game';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pageSpacing } from '../../theme/pageTokens';
import { useTranslation } from 'react-i18next';
import { useHideMobileTopBar } from '../../hooks/useMobileTopBarVisibility';

function getPublicGamesMapCenter(
  games: Game[],
  userPosition?: { latitude: number; longitude: number } | null,
) {
  if (userPosition) {
    return {
      lat: userPosition.latitude,
      lng: userPosition.longitude,
    };
  }

  const markers = games.filter(
    (game) => typeof game.locationLat === 'number' && typeof game.locationLng === 'number',
  );
  if (markers.length === 0) return { lat: -23.55, lng: -46.63 };
  if (markers.length === 1) return { lat: markers[0].locationLat!, lng: markers[0].locationLng! };

  const bounds = markers.reduce(
    (acc, game) => ({
      minLat: Math.min(acc.minLat, game.locationLat!),
      maxLat: Math.max(acc.maxLat, game.locationLat!),
      minLng: Math.min(acc.minLng, game.locationLng!),
      maxLng: Math.max(acc.maxLng, game.locationLng!),
    }),
    {
      minLat: markers[0].locationLat!,
      maxLat: markers[0].locationLat!,
      minLng: markers[0].locationLng!,
      maxLng: markers[0].locationLng!,
    },
  );

  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function PublicGamesMapView({
  games,
  onGameClick,
  mapCenter,
}: {
  games: Game[];
  onGameClick: (game: Game) => void;
  mapCenter: { lat: number; lng: number };
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: mapsLoaded } = useLoadScript({ googleMapsApiKey: apiKey });
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  if (!mapsLoaded || !apiKey) {
    return (
      <Box
        sx={{
          height: '100%',
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <MapIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {apiKey ? t('games.public.mapLoading') : t('games.public.mapNoApiKey')}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t('games.public.gamesFound', { count: games.length })}
        </Typography>
      </Box>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={mapCenter}
      zoom={12}
    >
      {games
        .filter(g => g.locationLat && g.locationLng)
        .map(game => (
          <MarkerF
            key={game.id}
            position={{ lat: game.locationLat!, lng: game.locationLng! }}
            onClick={() => setSelectedGame(game)}
          />
        ))}
      {selectedGame && selectedGame.locationLat && (
        <InfoWindowF
          position={{ lat: selectedGame.locationLat, lng: selectedGame.locationLng! }}
          onCloseClick={() => setSelectedGame(null)}
        >
          <Box
            sx={{ p: 0.5, maxWidth: 200, cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            aria-label={t('a11y.openGameDetails')}
            onClick={() => onGameClick(selectedGame)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onGameClick(selectedGame)}
          >
            <Typography variant="subtitle2" fontWeight={600}>{selectedGame.locationName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedGame.date} {t('games.public.dateTimeSeparator')} {selectedGame.time} • {selectedGame.playersCount}/{selectedGame.maxPlayers}
            </Typography>
          </Box>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}

export const PublicGamesMapScreen: React.FC = () => {
  useHideMobileTopBar();
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.publicGames'));
  const navigate = useNavigate();
  const navigateBack = useNavigateBack();
  const theme = useTheme();
  useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number } | null>(null);

  const { games, loading, error, refetch } = usePublicGames('map');

  const filteredGames = games.filter((game) =>
    (game.locationName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const mapCenter = useMemo(
    () => getPublicGamesMapCenter(filteredGames, userPosition),
    [filteredGames, userPosition],
  );

  useEffect(() => {
    if (!navigator.geolocation) return;
    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setUserPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        if (!cancelled) setUserPosition(null);
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 5000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGameClick = (game: Game) => {
    navigate(`/game/${game.id}`);
  };

  return (
    <>
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
            {t('page.title.publicGames')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/game/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {t('games.createGame')}
          </Button>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('placeholder.searchLocationByName')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('a11y.searchGamesByLocation')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>

      {/* Mapa */}
      <Box sx={{ height: 250, position: 'relative' }}>
        <PublicGamesMapView games={filteredGames} onGameClick={handleGameClick} mapCenter={mapCenter} />
      </Box>

      <PageContainer maxWidth="list">
        {error && (
          <ErrorState message={error} onRetry={() => refetch()} />
        )}
        {loading ? (
          <LoadingState shimmerCount={6} itemType="GAME" />
        ) : filteredGames.length === 0 ? (
          <EmptyState
            icon={<SoccerIcon />}
            title={t('empty.noPublicGame')}
            description={t('empty.noPublicGameDesc')}
          />
        ) : (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => navigate(`/game/${game.id}`)}
            />
          ))
        )}
      </PageContainer>

      {/* #2178: ScreenFab padronizado — #2161: acima da bottom nav */}
      <ScreenFab
        icon={<SoccerIcon />}
        aria-label={t('a11y.createNewGame')}
        onClick={() => navigate('/game/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          bottom: { xs: pageSpacing.bottomBarHeight + 16, md: 24 },
          right: { xs: 16, sm: 'max(16px, calc(50% - 300px + 16px))' },
        }}
      />
    </>
  );
};
