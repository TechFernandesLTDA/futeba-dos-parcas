import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Avatar,
  Chip,
  Skeleton,
  useTheme,
  alpha,
  Fab,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  LocationOn as LocationIcon,
  SportsSoccer as SoccerIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState, GameCard } from '../../components/common/GameCard';
import { Game } from '../../types/game';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const PublicGamesMapScreen: React.FC = () => {
  useDocumentTitle('Jogos Públicos');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: mapsLoaded } = useLoadScript({ googleMapsApiKey: apiKey });

  useEffect(() => {
    const gamesRef = collection(db, 'games');
    const q = query(
      gamesRef,
      where('is_public', '==', true),
      where('status', 'in', ['SCHEDULED', 'CONFIRMED']),
      orderBy('date', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs.map((d) => ({
        ...snakeToCamel<Game>(d.data()),
        id: d.id,
      }));
      setGames(gamesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredGames = games.filter((game) =>
    game.locationName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Jogos Públicos
          </Typography>
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
        {mapsLoaded && apiKey ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={
              filteredGames.length > 0 && filteredGames[0].locationLat
                ? { lat: filteredGames[0].locationLat, lng: filteredGames[0].locationLng || 0 }
                : { lat: -23.55, lng: -46.63 }
            }
            zoom={12}
          >
            {filteredGames
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
                <Box sx={{ p: 0.5, maxWidth: 200, cursor: 'pointer' }} onClick={() => navigate(`/game/${selectedGame.id}`)}>
                  <Typography variant="subtitle2" fontWeight={600}>{selectedGame.locationName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedGame.date} às {selectedGame.time} • {selectedGame.playersCount}/{selectedGame.maxPlayers}
                  </Typography>
                </Box>
              </InfoWindowF>
            )}
          </GoogleMap>
        ) : (
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
              {filteredGames.length} jogos públicos encontrados
            </Typography>
          </Box>
        )}
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={6} itemType="GAME" />
        ) : filteredGames.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogo público
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Crie um jogo e torne-o público para todos!
            </Typography>
          </Box>
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

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/game/create')}
        aria-label="Criar novo jogo"
      >
        <SoccerIcon />
      </Fab>
    </Box>
  );
};
