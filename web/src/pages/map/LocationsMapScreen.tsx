import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
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
  Button,
  MenuItem,
  Stack,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import PageContainer from '../../components/common/PageContainer';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Map as MapIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { collection, collectionGroup, query, orderBy, onSnapshot, limit, where, getDocs } from 'firebase/firestore';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenFab } from '../../components/layout';
import {
  FIELD_TYPE_CONFIG,
  Field,
  FieldType,
  Location,
  AMENITY_LABELS,
  COMMERCIAL_AMENITIES,
  isLocationCommerciallyAvailable,
  locationHasAmenities,
} from '../../types/location';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';
import { pageSpacing } from '../../theme/pageTokens';

const logger = createLogger('LocationsMapScreen');

function getFieldTypeLabel(type?: FieldType) {
  return FIELD_TYPE_CONFIG[type || 'OUTROS']?.label || FIELD_TYPE_CONFIG.OUTROS.label;
}

function LocationsMapView({ locations, selectedLocation, onLocationSelect }: {
  locations: Location[];
  selectedLocation: Location | null;
  onLocationSelect: (loc: Location | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: mapsLoaded } = useLoadScript({ googleMapsApiKey: apiKey });

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
          {apiKey ? t('locations.mapLoading') : t('locations.mapUnavailable')}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {locations.length} quadras cadastradas
        </Typography>
      </Box>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={
        locations.length > 0 && locations[0].latitude
          ? { lat: locations[0].latitude, lng: locations[0].longitude || 0 }
          : { lat: -23.55, lng: -46.63 }
      }
      zoom={12}
    >
      {locations
        .filter(loc => loc.latitude && loc.longitude)
        .map(loc => (
          <MarkerF
            key={loc.id}
            position={{ lat: loc.latitude!, lng: loc.longitude! }}
            onClick={() => onLocationSelect(loc)}
          />
        ))}
      {selectedLocation && selectedLocation.latitude && (
        <InfoWindowF
          position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude! }}
          onCloseClick={() => onLocationSelect(null)}
        >
          <Box sx={{ p: 0.5, maxWidth: 200 }}>
            <Typography variant="subtitle2" fontWeight={600}>{selectedLocation.name}</Typography>
            <Typography variant="caption" color="text.secondary">{selectedLocation.address}</Typography>
          </Box>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}

export const LocationsMapScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('locations.mapTitle'));
  const navigate = useNavigate();
  const navigateBack = useNavigateBack();
  const theme = useTheme();
  useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState<'ALL' | FieldType>('ALL');
  const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
  const [maxHourlyPrice, setMaxHourlyPrice] = useState('');
  const [minPriceByLocation, setMinPriceByLocation] = useState<Record<string, number>>({});
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  useEffect(() => {
    const locRef = collection(db, 'locations');
    const q = query(locRef, orderBy('name', 'asc'), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({
            ...snakeToCamel<Location>(d.data()),
            id: d.id,
          }))
          .filter(isLocationCommerciallyAvailable);
        setLocations(data);
        setErrorState(null);
        setLoading(false);
      },
      (err) => {
        logger.error('Error in locations map listener:', err);
        showErrorRef.current('Erro ao carregar locais no mapa.');
        setErrorState('Erro ao carregar locais no mapa.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [retryCount]);

  useEffect(() => {
    let cancelled = false;
    const loadFieldPrices = async () => {
      try {
        const prices: Record<string, number> = {};
        const addField = (field: Field) => {
          if (!field.locationId || field.isActive === false || !field.hourlyPrice) return;
          prices[field.locationId] = Math.min(prices[field.locationId] || Number.MAX_SAFE_INTEGER, field.hourlyPrice);
        };
        const subFields = await getDocs(query(collectionGroup(db, 'fields'), where('is_active', '==', true), limit(500)));
        subFields.docs.forEach((d) => addField({ ...snakeToCamel<Field>(d.data()), id: d.id }));
        const rootFields = await getDocs(query(collection(db, 'fields'), where('is_active', '==', true), limit(500)));
        rootFields.docs.forEach((d) => addField({ ...snakeToCamel<Field>(d.data()), id: d.id }));
        if (!cancelled) setMinPriceByLocation(prices);
      } catch (err) {
        logger.error('Error loading field prices for public filters:', err);
      }
    };
    loadFieldPrices();
    return () => { cancelled = true; };
  }, [retryCount]);

  const handleAmenityFilter = (amenity: string) => {
    setAmenityFilters((prev) =>
      prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity],
    );
  };

  const filteredLocations = locations.filter((loc) => {
    const q = searchQuery.trim().toLowerCase();
    const maxPrice = maxHourlyPrice ? Number(maxHourlyPrice.replace(',', '.')) : null;
    const locationPrice = minPriceByLocation[loc.id] || null;
    const matchesSearch = !q ||
      loc.name.toLowerCase().includes(q) ||
      loc.city?.toLowerCase().includes(q) ||
      loc.address?.toLowerCase().includes(q);
    const matchesType = typeFilter === 'ALL' || loc.fieldType === typeFilter || loc.primaryFieldType === typeFilter;
    const matchesPrice = maxPrice === null || !Number.isFinite(maxPrice) || (locationPrice !== null && locationPrice <= maxPrice);
    return matchesSearch && matchesType && matchesPrice && locationHasAmenities(loc, amenityFilters);
  });

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
            Quadras Próximas
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/location/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            Adicionar Local
          </Button>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <Stack spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('placeholder.searchField')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('a11y.searchFields')}
              inputProps={{ maxLength: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select size="small" label="Tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | FieldType)} fullWidth>
                <MenuItem value="ALL">Todos</MenuItem>
                {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((type) => (
                  <MenuItem key={type} value={type}>{FIELD_TYPE_CONFIG[type].label}</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Até R$/h"
                value={maxHourlyPrice}
                onChange={(e) => setMaxHourlyPrice(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
                fullWidth
                inputMode="decimal"
              />
            </Stack>
            <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
              {COMMERCIAL_AMENITIES.map((amenity) => (
                <Chip
                  key={amenity}
                  label={AMENITY_LABELS[amenity] || amenity}
                  size="small"
                  color={amenityFilters.includes(amenity) ? 'primary' : 'default'}
                  variant={amenityFilters.includes(amenity) ? 'filled' : 'outlined'}
                  onClick={() => handleAmenityFilter(amenity)}
                  sx={{ flexShrink: 0 }}
                />
              ))}
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Mapa */}
      <Box sx={{ height: 300, position: 'relative' }}>
        <LocationsMapView locations={filteredLocations} selectedLocation={selectedLocation} onLocationSelect={setSelectedLocation} />
      </Box>

      <PageContainer maxWidth="list">
        {errorState && (
          <ErrorState message={errorState} onRetry={() => { setErrorState(null); setLoading(true); setRetryCount((count) => count + 1); }} />
        )}
        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : filteredLocations.length === 0 ? (
          <EmptyState
            icon={<LocationIcon />}
            title={t('empty.noFieldFound')}
            description={t('empty.noFieldFoundDesc')}
          />
        ) : (
          <Grid container spacing={2}>
            {filteredLocations.map((location) => (
              <Grid xs={12} sm={12} md={6} lg={4} xl={3} key={location.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={location.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/location/${location.id}`);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    transition: (tr) => tr.transitions.create('transform', { duration: tr.transitions.duration.shorter }),
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
                          loading="lazy"
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
                          <Chip label={getFieldTypeLabel(location.primaryFieldType || location.fieldType)} size="small" />
                          <Chip label={`${location.fieldCount || 1} campos`} size="small" />
                          {minPriceByLocation[location.id] && (
                            <Chip
                              label={`desde R$ ${minPriceByLocation[location.id]}/h`}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </PageContainer>

      {/* #2178: ScreenFab padronizado — #2161: acima da bottom nav */}
      <ScreenFab
        icon={<AddIcon />}
        aria-label={t('a11y.addLocation')}
        onClick={() => navigate('/location/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          bottom: { xs: pageSpacing.bottomBarHeight + 16, md: 24 },
          right: { xs: 16, sm: 'max(16px, calc(50% - 300px + 16px))' },
        }}
      />
    </>
  );
};
