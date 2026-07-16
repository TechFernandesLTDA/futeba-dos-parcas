import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Divider,
  Button,
  useTheme,
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
  Chip,
  Stack,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import PageContainer from '../../components/common/PageContainer';
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
  Paid as PaidIcon,
  Groups as GroupsIcon,
  Verified as VerifiedIcon,
  PhotoLibrary as PhotoLibraryIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  History as HistoryIcon,
  AssignmentTurnedIn as ChecklistIcon,
} from '@mui/icons-material';
import { doc, collection, query, orderBy, limit, serverTimestamp, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import {
  Location,
  Field,
  FIELD_TYPE_CONFIG,
  AMENITY_LABELS,
  LOCATION_PUBLICATION_STATUS_LABELS,
  LOCATION_SUBSCRIPTION_STATUS_LABELS,
  canManageLocation,
  getLocationAmenitySet,
  isLocationCommerciallyAvailable,
} from '../../types/location';
import {
  getLocationCommercialIssues,
  getLocationPublicationStatus,
  getLocationQualityChecklist,
  getLocationSubscriptionStatus,
} from './manageLocationFilters';
import { dedupeLocationReviewsByUser, getLocationReviewStats } from './locationReviews';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCallable } from '../../services/cloudFunctions';
import { useBreadcrumbEntityLabel } from '../../contexts/BreadcrumbEntityContext';

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

interface CommercialEventEntry {
  id: string;
  type?: string | null;
  action?: string | null;
  previousPublicationStatus?: string | null;
  nextPublicationStatus?: string | null;
  previousCommercialStatus?: string | null;
  nextCommercialStatus?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  createdAt?: Date | null;
}

