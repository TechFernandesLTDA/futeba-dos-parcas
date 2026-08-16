import { useState, useEffect, useRef, useMemo } from 'react';
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
  Divider,
  FormControlLabel,
  Switch,
  Tooltip,
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
  Tune as TuneIcon,
  RestartAlt as ResetIcon,
  AccessTime as OpenNowIcon,
  Place as PlaceIcon,
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
} from '../../types/location';
import {
  PUBLIC_LOCATION_SORT_LABELS,
  PublicLocationFilterState,
  countActivePublicLocationFilters,
  filterAndSortPublicLocations,
  formatHourlyPrice,
  getDistanceKm,
  getPublicLocationAmenities,
  getPublicLocationAreaOptions,
  isPublicLocationOpenAt,
  parseHourlyPriceFilter,
} from './publicLocationFilters';
import { getLocationMapCenter } from './locationMapCenter';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';
import { pageSpacing } from '../../theme/pageTokens';
import { useHideMobileTopBar } from '../../hooks/useMobileTopBarVisibility';

const logger = createLogger('LocationsMapScreen');

const DEFAULT_PUBLIC_LOCATION_FILTERS: PublicLocationFilterState = {
  searchQuery: '',
  typeFilter: 'ALL',
  areaFilter: 'ALL',
  maxHourlyPrice: '',
  amenityFilters: [],
  openNowOnly: false,
  sortBy: 'RELEVANCE',
};

function getFieldTypeLabel(type?: FieldType) {
  return FIELD_TYPE_CONFIG[type || 'OUTROS']?.label || FIELD_TYPE_CONFIG.OUTROS.label;
}

