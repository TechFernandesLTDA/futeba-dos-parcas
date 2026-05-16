import { useState, useEffect, useRef } from 'react';
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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Language as WebsiteIcon,
  SportsSoccer as SoccerIcon,
  Star as StarIcon,
  Directions as DirectionsIcon,
  Reviews as ReviewIcon,
  WbIncandescent as LightbulbIcon,
  LocalParking as ParkingIcon,
  Shower as ShowerIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { Location, FIELD_TYPE_CONFIG, canManageLocation } from '../../types/location';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

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
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const { locationId } = useParams<{ locationId: string }>();

  const [location, setLocation] = useState<Location | null>(null);
  const [reviews, setReviews] = useState<LocationReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchLocation = async () => {
      try {
        const locDoc = await getDoc(doc(db, 'locations', locationId));
        if (!locDoc.exists()) {
          if (!cancelled) {
            setError('Local não encontrado.');
            setLoading(false);
          }
          return;
        }
        const locData = { ...snakeToCamel<Location>(locDoc.data()), id: locDoc.id };

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

        if (!cancelled) {
          setLocation(locData);
          setReviews(reviewsData);
          setLoading(false);
        }
      } catch (err) {
        logger.error('Erro ao carregar local:', err);
        if (!cancelled) {
          showErrorRef.current('Não foi possível carregar este local. Verifique sua conexão e tente novamente.');
          setError('Não foi possível carregar este local. Verifique sua conexão e tente novamente.');
          setLoading(false);
        }
      }
    };

    fetchLocation();
    return () => {
      cancelled = true;
    };
  }, [locationId, reloadKey]);

  // Editar: ADMIN ou owner do local podem editar
  const userCanEdit =
    !!user && !!location && (user.role === 'ADMIN' || canManageLocation(location, user.id));
  // Excluir: apenas ADMIN — owners não veem o botão delete (#1025)
  const userCanDelete = !!user && user.role === 'ADMIN';

  const handleDelete = async () => {
    if (!locationId || !location) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'locations', locationId));
      showSuccess(`Local "${location.name}" excluído com sucesso.`);
      navigate('/locations');
    } catch (err) {
      logger.error('Erro ao excluir local:', err);
      showError('Erro ao excluir local. Tente novamente.');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const renderHeader = (title: string) => (
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
        <IconButton onClick={() => navigate('/locations')} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ ml: 1, flex: 1 }} noWrap>
          {title}
        </Typography>
        {userCanEdit && location && (
          <IconButton
            onClick={() => navigate(`/location/${location.id}/edit`)}
            aria-label="Editar local"
          >
            <EditIcon />
          </IconButton>
        )}
        {userCanDelete && location && (
          <IconButton
            onClick={() => setDeleteOpen(true)}
            aria-label="Excluir local"
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box>
        {renderHeader('Carregando...')}
        <Container maxWidth="md" sx={{ py: 2 }}>
          <LoadingState shimmerCount={5} itemType="CARD" />
        </Container>
      </Box>
    );
  }

  if (error || !location) {
    return (
      <Box>
        {renderHeader('Local')}
        <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
          <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {error || 'Local não encontrado'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
            <Button variant="outlined" onClick={() => navigate('/locations')}>
              Ver todos os locais
            </Button>
            {error && (
              <Button variant="contained" onClick={() => setReloadKey((k) => k + 1)}>
                Tentar novamente
              </Button>
            )}
          </Box>
        </Container>
      </Box>
    );
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : location.averageRating || location.rating || 0;
  const reviewCount = reviews.length || location.reviewCount || location.ratingCount || 0;

  const fullAddress = [location.address, location.district, location.city, location.state]
    .filter(Boolean)
    .join(', ');

  const fieldTypeLabel = location.fieldType
    ? FIELD_TYPE_CONFIG[location.fieldType]?.label || location.fieldType
    : 'Campo';

  return (
    <Box sx={{ pb: 4 }}>
      {renderHeader(location.name)}

      <Container maxWidth="md" sx={{ py: 2 }}>
        {!location.isVerified && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Este local ainda não foi verificado.
          </Alert>
        )}

        <Card sx={{ mb: 2 }}>
          {location.photoUrl && (
            <Box
              component="img"
              src={location.photoUrl}
              alt={location.name}
              loading="lazy"
              sx={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
            />
          )}
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              {location.name}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Rating value={averageRating} precision={0.5} readOnly size="small" />
              <Typography variant="body2" color="text.secondary">
                {averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'})
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
              <LocationIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {fullAddress}
              </Typography>
            </Box>

            {location.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PhoneIcon color="action" fontSize="small" />
                <Typography
                  variant="body2"
                  component="a"
                  href={`tel:${location.phone}`}
                  color="primary"
                  sx={{ textDecoration: 'none' }}
                >
                  {location.phone}
                </Typography>
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
                  rel="noopener noreferrer"
                  color="primary"
                  sx={{ textDecoration: 'none', wordBreak: 'break-all' }}
                >
                  {location.website}
                </Typography>
              </Box>
            )}

            {location.description && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                {location.description}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Características
            </Typography>
            <Grid container spacing={1.5}>
              <Grid xs={6} sm={4}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <SoccerIcon color="primary" />
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {fieldTypeLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {location.fieldCount || 1} {(location.fieldCount || 1) === 1 ? 'campo' : 'campos'}
                  </Typography>
                </Paper>
              </Grid>
              {location.playersPerTeam && (
                <Grid xs={6} sm={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="primary">
                      {location.playersPerTeam}v{location.playersPerTeam}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Jogadores
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasLighting && (
                <Grid xs={6} sm={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <LightbulbIcon color="warning" />
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Iluminação
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasParking && (
                <Grid xs={6} sm={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <ParkingIcon color="info" />
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Estacionamento
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasShowers && (
                <Grid xs={6} sm={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <ShowerIcon color="info" />
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Vestiários
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                Avaliações
              </Typography>
              <Button
                size="small"
                startIcon={<ReviewIcon />}
                onClick={() => showInfo('Em breve: avaliar local')}
              >
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

        {location.latitude && location.longitude && (
          <Button
            variant="contained"
            fullWidth
            startIcon={<DirectionsIcon />}
            onClick={() =>
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`,
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            Obter Direções
          </Button>
        )}
      </Container>

      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        aria-labelledby="delete-detail-title"
      >
        <DialogTitle id="delete-detail-title">Excluir local?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir <strong>{location.name}</strong>? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
