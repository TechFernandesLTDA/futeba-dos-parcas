import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Divider,
  Button,
  useTheme,
  Grid,
  Rating,
  Paper,
  List,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Language as WebsiteIcon,
  SportsSoccer as SoccerIcon,
  Star as StarIcon,
  Directions as DirectionsIcon,
  Photo as PhotoIcon,
  Reviews as ReviewIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { Location } from '../../types/location';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('LocationDetailScreen');

interface LocationReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export const LocationDetailScreen: React.FC = () => {
  useDocumentTitle('Detalhes do Local');
  const navigate = useNavigate();
  const theme = useTheme();
  const { locationId } = useParams<{ locationId: string }>();

  const [location, setLocation] = useState<Location | null>(null);
  const [reviews, setReviews] = useState<LocationReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const fetchLocation = async () => {
      try {
        const locDoc = await getDoc(doc(db, 'locations', locationId));
        if (locDoc.exists()) {
          setLocation({ ...snakeToCamel<Location>(locDoc.data()), id: locDoc.id });

          const reviewsRef = collection(db, 'locations', locationId, 'reviews');
          const q = query(reviewsRef, orderBy('created_at', 'desc'), limit(20));
          const reviewsSnap = await getDocs(q);
          const reviewsData = reviewsSnap.docs.map((d) => {
            const raw = d.data();
            return {
              ...snakeToCamel(raw),
              id: d.id,
              createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
            };
          }) as LocationReview[];
          setReviews(reviewsData);
        }
      } catch (error) {
        logger.error('Error fetching location:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [locationId]);

  if (loading) {
    return <LoadingState shimmerCount={5} itemType="CARD" />;
  }

  if (!location) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Local não encontrado
        </Typography>
      </Box>
    );
  }

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }} noWrap>
            {location.name}
          </Typography>
          <IconButton onClick={() => navigate(`/location/${locationId}/photos`)} aria-label="Ver fotos do local">
            <PhotoIcon />
          </IconButton>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2 }}>
          {location.photoUrl && (
            <Box
              component="img"
              src={location.photoUrl}
              alt={location.name}
              sx={{ width: '100%', height: 200, objectFit: 'cover' }}
            />
          )}
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {location.name}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Rating value={averageRating} precision={0.5} readOnly size="small" />
              <Typography variant="body2" color="text.secondary">
                ({reviews.length} avaliações)
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
              <LocationIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {location.address}, {location.city}
              </Typography>
            </Box>

            {location.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PhoneIcon color="action" fontSize="small" />
                <Typography variant="body2">{location.phone}</Typography>
              </Box>
            )}

            {location.website && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WebsiteIcon color="action" fontSize="small" />
                <Typography
                  variant="body2"
                  component="a"
                  href={location.website}
                  target="_blank"
                  color="primary"
                  sx={{ textDecoration: 'none' }}
                >
                  {location.website}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Características
            </Typography>
            <Grid container spacing={1}>
              <Grid xs={6}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <SoccerIcon color="action" />
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {location.fieldType || 'Campo'}
                  </Typography>
                </Paper>
              </Grid>
              <Grid xs={6}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <Typography variant="body1" fontWeight={600}>
                    {location.playersPerTeam || 11}v{location.playersPerTeam || 11}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Jogadores
                  </Typography>
                </Paper>
              </Grid>
              {location.hasLighting && (
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="body2">💡 Iluminação</Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasParking && (
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="body2">🚗 Estacionamento</Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasShowers && (
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="body2">🚿 Vestiários</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Avaliações
              </Typography>
              <Button size="small" startIcon={<ReviewIcon />}>
                Avaliar
              </Button>
            </Box>

            {reviews.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <StarIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Nenhuma avaliação ainda
                </Typography>
              </Box>
            ) : (
              <List disablePadding aria-label="Avaliações do local">
                {reviews.slice(0, 5).map((review, index) => (
                  <Box key={review.id}>
                    {index > 0 && <Divider sx={{ my: 1 }} />}
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36 }}>
                        {review.userName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">{review.userName}</Typography>
                          <Rating value={review.rating} size="small" readOnly />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {review.comment}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Button
          variant="contained"
          fullWidth
          startIcon={<DirectionsIcon />}
          onClick={() => {
            if (location.latitude && location.longitude) {
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`, '_blank');
            }
          }}
        >
          Obter Direções
        </Button>
      </Container>
    </Box>
  );
};