function LocationsMapView({ locations, selectedLocation, onLocationSelect, mapCenter }: {
  locations: Location[];
  selectedLocation: Location | null;
  onLocationSelect: (loc: Location | null) => void;
  mapCenter: { lat: number; lng: number };
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
        <Typography variant="caption" color="text.secondary">
          {locations.length} quadras cadastradas
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
  useHideMobileTopBar();
  const { t } = useTranslation();
  useDocumentTitle(t('locations.mapTitle'));
  const navigate = useNavigate();
  const navigateBack = useNavigateBack();
  const theme = useTheme();
  useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PublicLocationFilterState>(DEFAULT_PUBLIC_LOCATION_FILTERS);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [minPriceByLocation, setMinPriceByLocation] = useState<Record<string, number>>({});
  const [fieldTypesByLocation, setFieldTypesByLocation] = useState<Record<string, FieldType[]>>({});
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number } | null>(null);
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
      const prices: Record<string, number> = {};
      const fieldTypes: Record<string, Set<FieldType>> = {};
      const addField = (field: Field) => {
        if (!field.locationId || field.isActive === false) return;
        if (field.type) {
          fieldTypes[field.locationId] = fieldTypes[field.locationId] || new Set<FieldType>();
          fieldTypes[field.locationId].add(field.type);
        }
        if (!field.hourlyPrice) return;
        prices[field.locationId] = Math.min(prices[field.locationId] || Number.MAX_SAFE_INTEGER, field.hourlyPrice);
      };

      // #3955: a query de collectionGroup("fields") e a de root collection
      // /fields rodam de forma independente. Antes um unico try/catch fazia
      // uma falha (ex.: permission-denied por falta de regra collection-group)
      // abortar o fallback da root collection, deixando os filtros do mapa
      // vazios em silencio. Agora cada falha e registrada e surfaced via toast.
      const [subRes, rootRes] = await Promise.allSettled([
        getDocs(query(collectionGroup(db, 'fields'), where('is_active', '==', true), limit(500))),
        getDocs(query(collection(db, 'fields'), where('is_active', '==', true), limit(500))),
      ]);
      let hasFailure = false;
      if (subRes.status === 'fulfilled') {
        subRes.value.docs.forEach((d) => addField({ ...snakeToCamel<Field>(d.data()), id: d.id }));
      } else {
        hasFailure = true;
        logger.error('Error loading field prices (collectionGroup fields):', subRes.reason);
      }
      if (rootRes.status === 'fulfilled') {
        rootRes.value.docs.forEach((d) => addField({ ...snakeToCamel<Field>(d.data()), id: d.id }));
      } else {
        hasFailure = true;
        logger.error('Error loading field prices (root fields):', rootRes.reason);
      }
      if (!cancelled) {
        setMinPriceByLocation(prices);
        setFieldTypesByLocation(Object.fromEntries(
          Object.entries(fieldTypes).map(([locationId, types]) => [locationId, Array.from(types)]),
        ));
        if (hasFailure) {
          showErrorRef.current('Não foi possível carregar alguns filtros de quadras.');
        }
      }
    };
    loadFieldPrices();
    return () => { cancelled = true; };
  }, [retryCount]);

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

    return () => { cancelled = true; };
  }, []);

  const handleAmenityFilter = (amenity: string) => {
    setFilters((prev) => ({
      ...prev,
      amenityFilters: prev.amenityFilters.includes(amenity)
        ? prev.amenityFilters.filter((item) => item !== amenity)
        : [...prev.amenityFilters, amenity],
    }));
  };

  const publicLocationMetrics = useMemo(() => ({
    minPriceByLocation,
    fieldTypesByLocation,
    userPosition,
  }), [fieldTypesByLocation, minPriceByLocation, userPosition]);

  const areaOptions = useMemo(() => getPublicLocationAreaOptions(locations), [locations]);

  const filteredLocations = useMemo(() => filterAndSortPublicLocations(
    locations,
    filters,
    publicLocationMetrics,
  ), [filters, locations, publicLocationMetrics]);
  const mapCenter = useMemo(
    () => getLocationMapCenter(filteredLocations, userPosition),
    [filteredLocations, userPosition],
  );

  const activeFilterCount = countActivePublicLocationFilters(filters);
  const maxPriceCents = parseHourlyPriceFilter(filters.maxHourlyPrice);

  const resetFilters = () => setFilters(DEFAULT_PUBLIC_LOCATION_FILTERS);

  useEffect(() => {
    if (!selectedLocation) return;
    if (!filteredLocations.some((location) => location.id === selectedLocation.id)) {
      setSelectedLocation(null);
    }
  }, [filteredLocations, selectedLocation]);

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
        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2 }}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 3,
              bgcolor: alpha(theme.palette.background.paper, 0.92),
              boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.3 : 0.08)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TuneIcon color="primary" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      Encontre a quadra ideal
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {filteredLocations.length} de {locations.length} quadra{locations.length !== 1 ? 's' : ''} publicada{locations.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  {activeFilterCount > 0 && (
                    <Chip size="small" color="primary" label={`${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''}`} />
                  )}
                  <Tooltip title="Limpar filtros">
                    <span>
                      <IconButton
                        size="small"
                        onClick={resetFilters}
                        disabled={activeFilterCount === 0}
                        aria-label="Limpar filtros de quadras"
                      >
                        <ResetIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                <Grid container spacing={1}>
                  <Grid xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Buscar"
                      placeholder="Nome, bairro, cidade ou endereço"
                      value={filters.searchQuery}
                      onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
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
                  </Grid>
                  <Grid xs={12} sm={6} md={2}>
                    <TextField
                      select
                      size="small"
                      label="Tipo"
                      value={filters.typeFilter}
                      onChange={(e) => setFilters((prev) => ({ ...prev, typeFilter: e.target.value as 'ALL' | FieldType }))}
                      fullWidth
                    >
                      <MenuItem value="ALL">Todos</MenuItem>
                      {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((type) => (
                        <MenuItem key={type} value={type}>{FIELD_TYPE_CONFIG[type].label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid xs={12} sm={6} md={2}>
                    <TextField
                      select
                      size="small"
                      label="Região"
                      value={filters.areaFilter}
                      onChange={(e) => setFilters((prev) => ({ ...prev, areaFilter: e.target.value }))}
                      fullWidth
                    >
                      <MenuItem value="ALL">Todas</MenuItem>
                      {areaOptions.map((area) => (
                        <MenuItem key={area} value={area}>{area}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid xs={12} sm={6} md={2}>
                    <TextField
                      size="small"
                      label="Até R$/h"
                      placeholder="Ex.: 150"
                      value={filters.maxHourlyPrice}
                      onChange={(e) => setFilters((prev) => ({
                        ...prev,
                        maxHourlyPrice: e.target.value.replace(',', '.').replace(/[^\d.]/g, ''),
                      }))}
                      fullWidth
                      inputMode="decimal"
                      helperText={maxPriceCents ? `Limite ${formatHourlyPrice(maxPriceCents)}/h` : 'Preço máximo por hora'}
                    />
                  </Grid>
                  <Grid xs={12} sm={6} md={2}>
                    <TextField
                      select
                      size="small"
                      label="Ordenar"
                      value={filters.sortBy}
                      onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as PublicLocationFilterState['sortBy'] }))}
                      fullWidth
                    >
                      {Object.entries(PUBLIC_LOCATION_SORT_LABELS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>

                <Divider />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={filters.openNowOnly}
                        onChange={(e) => setFilters((prev) => ({ ...prev, openNowOnly: e.target.checked }))}
                        inputProps={{ 'aria-label': 'Mostrar somente quadras abertas agora' }}
                      />
                    )}
                    label={(
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <OpenNowIcon fontSize="small" color="action" />
                        <Typography variant="body2">Abertas agora</Typography>
                      </Stack>
                    )}
                    sx={{ mr: { sm: 1 }, flexShrink: 0 }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.75,
                      overflowX: { xs: 'auto', md: 'visible' },
                      flexWrap: { xs: 'nowrap', md: 'wrap' },
                      pb: { xs: 0.5, md: 0 },
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {COMMERCIAL_AMENITIES.map((amenity) => {
                      const selected = filters.amenityFilters.includes(amenity);
                      return (
                        <Chip
                          key={amenity}
                          label={AMENITY_LABELS[amenity] || amenity}
                          size="small"
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          onClick={() => handleAmenityFilter(amenity)}
                          sx={{ flexShrink: 0, cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Mapa */}
      <Box sx={{ height: { xs: 240, md: 360 }, position: 'relative' }}>
        <LocationsMapView
          locations={filteredLocations}
          selectedLocation={selectedLocation}
          onLocationSelect={setSelectedLocation}
          mapCenter={mapCenter}
        />
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
            {filteredLocations.map((location) => {
              const minPrice = minPriceByLocation[location.id] || null;
              const priceLabel = formatHourlyPrice(minPrice);
              const distanceKm = getDistanceKm(location, userPosition);
              const openNow = isPublicLocationOpenAt(location);
              const amenityLabels = getPublicLocationAmenities(location)
                .slice(0, 3)
                .map((amenity) => AMENITY_LABELS[amenity] || amenity);
              const locationArea = [location.district || location.neighborhood || location.region, location.city]
                .filter(Boolean)
                .join(', ');

              return (
                <Grid xs={12} sm={12} md={6} lg={4} xl={3} key={location.id}>
                  <Card
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalhes de ${location.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/location/${location.id}`);
                      }
                    }}
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      borderRadius: 3,
                      transition: (tr) => tr.transitions.create(['transform', 'box-shadow', 'border-color'], { duration: tr.transitions.duration.shorter }),
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 16px 32px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.32 : 0.12)}`,
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                      },
                      '&:focus-visible': {
                        outline: `3px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                        outlineOffset: 2,
                      },
                    }}
                    onClick={() => navigate(`/location/${location.id}`)}
                  >
                    <CardContent sx={{ height: '100%' }}>
                      <Box sx={{ display: 'flex', gap: 1.5, height: '100%' }}>
                        {location.photoUrl ? (
                          <Box
                            component="img"
                            src={location.photoUrl}
                            alt={location.name}
                            loading="lazy"
                            sx={{
                              width: { xs: 92, sm: 104 },
                              height: { xs: 104, sm: 116 },
                              borderRadius: 2,
                              objectFit: 'cover',
                              flexShrink: 0,
                              bgcolor: 'action.hover',
                            }}
                          />
                        ) : (
                          <Avatar
                            variant="rounded"
                            sx={{
                              width: { xs: 92, sm: 104 },
                              height: { xs: 104, sm: 116 },
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.primary.main, 0.14),
                              color: 'primary.main',
                              flexShrink: 0,
                            }}
                          >
                            <SoccerIcon />
                          </Avatar>
                        )}
                        <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="flex-start">
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle1" fontWeight={800} noWrap>
                                {location.name}
                              </Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                                <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                                <Typography variant="body2" color="text.secondary" noWrap>
                                  {locationArea || location.address}
                                </Typography>
                              </Stack>
                            </Box>
                            <Chip
                              label={openNow ? 'Aberta' : 'Ver horário'}
                              size="small"
                              color={openNow ? 'success' : 'default'}
                              variant={openNow ? 'filled' : 'outlined'}
                              sx={{ flexShrink: 0 }}
                            />
                          </Stack>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Rating value={location.averageRating || location.rating || 0} size="small" readOnly />
                            <Typography variant="caption" color="text.secondary">
                              {location.ratingCount || location.reviewCount || 0} avaliação{(location.ratingCount || location.reviewCount || 0) !== 1 ? 'ões' : ''}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            <Chip label={getFieldTypeLabel(location.primaryFieldType || location.fieldType)} size="small" />
                            <Chip label={`${location.fieldCount || 1} campo${(location.fieldCount || 1) !== 1 ? 's' : ''}`} size="small" />
                            {priceLabel && (
                              <Chip
                                label={`desde ${priceLabel}/h`}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                            {distanceKm !== null && (
                              <Chip
                                label={`${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>

                          {amenityLabels.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {amenityLabels.join(' · ')}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
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
