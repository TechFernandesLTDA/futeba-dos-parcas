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
  Rating,
  useTheme,
  alpha,
  Fab,
  Grid,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Map as MapIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../../components/common/GameCard';
import { Location } from '../../types/location';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const LocationsMapScreen: React.FC = () => {
  useDocumentTitle('Mapa de Locais');
  const navigate = useNavigate();
  const theme = useTheme();
  useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: mapsLoaded } = useLoadScript({ googleMapsApiKey: apiKey });

  useEffect(() => {
    const locRef = collection(db, 'locations');
    const q = query(locRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        ...snakeToCamel<Location>(d.data()),
        id: d.id,
      }));
      setLocations(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.city?.toLowerCase().includes(searchQuery.toLowerCase())
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
            Quadras Próximas
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar quadras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar quadras"
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
      <Box sx={{ height: 300, position: 'relative' }}>
        {mapsLoaded && apiKey ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={
              filteredLocations.length > 0 && filteredLocations[0].latitude
                ? { lat: filteredLocations[0].latitude, lng: filteredLocations[0].longitude || 0 }
                : { lat: -23.55, lng: -46.63 }
            }
            zoom={12}
          >
            {filteredLocations
              .filter(loc => loc.latitude && loc.longitude)
              .map(loc => (
                <MarkerF
                  key={loc.id}
                  position={{ lat: loc.latitude!, lng: loc.longitude! }}
                  onClick={() => setSelectedLocation(loc)}
                />
              ))}
            {selectedLocation && selectedLocation.latitude && (
              <InfoWindowF
                position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude! }}
                onCloseClick={() => setSelectedLocation(null)}
              >
                <Box sx={{ p: 0.5, maxWidth: 200 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{selectedLocation.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedLocation.address}</Typography>
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
              {filteredLocations.length} quadras cadastradas
            </Typography>
          </Box>
        )}
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : filteredLocations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhuma quadra encontrada
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Adicione quadras para organizarem seus jogos!
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filteredLocations.map((location) => (
              <Grid xs={12} key={location.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.01)' },
                  }}
                  onClick={() => navigate(`/location/${location.id}`)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {location.photoUrl ? (
                        <Box
                          component="img"
                          src={location.photoUrl}
                          alt={location.name}
                          sx={{ width: 80, height: 80, borderRadius: 1, objectFit: 'cover' }}
                        />
                      ) : (
                        <Avatar
                          variant="rounded"
                          sx={{ width: 80, height: 80, bgcolor: theme.palette.primary.main }}
                        >
                          <SoccerIcon />
                        </Avatar>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {location.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {location.address}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Rating value={location.rating || 0} size="small" readOnly />
                          <Typography variant="caption" color="text.secondary">
                            ({location.ratingCount || 0})
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          {location.primaryFieldType && (
                            <Chip label={location.primaryFieldType} size="small" />
                          )}
                          <Chip label={`${location.fieldCount || 1} campos`} size="small" />
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: { xs: 16, sm: 'calc(50% - 240px + 16px)' } }}
        onClick={() => navigate('/location/create')}
        aria-label="Adicionar local"
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