interface SubscriptionLedgerEntry {
  id: string;
  type?: string | null;
  amountCents?: number | null;
  periodKey?: string | null;
  previousSubscriptionStatus?: string | null;
  nextSubscriptionStatus?: string | null;
  monthlyFeeCents?: number | null;
  billingDueDay?: number | null;
  actorUserId?: string | null;
  reason?: string | null;
  createdAt?: Date | null;
  effectiveAt?: Date | null;
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
};

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
  const userId = user?.id;

  const [location, setLocation] = useState<Location | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
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
  const [commercialEvents, setCommercialEvents] = useState<CommercialEventEntry[]>([]);
  const [subscriptionLedger, setSubscriptionLedger] = useState<SubscriptionLedgerEntry[]>([]);
  const [commercialHistoryLoading, setCommercialHistoryLoading] = useState(false);
  const [commercialHistoryError, setCommercialHistoryError] = useState<string | null>(null);
  useBreadcrumbEntityLabel('location', locationId, location?.name);

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
          if (!cancelled) { setError(t('feedback.location.notFound')); setLoading(false); }
          return;
        }
        const locData = { ...snakeToCamel<Location>(snap.data()), id: snap.id };
        if (!cancelled) { setLocation(locData); setLoading(false); }
      },
      (err) => {
        logger.error('Erro ao carregar local:', err);
        if (!cancelled) {
          showErrorRef.current('Não foi possível carregar este local.');
          setError(t('feedback.location.loadError'));
          setLoading(false);
        }
      }
    );

    return () => { cancelled = true; unsubscribe(); };
  }, [locationId, reloadKey, t]);

  useEffect(() => {
    if (!locationId || !userId) {
      setReviews([]);
      return undefined;
    }
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
        setReviews(dedupeLocationReviewsByUser(data));
      },
      (err) => {
        logger.error('Erro ao carregar avaliações:', err);
        showErrorRef.current('Não foi possível carregar as avaliações.');
      }
    );
    return () => unsubscribe();
  }, [locationId, userId]);

  useEffect(() => {
    if (!locationId || !userId) {
      setFields([]);
      return undefined;
    }
    const fieldsRef = collection(db, 'locations', locationId, 'fields');
    const q = query(fieldsRef, orderBy('name', 'asc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setFields(snap.docs.map((d) => ({
          ...snakeToCamel<Field>(d.data()),
          id: d.id,
        })));
      },
      (err) => {
        logger.error('Erro ao carregar campos da quadra:', err);
        showErrorRef.current('Não foi possível carregar os campos desta quadra.');
      }
    );
    return () => unsubscribe();
  }, [locationId, userId]);

  const userCanEdit = !!user && !!location && (user.role === 'ADMIN' || canManageLocation(location, user.id));
  const userCanDelete = !!user && user.role === 'ADMIN';

  // #2224: tela pública. ADMIN/FIELD_OWNER podem voltar à gestão (/locations,
  // rota protegida); demais usuários (deep link, mapa, busca) voltam para o
  // mapa público de locais — nunca para a rota protegida que os jogaria em
  // Home/login.
  const canManageLocations = user?.role === 'ADMIN' || user?.role === 'FIELD_OWNER';
  const locationsListPath = canManageLocations ? '/locations' : '/map/locations';

  useEffect(() => {
    if (!locationId || !userCanEdit) {
      setCommercialEvents([]);
      setSubscriptionLedger([]);
      setCommercialHistoryError(null);
      setCommercialHistoryLoading(false);
      return undefined;
    }

    setCommercialHistoryLoading(true);
    setCommercialHistoryError(null);
    let pendingSnapshots = 2;
    const finishSnapshot = () => {
      pendingSnapshots -= 1;
      if (pendingSnapshots <= 0) setCommercialHistoryLoading(false);
    };
    const failSnapshot = (message: string, err: unknown) => {
      logger.error(message, err);
      setCommercialHistoryError('Não foi possível carregar todo o histórico comercial.');
      setCommercialHistoryLoading(false);
    };

    const commercialRef = collection(db, 'locations', locationId, 'commercial_events');
    const commercialQuery = query(commercialRef, orderBy('created_at', 'desc'), limit(20));
    const unsubscribeCommercial = onSnapshot(
      commercialQuery,
      (snap) => {
        setCommercialEvents(snap.docs.map((eventDoc) => {
          const data = snakeToCamel<Record<string, unknown>>(eventDoc.data());
          return {
            id: eventDoc.id,
            type: typeof data.type === 'string' ? data.type : null,
            action: typeof data.action === 'string' ? data.action : null,
            previousPublicationStatus: typeof data.previousPublicationStatus === 'string' ? data.previousPublicationStatus : null,
            nextPublicationStatus: typeof data.nextPublicationStatus === 'string' ? data.nextPublicationStatus : null,
            previousCommercialStatus: typeof data.previousCommercialStatus === 'string' ? data.previousCommercialStatus : null,
            nextCommercialStatus: typeof data.nextCommercialStatus === 'string' ? data.nextCommercialStatus : null,
            actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : null,
            reason: typeof data.reason === 'string' ? data.reason : null,
            createdAt: toDate(data.createdAt),
          };
        }));
        finishSnapshot();
      },
      (err) => failSnapshot('Erro ao carregar eventos comerciais da quadra:', err),
    );

    const ledgerRef = collection(db, 'locations', locationId, 'subscription_ledger');
    const ledgerQuery = query(ledgerRef, orderBy('created_at', 'desc'), limit(20));
    const unsubscribeLedger = onSnapshot(
      ledgerQuery,
      (snap) => {
        setSubscriptionLedger(snap.docs.map((ledgerDoc) => {
          const data = snakeToCamel<Record<string, unknown>>(ledgerDoc.data());
          return {
            id: ledgerDoc.id,
            type: typeof data.type === 'string' ? data.type : null,
            amountCents: typeof data.amountCents === 'number' ? data.amountCents : null,
            periodKey: typeof data.periodKey === 'string' ? data.periodKey : null,
            previousSubscriptionStatus: typeof data.previousSubscriptionStatus === 'string' ? data.previousSubscriptionStatus : null,
            nextSubscriptionStatus: typeof data.nextSubscriptionStatus === 'string' ? data.nextSubscriptionStatus : null,
            monthlyFeeCents: typeof data.monthlyFeeCents === 'number' ? data.monthlyFeeCents : null,
            billingDueDay: typeof data.billingDueDay === 'number' ? data.billingDueDay : null,
            actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : null,
            reason: typeof data.reason === 'string' ? data.reason : null,
            createdAt: toDate(data.createdAt),
            effectiveAt: toDate(data.effectiveAt),
          };
        }));
        finishSnapshot();
      },
      (err) => failSnapshot('Erro ao carregar ledger financeiro da quadra:', err),
    );

    return () => {
      unsubscribeCommercial();
      unsubscribeLedger();
    };
  }, [locationId, userCanEdit]);

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
      showError(t('feedback.location.deleteError'));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const currentUserReview = user
    ? reviews.find((review) => review.userId === user.id)
    : undefined;

  const handleOpenReview = () => {
    setNewReviewRating(currentUserReview?.rating ?? 5);
    setNewReviewComment(currentUserReview?.comment ?? '');
    setReviewCommentError(false);
    setReviewOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!user || !locationId) return;
    if (!newReviewComment.trim()) {
      setReviewCommentError(true); // #2231: feedback visual no campo
      showError(t('feedback.location.commentRequired'));
      return;
    }
    setReviewCommentError(false);
    setSubmittingReview(true);
    try {
      const reviewRef = doc(db, 'locations', locationId, 'reviews', user.id);
      const reviewData = {
        user_name: user.name || 'Anônimo',
        user_photo: user.photoUrl || null,
        rating: newReviewRating,
        comment: newReviewComment.trim(),
      };

      if (currentUserReview) {
        await updateDoc(reviewRef, {
          ...reviewData,
          updated_at: serverTimestamp(),
        });
      } else {
        await setDoc(reviewRef, {
          user_id: user.id,
          ...reviewData,
          created_at: serverTimestamp(),
        });
      }
      showSuccess(t('feedback.location.reviewSuccess'));
      setReviewOpen(false);
      setNewReviewComment('');
      setNewReviewRating(5);
    } catch (err) {
      logger.error('Erro ao enviar avaliação:', err);
      showError(t('feedback.location.reviewError'));
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
      <>
        {renderHeader(t('common.loading'))}
        <PageContainer maxWidth="detail"><LoadingState shimmerCount={5} itemType="CARD" /></PageContainer>
      </>
    );
  }

  if (error || !location) {
    return (
      <>
        {renderHeader(t('locations.title'))}
        <PageContainer maxWidth="detail" sx={{ textAlign: 'center' }}>
          <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>{error || t('locations.notFound')}</Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
            <Button variant="outlined" onClick={() => navigate(locationsListPath)}>{t('locations.viewAll')}</Button>
            {error && <Button variant="contained" onClick={() => setReloadKey((k) => k + 1)}>{t('common.retry')}</Button>}
          </Box>
        </PageContainer>
      </>
    );
  }

  const { averageRating, reviewCount } = getLocationReviewStats(reviews, user?.id, {
    averageRating: location.averageRating || location.rating || 0,
    reviewCount: location.reviewCount || location.ratingCount || 0,
  });
  const fullAddress = [location.address, location.district, location.city, location.state].filter(Boolean).join(', ');
  const fieldTypeLabel = location.fieldType ? FIELD_TYPE_CONFIG[location.fieldType]?.label || location.fieldType : 'Campo';
  const publicationStatus = getLocationPublicationStatus(location);
  const subscriptionStatus = getLocationSubscriptionStatus(location);
  const commerciallyAvailable = isLocationCommerciallyAvailable(location);
  const amenities = Array.from(getLocationAmenitySet(location));
  const photos = Array.from(new Set([location.photoUrl, ...(location.photos || [])].filter(Boolean))) as string[];
  const activeFields = fields.filter((field) => field.isActive !== false);
  const priceValues = activeFields
    .map((field) => field.hourlyPrice)
    .filter((price): price is number => typeof price === 'number' && price > 0);
  const minHourlyPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
  const formatCurrency = (cents: number | null) => {
    if (cents === null) return 'A definir';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };
  const formatMonthlyFee = formatCurrency(typeof location.monthlyFeeCents === 'number' ? location.monthlyFeeCents : null);
  const qualityChecklist = getLocationQualityChecklist(location, fields, photos);
  const completedChecklistCount = qualityChecklist.filter((item) => item.complete).length;
  const commercialIssues = getLocationCommercialIssues(location);
  const commercialHistory = [
    ...commercialEvents.map((event) => ({
      id: `event:${event.id}`,
      kind: 'Evento comercial',
      title: event.action || event.type || 'Decisão comercial',
      detail: [
        event.nextPublicationStatus ? `Publicação: ${event.previousPublicationStatus || 'n/a'} -> ${event.nextPublicationStatus}` : null,
        event.nextCommercialStatus ? `Comercial: ${event.previousCommercialStatus || 'n/a'} -> ${event.nextCommercialStatus}` : null,
        event.reason,
      ].filter(Boolean).join(' · '),
      actorUserId: event.actorUserId,
      createdAt: event.createdAt,
    })),
    ...subscriptionLedger.map((entry) => ({
      id: `ledger:${entry.id}`,
      kind: 'Financeiro',
      title: entry.type || 'Evento financeiro',
      detail: [
        entry.periodKey ? `Período ${entry.periodKey}` : null,
        typeof entry.amountCents === 'number' ? formatCurrency(entry.amountCents) : null,
        entry.nextSubscriptionStatus ? `Status: ${entry.previousSubscriptionStatus || 'n/a'} -> ${entry.nextSubscriptionStatus}` : null,
        typeof entry.monthlyFeeCents === 'number' ? `Mensalidade ${formatCurrency(entry.monthlyFeeCents)}` : null,
        entry.billingDueDay ? `Vence dia ${entry.billingDueDay}` : null,
        entry.reason,
      ].filter(Boolean).join(' · '),
      actorUserId: entry.actorUserId,
      createdAt: entry.createdAt || entry.effectiveAt,
    })),
  ].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, 20);

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const pagedReviews = reviews.slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE);

  return (
    <>
      {renderHeader(location.name)}
      <PageContainer maxWidth="detail">
        {!location.isVerified && <Alert severity="info" sx={{ mb: 2 }}>Este local ainda não foi verificado.</Alert>}

        {userCanEdit && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Alert severity={commerciallyAvailable ? 'success' : 'warning'}>
                  {commerciallyAvailable
                    ? 'Quadra disponível para seleção dos usuários.'
                    : 'Quadra ainda não está totalmente disponível para os usuários.'}
                </Alert>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">Central da quadra</Typography>
                    <Typography variant="h6" fontWeight={700}>{location.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Visualize, edite e acompanhe cadastro, cobrança, equipe e campos em um só lugar.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/location/${location.id}/edit`)}>
                      Editar cadastro completo
                    </Button>
                    <Button variant="outlined" startIcon={<GroupsIcon />} onClick={() => navigate('/locations')}>
                      Dono, gerentes e mensalidade
                    </Button>
                    {user?.role === 'ADMIN' && (
                      <Button variant="outlined" startIcon={<GroupsIcon />} onClick={() => navigate('/admin/users')}>
                        Usuários
                      </Button>
                    )}
                  </Stack>
                </Box>
                <Grid container spacing={1.5}>
                  <Grid xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                      <VerifiedIcon color={commerciallyAvailable ? 'success' : 'warning'} />
                      <Typography variant="caption" color="text.secondary" display="block">Publicação</Typography>
                      <Typography variant="subtitle2">{LOCATION_PUBLICATION_STATUS_LABELS[publicationStatus]}</Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                      <PaidIcon color={subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL' ? 'success' : 'warning'} />
                      <Typography variant="caption" color="text.secondary" display="block">Mensalidade</Typography>
                      <Typography variant="subtitle2">{LOCATION_SUBSCRIPTION_STATUS_LABELS[subscriptionStatus]}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatMonthlyFee}</Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                      <GroupsIcon color="primary" />
                      <Typography variant="caption" color="text.secondary" display="block">Time operacional</Typography>
                      <Typography variant="subtitle2">{1 + (location.managers?.length || 0)} pessoa(s)</Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                      <SoccerIcon color="primary" />
                      <Typography variant="caption" color="text.secondary" display="block">Campos ativos</Typography>
                      <Typography variant="subtitle2">{activeFields.length || location.fieldCount || 0}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {minHourlyPrice === null ? 'Preço a definir' : `Desde ${formatCurrency(minHourlyPrice)}/h`}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        )}

        {userCanEdit && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid xs={12} md={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ChecklistIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={700}>Checklist de publicação</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {completedChecklistCount}/{qualityChecklist.length} itens completos para uma quadra confiável.
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={completedChecklistCount === qualityChecklist.length ? 'success' : 'warning'}
                      label={completedChecklistCount === qualityChecklist.length ? 'Completo' : 'Com pendências'}
                    />
                  </Box>

                  {commercialIssues.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>
                      Pendências comerciais: {commercialIssues.join(', ')}.
                    </Alert>
                  )}

                  <Stack spacing={1}>
                    {qualityChecklist.map((item) => (
                      <Paper
                        key={item.id}
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          display: 'flex',
                          gap: 1.25,
                          alignItems: 'flex-start',
                          borderColor: item.complete ? 'success.light' : 'warning.light',
                        }}
                      >
                        {item.complete ? (
                          <CheckCircleIcon color="success" fontSize="small" sx={{ mt: 0.25 }} />
                        ) : (
                          <ErrorOutlineIcon color="warning" fontSize="small" sx={{ mt: 0.25 }} />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2">{item.label}</Typography>
                          <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                        </Box>
                        {!item.complete && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => navigate(`/location/${location.id}/edit`)}
                            sx={{ display: { xs: 'none', sm: 'inline-flex' }, whiteSpace: 'nowrap' }}
                          >
                            {item.actionLabel}
                          </Button>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={5}>
              <Stack spacing={2}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                      Resumo administrativo
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid xs={6}>
                        <Paper variant="outlined" sx={{ p: 1.25 }}>
                          <Typography variant="caption" color="text.secondary">Fotos</Typography>
                          <Typography variant="h6" fontWeight={700}>{photos.length}</Typography>
                        </Paper>
                      </Grid>
                      <Grid xs={6}>
                        <Paper variant="outlined" sx={{ p: 1.25 }}>
                          <Typography variant="caption" color="text.secondary">Comodidades</Typography>
                          <Typography variant="h6" fontWeight={700}>{amenities.length}</Typography>
                        </Paper>
                      </Grid>
                      <Grid xs={6}>
                        <Paper variant="outlined" sx={{ p: 1.25 }}>
                          <Typography variant="caption" color="text.secondary">Campos cadastrados</Typography>
                          <Typography variant="h6" fontWeight={700}>{fields.length || location.fieldCount || 0}</Typography>
                        </Paper>
                      </Grid>
                      <Grid xs={6}>
                        <Paper variant="outlined" sx={{ p: 1.25 }}>
                          <Typography variant="caption" color="text.secondary">Campos ativos</Typography>
                          <Typography variant="h6" fontWeight={700}>{activeFields.length}</Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack spacing={0.75}>
                      <Typography variant="body2"><strong>Dono:</strong> {location.ownerId || 'Não definido'}</Typography>
                      <Typography variant="body2"><strong>Gerentes:</strong> {location.managers?.length || 0}</Typography>
                      <Typography variant="body2"><strong>Vencimento:</strong> {location.billingDueDay ? `dia ${location.billingDueDay}` : 'Não definido'}</Typography>
                      <Typography variant="body2"><strong>Menor preço:</strong> {minHourlyPrice === null ? 'A definir' : `${formatCurrency(minHourlyPrice)}/h`}</Typography>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <HistoryIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={700}>Histórico comercial</Typography>
                    </Box>
                    {commercialHistoryError && (
                      <Alert severity="warning" sx={{ mb: 1.5 }}>
                        {commercialHistoryError}
                      </Alert>
                    )}
                    {commercialHistoryLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2" color="text.secondary">Carregando histórico...</Typography>
                      </Box>
                    ) : commercialHistory.length === 0 ? (
                      <Alert severity="info">
                        Nenhum evento comercial auditável registrado ainda.
                      </Alert>
                    ) : (
                      <Stack spacing={1}>
                        {commercialHistory.slice(0, 8).map((entry) => (
                          <Paper key={entry.id} variant="outlined" sx={{ p: 1.25 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" label={entry.kind} variant="outlined" />
                              <Typography variant="caption" color="text.secondary">
                                {entry.createdAt ? entry.createdAt.toLocaleString('pt-BR') : 'Data indisponível'}
                              </Typography>
                            </Box>
                            <Typography variant="subtitle2" sx={{ mt: 0.75 }}>{entry.title}</Typography>
                            {entry.detail && (
                              <Typography variant="body2" color="text.secondary">{entry.detail}</Typography>
                            )}
                            {entry.actorUserId && (
                              <Typography variant="caption" color="text.secondary">Ator: {entry.actorUserId}</Typography>
                            )}
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        )}

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
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
              <Chip
                size="small"
                color={commerciallyAvailable ? 'success' : 'default'}
                label={commerciallyAvailable ? 'Disponível no app' : 'Indisponível no app'}
              />
              {userCanEdit && (
                <>
                  <Chip size="small" variant="outlined" label={LOCATION_PUBLICATION_STATUS_LABELS[publicationStatus]} />
                  <Chip size="small" variant="outlined" label={LOCATION_SUBSCRIPTION_STATUS_LABELS[subscriptionStatus]} />
                </>
              )}
            </Stack>
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

        {photos.length > 1 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <PhotoLibraryIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>Fotos da quadra</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                {photos.map((photo, index) => (
                  <Box
                    key={photo}
                    component="img"
                    src={photo}
                    alt={`${location.name} foto ${index + 1}`}
                    loading="lazy"
                    sx={{
                      width: 160,
                      height: 104,
                      borderRadius: 2,
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Características</Typography>
            <Grid container spacing={1.5}>
              <Grid xs={6} sm={4} md={3} lg={3} xl={3}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <SoccerIcon color="primary" />
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{fieldTypeLabel}</Typography>
                  <Typography variant="caption" color="text.secondary">{location.fieldCount || 1} {(location.fieldCount || 1) === 1 ? 'campo' : 'campos'}</Typography>
                </Paper>
              </Grid>
              {location.playersPerTeam && (
                <Grid xs={6} sm={4} md={3} lg={3} xl={3}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="primary">{location.playersPerTeam}v{location.playersPerTeam}</Typography>
                    <Typography variant="caption" color="text.secondary">Jogadores</Typography>
                  </Paper>
                </Grid>
              )}
              {location.hasLighting && <Grid xs={6} sm={4} md={3} lg={3} xl={3}><Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><LightbulbIcon color="warning" /><Typography variant="body2" sx={{ mt: 0.5 }}>Iluminação</Typography></Paper></Grid>}
              {location.hasParking && <Grid xs={6} sm={4} md={3} lg={3} xl={3}><Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><ParkingIcon color="info" /><Typography variant="body2" sx={{ mt: 0.5 }}>Estacionamento</Typography></Paper></Grid>}
              {location.hasShowers && <Grid xs={6} sm={4} md={3} lg={3} xl={3}><Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><ShowerIcon color="info" /><Typography variant="body2" sx={{ mt: 0.5 }}>Vestiários</Typography></Paper></Grid>}
            </Grid>
            {amenities.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                {amenities.map((amenity) => (
                  <Chip
                    key={amenity}
                    size="small"
                    variant="outlined"
                    label={AMENITY_LABELS[amenity] || amenity}
                  />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {!user ? (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack alignItems="center" spacing={1.5} sx={{ py: 2, textAlign: 'center' }}>
                <SoccerIcon color="primary" sx={{ fontSize: 40 }} aria-hidden="true" />
                <Typography variant="h6">Entre para ver quadras e avaliações</Typography>
                <Typography variant="body2" color="text.secondary">
                  Faça login para consultar campos, preços e avaliações deste local.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/location/${location.id}`)}`)}
                >
                  Entrar
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Quadras e preços</Typography>
            {fields.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <SoccerIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Nenhum campo cadastrado ainda.
                </Typography>
                {userCanEdit && (
                  <Button sx={{ mt: 1 }} size="small" variant="outlined" onClick={() => navigate(`/location/${location.id}/edit`)}>
                    Completar cadastro de campos
                  </Button>
                )}
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {fields.map((field) => {
                  const typeLabel = FIELD_TYPE_CONFIG[field.type]?.label || field.type;
                  const fieldPrice = typeof field.hourlyPrice === 'number' && field.hourlyPrice > 0
                    ? `${formatCurrency(field.hourlyPrice)}/h`
                    : 'Preço a definir';
                  return (
                    <Paper
                      key={field.id}
                      variant="outlined"
                      sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}
                    >
                      <Avatar
                        variant="rounded"
                        src={field.photoUrl || field.photos?.[0]}
                        sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}
                      >
                        <SoccerIcon />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" noWrap>{field.name}</Typography>
                          <Chip size="small" label={typeLabel} />
                          {!field.isActive && <Chip size="small" color="warning" label="Inativa" />}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {[field.surface, field.dimensions, field.isCovered ? 'Coberta' : null].filter(Boolean).join(' • ') || 'Detalhes a completar'}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2" color="primary" sx={{ whiteSpace: 'nowrap' }}>
                        {fieldPrice}
                      </Typography>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>Avaliações ({reviews.length})</Typography>
              {user && (
                <Button size="small" startIcon={<ReviewIcon />} onClick={handleOpenReview} sx={{ minHeight: 44 }}>
                  {currentUserReview ? 'Editar avaliação' : 'Avaliar'}
                </Button>
              )}
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
          </>
        )}

        {location.latitude && location.longitude && (
          <Button variant="contained" fullWidth startIcon={<DirectionsIcon />} onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`, '_blank', 'noopener,noreferrer')}>
            Obter Direções
          </Button>
        )}
      </PageContainer>

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
    </>
  );
};
