import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Paper,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Button,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import PageContainer from '../../components/common/PageContainer';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  LocationOn as LocationIcon,
  Star as StarIcon,
  CalendarMonth as CalendarIcon,
  People as PeopleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';

const logger = createLogger('FieldOwnerDashboardScreen');

interface LocationStats {
  gamesLast30Days: number;
  gamesThisWeek: number;
  averageRating: number;
  totalReviews: number;
  upcomingGames: number;
}

interface LocationData {
  id: string;
  name: string;
  city: string;
  photoUrl?: string;
  fieldCount: number;
  rating: number;
  ratingCount: number;
}

// #2276: interface tipada para o doc locations (substitui Record<string, any>).
interface RawLocationDoc {
  name?: string;
  city?: string;
  photoUrl?: string;
  fieldCount?: number;
  rating?: number;
  ratingCount?: number;
}

interface LocationGameData {
  id: string;
  status?: string;
  dateTime?: Date | null;
  deletedAt?: Date | null;
}

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
};

const getGameDate = (data: Record<string, unknown>) => {
  const explicitDate = toDate(data.date_time ?? data.dateTime);
  if (explicitDate) return explicitDate;

  if (typeof data.date === 'string' && data.date.trim()) {
    const dateTime = `${data.date}T${typeof data.time === 'string' ? data.time : '00:00'}`;
    const parsed = new Date(dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const calculateStats = (locations: LocationData[], games: LocationGameData[]): LocationStats => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const activeGames = games.filter((game) => !game.deletedAt && game.status !== 'CANCELLED');
  const gamesLast30Days = activeGames.filter((game) => game.dateTime && game.dateTime >= thirtyDaysAgo && game.dateTime <= now).length;
  const upcomingGames = activeGames.filter((game) => game.dateTime && game.dateTime > now && ['SCHEDULED', 'CONFIRMED'].includes(game.status || '')).length;
  const gamesThisWeek = activeGames.filter((game) => game.dateTime && game.dateTime >= now && game.dateTime <= weekEnd).length;
  const totalReviews = locations.reduce((sum, location) => sum + (location.ratingCount || 0), 0);
  const averageRating = totalReviews > 0
    ? locations.reduce((sum, location) => sum + ((location.rating || 0) * (location.ratingCount || 0)), 0) / totalReviews
    : 0;

  return {
    gamesLast30Days,
    gamesThisWeek,
    averageRating,
    totalReviews,
    upcomingGames,
  };
};

export const FieldOwnerDashboardScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.fieldOwnerDashboard'));
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/locations');
  const theme = useTheme();
  const { user } = useAuth();
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [stats, setStats] = useState<LocationStats | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [locationGames, setLocationGames] = useState<LocationGameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retryDashboard = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const locationsRef = collection(db, 'locations');
    const locQ = query(locationsRef, where('owner_id', '==', user.id));
    const unsubscribe = onSnapshot(
      locQ,
      (locSnap) => {
        const locs = locSnap.docs.map((d) => {
          const data = snakeToCamel<RawLocationDoc>(d.data());
          return {
            id: d.id,
            name: data.name || t('fieldOwner.fieldNameFallback'),
            city: data.city || '',
            photoUrl: data.photoUrl,
            fieldCount: data.fieldCount || 1,
            rating: data.rating || 0,
            ratingCount: data.ratingCount || 0,
          };
        });
        setLocations(locs);
        setLoading(false);
      },
      (err) => {
        logger.error('Error fetching owner locations:', err);
        showErrorRef.current(t('fieldOwner.loadDashboardError'));
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, retryCount, t]);

  useEffect(() => {
    if (locations.length === 0) {
      setLocationGames([]);
      return;
    }

    const gamesByChunk = new Map<number, LocationGameData[]>();
    const chunks = chunkArray(locations.map((location) => location.id), 10);
    const unsubscribes = chunks.map((locationIds, index) => {
      const gamesRef = collection(db, 'games');
      const gamesQ = query(gamesRef, where('location_id', 'in', locationIds));
      return onSnapshot(
        gamesQ,
        (gameSnap) => {
          gamesByChunk.set(index, gameSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              status: typeof data.status === 'string' ? data.status : undefined,
              dateTime: getGameDate(data),
              deletedAt: toDate(data.deleted_at ?? data.deletedAt),
            };
          }));
          setLocationGames(Array.from(gamesByChunk.values()).flat());
        },
        (err) => {
          logger.error('Error fetching location games:', err);
          showErrorRef.current(t('fieldOwner.loadGamesError'));
          setError(getFirestoreErrorMessage(err));
        }
      );
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [locations, t]);

  useEffect(() => {
    setStats(calculateStats(locations, locationGames));
  }, [locations, locationGames]);

  if (loading) {
    return <LoadingState shimmerCount={4} itemType="CARD" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={retryDashboard} />;
  }

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
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('fieldOwner.title')}
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="dashboard">
        {stats && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {t('fieldOwner.summary')}
              </Typography>
              <Grid container spacing={2}>
                <Grid xs={12} sm={6} md={4} lg={3} xl={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <SoccerIcon color="primary" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.gamesLast30Days}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('fieldOwner.gamesLast30Days')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} sm={6} md={4} lg={3} xl={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <CalendarIcon color="success" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.gamesThisWeek}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('fieldOwner.gamesThisWeek')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} sm={6} md={4} lg={3} xl={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <StarIcon color="warning" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.averageRating.toFixed(1)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('fieldOwner.averageRating')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} sm={6} md={4} lg={3} xl={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <CalendarIcon color="info" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.upcomingGames}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('fieldOwner.upcomingGames')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('fieldOwner.myFieldsCount', { count: locations.length })}
              </Typography>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => navigate('/locations')}
              >
                {t('fieldOwner.manage')}
              </Button>
            </Box>
            
            {locations.length === 0 ? (
              <EmptyState
                icon={<LocationIcon />}
                title={t('empty.noRegisteredField')}
                actionLabel={t('empty.addLocation')}
                onAction={() => navigate('/location/create')}
                animate={false}
                sx={{ py: 3 }}
              />
            ) : (
              <List disablePadding aria-label={t('a11y.myFields')}>
                {locations.map((loc, index) => (
                  <Box key={loc.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        <Chip
                          icon={<StarIcon />}
                          label={loc.rating?.toFixed(1) || 'N/A'}
                          size="small"
                        />
                      }
                    >
                      <ListItemButton
                        onClick={() => navigate(`/location/${loc.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar
                            src={loc.photoUrl}
                            variant="rounded"
                            sx={{ bgcolor: theme.palette.primary.main }}
                          >
                            <SoccerIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={loc.name}
                          secondary={loc.city ? `${loc.city} • ${t('fieldOwner.fieldsCount', { count: loc.fieldCount || 1 })}` : t('fieldOwner.fieldsCount', { count: loc.fieldCount || 1 })}
                        />
                      </ListItemButton>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {t('fieldOwner.quickActions')}
              </Typography>
            <List disablePadding aria-label={t('a11y.quickActions')}>
              <ListItemButton onClick={() => navigate('/location/create')}>
                <ListItemIcon>
                  <LocationIcon />
                </ListItemIcon>
                <ListItemText primary={t('fieldOwner.addNewField')} />
              </ListItemButton>
              <Divider />
              <ListItemButton onClick={() => navigate('/?tab=1')}>
                <ListItemIcon>
                  <CalendarIcon />
                </ListItemIcon>
                <ListItemText primary={t('fieldOwner.viewSchedule')} />
              </ListItemButton>
              <Divider />
              <ListItemButton disabled>
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText primary={t('fieldOwner.managePlayers')} secondary={t('fieldOwner.comingSoon')} />
              </ListItemButton>
            </List>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
};
