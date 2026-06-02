import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  TextField,
  Pagination,
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
  Send as SendIcon,
} from '@mui/icons-material';
import { doc, collection, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { Location, FIELD_TYPE_CONFIG, canManageLocation } from '../../types/location';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCallable } from '../../services/cloudFunctions';

const logger = createLogger('LocationDetailScreen');
const REVIEWS_PER_PAGE = 10;

interface LocationReview {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export const LocationDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.locationDetail'));
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
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
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewCommentError, setReviewCommentError] = useState(false); // #2231

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const locRef = doc(db, 'locations', locationId);
    const unsubscribe = onSnapshot(
      locRef,
      (snap) => {
        if (!snap.exists()) {
          if (!cancelled) { setError('Local não encontrado.'); setLoading(false); }
          return;
        }
        const locData = { ...snakeToCamel<Location>(snap.data()), id: snap.id };
        if (!cancelled) { setLocation(locData); setLoading(false); }
      },
      (err) => {
        logger.error('Erro ao carregar local:', err);
        if (!cancelled) {
          showErrorRef.current('Não foi possível carregar este local.');
          setError('Não foi possível carregar este local.');
          setLoading(false);
        }
      }
    );

    return () => { cancelled = true; unsubscribe(); };
  }, [locationId, reloadKey]);

  useEffect(() => {
    if (!locationId) return;
    const reviewsRef = collection(db, 'locations', locationId, 'reviews');
    const q = query(reviewsRef, orderBy('created_at', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const raw = d.data();
          return {
            ...snakeToCamel(raw),
            id: d.id,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
          };
        }) as LocationReview[];
        setReviews(data);
      },
      (err) => {
        logger.error('Erro ao carregar avaliações:', err);
        showErrorRef.current('Não foi possível carregar as avaliações.');
      }
    );
    return () => unsubscribe();
  }, [locationId]);

  const userCanEdit = !!user && !!location && (user.role === 'ADMIN' || canManageLocation(location, user.id));
  const userCanDelete = !!user && user.role === 'ADMIN';

  // #2224: tela pública. ADMIN/FIELD_OWNER podem voltar à gestão (/locations,
  // rota protegida); demais usuários (deep link, mapa, busca) voltam para o
  // mapa público de locais — nunca para a rota protegida que os jogaria em
  // Home/login.
  const canManageLocations = user?.role === 'ADMIN' || user?.role === 'FIELD_OWNER';
  const locationsListPath = canManageLocations ? '/locations' : '/map/locations';

  const handleDelete = async () => {
    if (!locationId || !location) return;
    setDeleting(true);
    try {
      const deleteLocation = getCallable('deleteLocation');
      await deleteLocation({ locationId });
      showSuccess(`Local "${location.name}" excluído com sucesso.`);
      navigate(locationsListPath);
    } catch (err) {
      logger.error('Erro ao excluir local:', err);
      showError('Erro ao excluir local. Tente novamente.');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !locationId) return;
    if (!newReviewComment.trim()) {
      setReviewCommentError(true); // #2231: feedback visual no campo
      showError('Comentário é obrigatório.');
      return;
    }
    setReviewCommentError(false);
    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'locations', locationId, 'reviews'), {
        user_id: user.id,
        user_name: user.name || 'Anônimo',
        user_photo: user.photoUrl || null,
        rating: newReviewRating,
        comment: newReviewComment.trim(),
        created_at: serverTimestamp(),
      });
      showSuccess('Avaliação enviada!');
      setReviewOpen(false);
      setNewReviewComment('');
      setNewReviewRating(5);
    } catch (err) {
      logger.error('Erro ao enviar avaliação:', err);
      showError('Erro ao enviar avaliação.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderHeader = (title: string) => (
    <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 10, borderBottom: `1px solid ${theme.palette.divider}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
        <IconButton onClick={() => navigate(locationsListPath)} aria-label={t('a11y.back')}><BackIcon /></IconButton>
        <Typography variant="h6" sx={{ ml: 1, flex: 1 }} noWrap>{title}</Typography>
        {userCanEdit && location && (
          <IconButton onClick={() => navigate(`/location/${location.id}/edit`)} aria-label={t('a11y.editLocation')}><EditIcon /></IconButton>
        )}
        {userCanDelete && location && (
          <IconButton onClick={() => setDeleteOpen(true)} aria-label={t('a11y.deleteLocation')} color="error"><DeleteIcon /></IconButton>
        )}
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box>
        {renderHeader('Carregando...')}
        <Container maxWidth="md" sx={{ py: 2 }}><LoadingState shimmerCount={5} itemType="CARD" /></Container>
      </Box>
    );
  }

  if (error || !location) {
    return (
      <Box>
        {renderHeader('Local')}
        <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
          <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>{error || 'Local não encontrado'}</Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
            <Button variant="outlined" onClick={() => navigate(locationsListPath)}>Ver todos os locais</Button>
            {error && <Button variant="contained" onClick={() => setReloadKey((k) => k + 1)}>Tentar novamente</Button>}
          </Box>
        </Container>
      </Box>
    );
  }

  const averageRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : location.averageRating || location.rating || 0;
  const reviewCount = reviews.length || location.reviewCount || location.ratingCount || 0;
  const fullAddress = [location.address, location.district, location.city, location.state].filter(Boolean).join(', ');
  const fieldTypeLabel = location.fieldType ? FIELD_TYPE_CONFIG[location.fieldType]?.label || location.fieldType : 'Campo';

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const pagedReviews = reviews.slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE);

  return (
    <Box sx={{ pb: 4 }}>
      {renderHeader(location.name)}
      <Container maxWidth="md" sx={{ py: 2 }}>
        {!location.isVerified && <Alert severity="info" sx={{ mb: 2 }}>Este local ainda não foi verificado.</Alert>}

        <Card sx={{ mb: 2 }}>
          {location.photoUrl && <Box component="img" src={location.photoUrl} alt={location.name} loading="lazy" sx={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />}
          <CardContent>
            <Typography variant="h5" fontWeight={700} gutterBottom>{location.name}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Rating value={averageRating} precision={0.5} readOnly size="small" />
              <Typography variant="body2" color="text.secondary">{averageRating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'})</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
              <LocationIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
              <Typography variant="body2" color="text.secondary">{fullAddress}</Typography>
            </Box>
            {location.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PhoneIcon color="action" fontSize="small" />
                <Typography variant="body2" component="a" href={`tel:${location.phone}`} color="primary" sx={{ textDecoration: 'none' }}>{location.phone}</Typography>
              </Box>
            )}
            {location.website && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WebsiteIcon color="action" fontSize="small" />
                <Typography variant="body2" component="a" href={location.website} target="_blank" rel="noopener noreferrer" color="primary" sx={{ textDecoration: 'none', wordBreak: 'break-all' }}>{location.website}</Typography>
              </Box>
            )}
            {location.description && <Typography variant="body2" sx={{ mt: 2 }}>{location.description}</Typography>}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Características</Typography>
            <Grid container spacing={1.5}>
              <Grid xs={6} sm={4}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <SoccerIcon color="primary" />
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{fieldTypeLabel}</Typography>
                  <Typography variant="caption" color="text.secondary">{location.fieldCount || 1} {(location.fieldCount || 1) === 1 ? 'campo' : 'campos'}</Typography>
                </Paper>
              </Grid>
              {location.playersPerTeam && (
                <Grid xs={6} sm={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="primary">{location.playersPerTeam}v{location.playersPerTeam}</Typography>
                    <Typography variant="caption" color="text.secondary">Jogadores</Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasLighting && <Grid xs={6} sm={4}><Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><LightbulbIcon color="warning" /><Typography variant="body2" sx={{ mt: 0.5 }}>Iluminação</Typography></Paper></Grid>}
              {location.hasParking && <Grid xs={6} sm={4}><Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><ParkingIcon color="info" /><Typography variant="body2" sx={{ mt: 0.5 }}>Estacionamento</Typography></Paper></Grid>}
              {location.hasShowers && <Grid xs={6} sm={4}><Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><ShowerIcon color="info" /><Typography variant="body2" sx={{ mt: 0.5 }}>Vestiários</Typography></Paper></Grid>}
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>Avaliações ({reviews.length})</Typography>
              {user && <Button size="small" startIcon={<ReviewIcon />} onClick={() => setReviewOpen(true)} sx={{ minHeight: 44 }}>Avaliar</Button>}
            </Box>
            {reviews.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <StarIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">Nenhuma avaliação ainda</Typography>
              </Box>
            ) : (
              <>
                <List disablePadding aria-label={t('a11y.locationReviews')}>
                  {pagedReviews.map((review, index) => (
                    <Box key={review.id}>
                      {index > 0 && <Divider sx={{ my: 1 }} />}
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Avatar src={review.userPhoto} alt={review.userName ?? ''} sx={{ width: 36, height: 36 }}>{review.userName?.charAt(0)?.toUpperCase()}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">{review.userName}</Typography>
                            <Rating value={review.rating} size="small" readOnly />
                          </Box>
                          <Typography variant="body2" color="text.secondary">{review.comment}</Typography>
                          <Typography variant="caption" color="text.disabled">{review.createdAt.toLocaleDateString('pt-BR')}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </List>
                {totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination count={totalPages} page={reviewPage} onChange={(_, p) => setReviewPage(p)} color="primary" />
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {location.latitude && location.longitude && (
          <Button variant="contained" fullWidth startIcon={<DirectionsIcon />} onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`, '_blank', 'noopener,noreferrer')}>
            Obter Direções
          </Button>
        )}
      </Container>

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} aria-labelledby="delete-detail-title">
        <DialogTitle id="delete-detail-title">{t('locations.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('locations.deleteConfirm', { name: location.name })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting} startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reviewOpen} onClose={() => !submittingReview && setReviewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Avaliar {location.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>Nota:</Typography>
              <Rating value={newReviewRating} onChange={(_, v) => setNewReviewRating(v || 1)} aria-label={t('a11y.reviewRating')} />
            </Box>
            <TextField label="Comentário" required multiline rows={3} value={newReviewComment} onChange={(e) => { setNewReviewComment(e.target.value); if (reviewCommentError) setReviewCommentError(false); }} inputProps={{ maxLength: 500 }} error={reviewCommentError} helperText={reviewCommentError ? 'Comentário é obrigatório' : `${newReviewComment.length}/500`} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)} disabled={submittingReview}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmitReview} disabled={submittingReview || !newReviewComment.trim()} startIcon={submittingReview ? <CircularProgress size={16} /> : <SendIcon />} variant="contained">Enviar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
