import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Button,
} from '@mui/material';
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

function PublicGamesMapView({ games, onGameClick }: { games: Game[]; onGameClick: (game: Game) => void }) {
  const theme = useTheme();
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
          {apiKey ? 'Carregando mapa...' : 'Configure VITE_GOOGLE_MAPS_API_KEY para ver o mapa'}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {games.length} jogos públicos encontrados
        </Typography>
      </Box>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={
        games.length > 0 && games[0].locationLat
          ? { lat: games[0].locationLat, lng: games[0].locationLng || 0 }
          : { lat: -23.55, lng: -46.63 }
      }
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
            aria-label="Abrir detalhes do jogo"
            onClick={() => onGameClick(selectedGame)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onGameClick(selectedGame)}
          >
            <Typography variant="subtitle2" fontWeight={600}>{selectedGame.locationName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedGame.date} às {selectedGame.time} • {selectedGame.playersCount}/{selectedGame.maxPlayers}
            </Typography>
          </Box>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}

export const PublicGamesMapScreen: React.FC = () => {
  useDocumentTitle('Jogos Públicos');
  const navigate = useNavigate();
  const navigateBack = useNavigateBack();
  const theme = useTheme();
  useAuth();

  const [searchQuery, setSearchQuery] = useState('');

  const { games, loading, error, refetch } = usePublicGames('map');

  const filteredGames = games.filter((game) =>
    (game.locationName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGameClick = (game: Game) => {
    navigate(`/game/${game.id}`);
  };

  return (
    <Box sx={{ pb: 8 }}>
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
          <IconButton onClick={navigateBack} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Jogos Públicos
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/game/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            Criar Jogo
          </Button>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por local..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar jogos por local"
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
        <PublicGamesMapView games={filteredGames} onGameClick={handleGameClick} />
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {error && (
          <ErrorState message={error} onRetry={() => refetch()} />
        )}
        {loading ? (
          <LoadingState shimmerCount={6} itemType="GAME" />
        ) : filteredGames.length === 0 ? (
          <EmptyState
            icon={<SoccerIcon />}
            title="Nenhum jogo público"
            description="Crie um jogo e torne-o público para todos!"
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
      </Container>

      {/* #2178: ScreenFab padronizado — #2161: acima da bottom nav */}
      <ScreenFab
        icon={<SoccerIcon />}
        aria-label="Criar novo jogo"
        onClick={() => navigate('/game/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          bottom: { xs: pageSpacing.bottomBarHeight + 16, md: 24 },
          right: { xs: 16, sm: 'max(16px, calc(50% - 300px + 16px))' },
        }}
      />
    </Box>
  );
};
