import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack as BackIcon,
  CalendarMonth as CalendarIcon,
  CheckCircleOutline as CheckCircleIcon,
  Edit as EditIcon,
  ImageOutlined as PhotoIcon,
  Launch as LaunchIcon,
  LocationOn as LocationIcon,
  Paid as PaidIcon,
  PendingActions as PendingIcon,
  ReceiptLong as ReceiptIcon,
  Schedule as ScheduleIcon,
  SportsSoccer as SoccerIcon,
  Star as StarIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import PageContainer from '../../components/common/PageContainer';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { submitLocationSubscriptionReceipt } from '../../services/cloudFunctions';
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
import {
  Field,
  LocationPublicationStatus,
  LocationSubscriptionStatus,
} from '../../types/location';
import {
  calculateOwnerDashboardStats,
  OwnerDashboardGame,
  OwnerDashboardLocationLike,
  summarizeOwnerLocationStatus,
} from './ownerDashboard';

const logger = createLogger('FieldOwnerDashboardScreen');

const RECEIPT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const RECEIPT_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

interface RawLocationDoc {
  name?: string;
  address?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  neighborhood?: string;
  region?: string;
  ownerId?: string;
  managers?: string[];
  isVerified?: boolean;
  isActive?: boolean;
  publicationStatus?: LocationPublicationStatus;
  subscriptionStatus?: LocationSubscriptionStatus;
  monthlyFeeCents?: number;
  billingDueDay?: number | null;
  currentBillingCycleStatus?: string;
  currentBillingOpenBalanceCents?: number;
  billingDueAt?: unknown;
  billingSuspendAt?: unknown;
  rating?: number;
  ratingCount?: number;
  description?: string;
  photoUrl?: string | null;
  photos?: string[];
  amenities?: string[];
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  instagram?: string | null;
  openingTime?: string;
  closingTime?: string;
  operatingDays?: number[];
  minGameDurationMinutes?: number;
  fieldCount?: number;
  fieldType?: Field['type'];
  primaryFieldType?: Field['type'];
  playersPerTeam?: number;
  hasActiveFields?: boolean;
}

interface RawFieldDoc {
  locationId?: string;
  location_id?: string;
  name?: string;
  type?: Field['type'];
  isActive?: boolean;
  is_active?: boolean;
  hourlyPrice?: number;
  hourly_price?: number;
  photos?: string[];
  managers?: string[];
  isCovered?: boolean;
  is_covered?: boolean;
  description?: string | null;
  photoUrl?: string | null;
  photo_url?: string | null;
  surface?: string | null;
  dimensions?: string | null;
}

interface LocationData extends OwnerDashboardLocationLike {
  currentBillingCycleStatus?: string;
  currentBillingOpenBalanceCents?: number;
  billingDueAt?: Date | null;
  billingSuspendAt?: Date | null;
}

interface SubscriptionPaymentReview {
  id: string;
  amountCents?: number;
  periodKey?: string;
  method?: string | null;
  receiptStoragePath?: string | null;
  reviewStatus?: string;
  status?: string;
  submittedAt?: Date | null;
  paidAt?: Date | null;
}

interface SubscriptionLedgerEntry {
  id: string;
  type?: string | null;
  amountCents?: number | null;
  periodKey?: string | null;
  method?: string | null;
  reviewStatus?: string | null;
  previousSubscriptionStatus?: string | null;
  nextSubscriptionStatus?: string | null;
  monthlyFeeCents?: number | null;
  billingDueDay?: number | null;
  reason?: string | null;
  createdAt?: Date | null;
  effectiveAt?: Date | null;
}

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
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
  const explicitDate = toDate(data.dateTime ?? data.date_time);
  if (explicitDate) return explicitDate;

  if (typeof data.date === 'string' && data.date.trim()) {
    const dateTime = `${data.date}T${typeof data.time === 'string' ? data.time : '00:00'}`;
    const parsed = new Date(dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const safeStorageName = (name: string) =>
  name.replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'comprovante';

const currentPeriodKey = () => new Date().toISOString().slice(0, 7);

const currentDateInput = () => {
  const local = new Date();
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (valueCents?: number | null, locale = 'pt-BR') => {
  if (!valueCents || valueCents <= 0) return null;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' }).format(valueCents / 100);
};

const formatDate = (value?: Date | null, locale = 'pt-BR') =>
  value ? value.toLocaleDateString(locale) : null;

const getPaymentStatus = (payment: SubscriptionPaymentReview) =>
  payment.reviewStatus || payment.status || 'PENDING_REVIEW';

const getPaymentStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'error';
  if (status === 'PENDING_REVIEW') return 'warning';
  return 'default';
};

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
}

const SummaryCard = ({ icon, label, value, helper }: SummaryCardProps) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      height: '100%',
      minWidth: 0,
      borderRadius: 3,
    }}
  >
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
      </Box>
      <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.05, minWidth: 0 }}>
        {value}
      </Typography>
      {helper ? (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      ) : null}
    </Stack>
  </Paper>
);

export const FieldOwnerDashboardScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('page.title.fieldOwnerDashboard'));
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/locations');
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const locale = useMemo(() => {
    if (i18n.resolvedLanguage === 'en') return 'en-US';
    if (i18n.resolvedLanguage === 'es') return 'es-ES';
    return 'pt-BR';
  }, [i18n.resolvedLanguage]);

  const [locations, setLocations] = useState<LocationData[]>([]);
  const [fieldsByLocation, setFieldsByLocation] = useState<Record<string, Field[]>>({});
  const [locationGames, setLocationGames] = useState<OwnerDashboardGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [receiptTarget, setReceiptTarget] = useState<LocationData | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptPeriodKey, setReceiptPeriodKey] = useState(currentPeriodKey());
  const [receiptPaidAt, setReceiptPaidAt] = useState(currentDateInput());
  const [receiptMethod, setReceiptMethod] = useState('pix');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptActionLoading, setReceiptActionLoading] = useState(false);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPaymentReview[]>([]);
  const [subscriptionLedger, setSubscriptionLedger] = useState<SubscriptionLedgerEntry[]>([]);

  const retryDashboard = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryCount((count) => count + 1);
  }, []);

  const getPaymentStatusLabel = useCallback((status: string) => {
    if (status === 'APPROVED') return t('fieldOwner.paymentStatus.approved');
    if (status === 'REJECTED') return t('fieldOwner.paymentStatus.rejected');
    if (status === 'PENDING_REVIEW') return t('fieldOwner.paymentStatus.pendingReview');
    return status;
  }, [t]);

  const getLedgerTypeLabel = useCallback((type?: string | null) => {
    if (type === 'SUBSCRIPTION_STATUS_CHANGED') return t('fieldOwner.ledgerType.subscriptionStatusChanged');
    if (type === 'PAYMENT_REGISTERED') return t('fieldOwner.ledgerType.paymentRegistered');
    if (type === 'PAYMENT_RECEIPT_SUBMITTED') return t('fieldOwner.ledgerType.paymentReceiptSubmitted');
    if (type === 'PAYMENT_RECEIPT_APPROVED') return t('fieldOwner.ledgerType.paymentReceiptApproved');
    if (type === 'PAYMENT_RECEIPT_REJECTED') return t('fieldOwner.ledgerType.paymentReceiptRejected');
    return t('fieldOwner.ledgerType.generic');
  }, [t]);

  const getChecklistItemLabel = useCallback((itemId: string) => (
    t(`fieldOwner.checklistItems.${itemId}`, { defaultValue: itemId })
  ), [t]);

  const getCommercialIssueLabel = useCallback((issue: string) => {
    const issueKeyMap: Record<string, string> = {
      inativa: 'inactive',
      'não verificada': 'notVerified',
      'não publicada': 'notPublished',
      'mensalidade irregular': 'billingIrregular',
      'sem quadras cadastradas': 'noFields',
      'sem quadras ativas': 'noActiveFields',
      'sem mensalidade': 'noMonthlyFee',
      'sem vencimento': 'noDueDay',
      'endereço incompleto': 'incompleteAddress',
    };
    const issueKey = issueKeyMap[issue];
    return issueKey ? t(`fieldOwner.commercialIssue.${issueKey}`) : issue;
  }, [t]);

  const getPublicationStatusLabel = useCallback((status: LocationPublicationStatus) => {
    const keyMap: Record<LocationPublicationStatus, string> = {
      DRAFT: 'draft',
      PENDING_REVIEW: 'pendingReview',
      PUBLISHED: 'published',
      SUSPENDED: 'suspended',
      REJECTED: 'rejected',
    };
    return t(`fieldOwner.publicationStatus.${keyMap[status]}`);
  }, [t]);

  const getSubscriptionStatusLabel = useCallback((status: LocationSubscriptionStatus) => {
    const keyMap: Record<LocationSubscriptionStatus, string> = {
      TRIAL: 'trial',
      ACTIVE: 'active',
      OVERDUE: 'overdue',
      SUSPENDED: 'suspended',
      CANCELLED: 'cancelled',
    };
    return t(`fieldOwner.subscriptionState.${keyMap[status]}`);
  }, [t]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const locationsRef = collection(db, 'locations');
    const locationsQuery = query(locationsRef, where('owner_id', '==', user.id));
    const unsubscribe = onSnapshot(
      locationsQuery,
      (snapshot) => {
        const nextLocations = snapshot.docs.map((docSnapshot) => {
          const data = snakeToCamel<RawLocationDoc>(docSnapshot.data());
          return {
            id: docSnapshot.id,
            name: data.name || t('fieldOwner.fieldNameFallback'),
            address: data.address || '',
            cep: data.cep || '',
            street: data.street || '',
            number: data.number || '',
            complement: data.complement || '',
            district: data.district || '',
            city: data.city || '',
            state: data.state || '',
            country: data.country || 'BR',
            neighborhood: data.neighborhood || data.district || '',
            region: data.region || data.state || '',
            ownerId: data.ownerId || user.id,
            managers: data.managers || [],
            isVerified: data.isVerified === true,
            isActive: data.isActive !== false,
            publicationStatus: data.publicationStatus,
            subscriptionStatus: data.subscriptionStatus,
            monthlyFeeCents: data.monthlyFeeCents,
            billingDueDay: data.billingDueDay ?? null,
            currentBillingCycleStatus: data.currentBillingCycleStatus,
            currentBillingOpenBalanceCents: data.currentBillingOpenBalanceCents,
            billingDueAt: toDate(data.billingDueAt),
            billingSuspendAt: toDate(data.billingSuspendAt),
            rating: data.rating || 0,
            ratingCount: data.ratingCount || 0,
            description: data.description || '',
            photoUrl: data.photoUrl || undefined,
            photos: data.photos || [],
            amenities: data.amenities || [],
            phone: data.phone || undefined,
            whatsapp: data.whatsapp || undefined,
            website: data.website || undefined,
            instagram: data.instagram || undefined,
            openingTime: data.openingTime || '06:00',
            closingTime: data.closingTime || '23:00',
            operatingDays: data.operatingDays || [1, 2, 3, 4, 5, 6, 7],
            minGameDurationMinutes: data.minGameDurationMinutes || 60,
            fieldCount: data.fieldCount || 0,
            fieldType: data.fieldType,
            primaryFieldType: data.primaryFieldType,
            playersPerTeam: data.playersPerTeam,
            hasActiveFields: data.hasActiveFields,
          };
        });
        setLocations(nextLocations);
        setLoading(false);
      },
      (snapshotError) => {
        logger.error('Error fetching owner locations:', snapshotError);
        showErrorRef.current(t('fieldOwner.loadDashboardError'));
        setError(getFirestoreErrorMessage(snapshotError));
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [retryCount, t, user]);

  useEffect(() => {
    if (locations.length === 0) {
      setFieldsByLocation({});
      return;
    }

    let cancelled = false;
    const locationIds = locations.map((location) => location.id);
    const loadFields = async () => {
      try {
        const chunks = chunkArray(locationIds, 10);
        const chunkSnapshots = await Promise.all(
          chunks.flatMap((ids) => [
            getDocs(query(collectionGroup(db, 'fields'), where('location_id', 'in', ids), limit(500))),
            getDocs(query(collection(db, 'fields'), where('location_id', 'in', ids), limit(500))),
          ]),
        );

        if (cancelled) return;

        const nextByLocation: Record<string, Field[]> = {};
        const seen = new Set<string>();

        chunkSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnapshot) => {
            const data = snakeToCamel<RawFieldDoc>(docSnapshot.data());
            const locationId = data.locationId || data.location_id;
            if (!locationId) return;

            const dedupeKey = `${locationId}:${docSnapshot.id}`;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);

            const field: Field = {
              id: docSnapshot.id,
              locationId,
              name: data.name || t('fieldOwner.fieldNameFallback'),
              type: data.type || 'SOCIETY',
              description: data.description || undefined,
              photoUrl: data.photoUrl || data.photo_url || undefined,
              isActive: data.isActive ?? data.is_active ?? true,
              hourlyPrice: data.hourlyPrice ?? data.hourly_price ?? 0,
              photos: data.photos || [],
              managers: data.managers || [],
              surface: data.surface || undefined,
              isCovered: data.isCovered ?? data.is_covered ?? false,
              dimensions: data.dimensions || undefined,
            };

            nextByLocation[locationId] = [...(nextByLocation[locationId] || []), field];
          });
        });

        setFieldsByLocation(nextByLocation);
      } catch (loadError) {
        logger.error('Error loading owner fields:', loadError);
        showErrorRef.current(t('fieldOwner.loadFieldsError'));
        setError(getFirestoreErrorMessage(loadError));
      }
    };

    loadFields();
    return () => {
      cancelled = true;
    };
  }, [locations, retryCount, t]);

  useEffect(() => {
    if (locations.length === 0) {
      setLocationGames([]);
      return;
    }

    const gamesByChunk = new Map<number, OwnerDashboardGame[]>();
    const chunks = chunkArray(locations.map((location) => location.id), 10);
    const unsubscribes = chunks.map((locationIds, index) => {
      const gamesRef = collection(db, 'games');
      const gamesQuery = query(gamesRef, where('location_id', 'in', locationIds), limit(500));

      return onSnapshot(
        gamesQuery,
        (snapshot) => {
          gamesByChunk.set(index, snapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              locationId: typeof data.location_id === 'string' ? data.location_id : '',
              status: typeof data.status === 'string' ? data.status : undefined,
              dateTime: getGameDate(data),
              deletedAt: toDate(data.deleted_at ?? data.deletedAt),
            };
          }).filter((game) => Boolean(game.locationId)));

          setLocationGames(Array.from(gamesByChunk.values()).flat());
        },
        (snapshotError) => {
          logger.error('Error fetching location games:', snapshotError);
          showErrorRef.current(t('fieldOwner.loadGamesError'));
          setError(getFirestoreErrorMessage(snapshotError));
        },
      );
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [locations, retryCount, t]);

  useEffect(() => {
    if (!receiptTarget) {
      setSubscriptionPayments([]);
      setSubscriptionLedger([]);
      return;
    }

    const paymentsRef = collection(db, 'locations', receiptTarget.id, 'subscription_payments');
    const ledgerRef = collection(db, 'locations', receiptTarget.id, 'subscription_ledger');

    const unsubscribePayments = onSnapshot(
      query(paymentsRef, orderBy('submitted_at', 'desc'), limit(20)),
      (snapshot) => {
        const payments = snapshot.docs.map((docSnapshot) => {
          const data = snakeToCamel<Record<string, unknown>>(docSnapshot.data());
          return {
            id: docSnapshot.id,
            amountCents: typeof data.amountCents === 'number' ? data.amountCents : undefined,
            periodKey: typeof data.periodKey === 'string' ? data.periodKey : undefined,
            method: typeof data.method === 'string' ? data.method : null,
            receiptStoragePath: typeof data.receiptStoragePath === 'string' ? data.receiptStoragePath : null,
            reviewStatus: typeof data.reviewStatus === 'string' ? data.reviewStatus : undefined,
            status: typeof data.status === 'string' ? data.status : undefined,
            submittedAt: toDate(data.submittedAt),
            paidAt: toDate(data.paidAt),
          };
        });
        setSubscriptionPayments(payments);
      },
      (snapshotError) => {
        logger.error('Error loading subscription payments:', snapshotError);
        showErrorRef.current(t('fieldOwner.loadPaymentsError'));
      },
    );

    const unsubscribeLedger = onSnapshot(
      query(ledgerRef, orderBy('created_at', 'desc'), limit(30)),
      (snapshot) => {
        const entries = snapshot.docs.map((docSnapshot) => {
          const data = snakeToCamel<Record<string, unknown>>(docSnapshot.data());
          return {
            id: docSnapshot.id,
            type: typeof data.type === 'string' ? data.type : null,
            amountCents: typeof data.amountCents === 'number' ? data.amountCents : null,
            periodKey: typeof data.periodKey === 'string' ? data.periodKey : null,
            method: typeof data.method === 'string' ? data.method : null,
            reviewStatus: typeof data.reviewStatus === 'string' ? data.reviewStatus : null,
            previousSubscriptionStatus: typeof data.previousSubscriptionStatus === 'string' ? data.previousSubscriptionStatus : null,
            nextSubscriptionStatus: typeof data.nextSubscriptionStatus === 'string' ? data.nextSubscriptionStatus : null,
            monthlyFeeCents: typeof data.monthlyFeeCents === 'number' ? data.monthlyFeeCents : null,
            billingDueDay: typeof data.billingDueDay === 'number' ? data.billingDueDay : null,
            reason: typeof data.reason === 'string' ? data.reason : null,
            createdAt: toDate(data.createdAt),
            effectiveAt: toDate(data.effectiveAt),
          };
        });
        setSubscriptionLedger(entries);
      },
      (snapshotError) => {
        logger.error('Error loading subscription ledger:', snapshotError);
        showErrorRef.current(t('fieldOwner.loadPaymentsError'));
      },
    );

    return () => {
      unsubscribePayments();
      unsubscribeLedger();
    };
  }, [receiptTarget, t]);

  const gamesByLocation = useMemo(() => {
    const map: Record<string, OwnerDashboardGame[]> = {};
    locationGames.forEach((game) => {
      map[game.locationId] = [...(map[game.locationId] || []), game];
    });
    return map;
  }, [locationGames]);

  const locationStatusById = useMemo(() => {
    const statuses: Record<string, ReturnType<typeof summarizeOwnerLocationStatus>> = {};
    locations.forEach((location) => {
      statuses[location.id] = summarizeOwnerLocationStatus(
        location,
        fieldsByLocation[location.id] || [],
        gamesByLocation[location.id] || [],
      );
    });
    return statuses;
  }, [fieldsByLocation, gamesByLocation, locations]);

  const stats = useMemo(
    () => calculateOwnerDashboardStats(locations, fieldsByLocation, locationGames),
    [fieldsByLocation, locationGames, locations],
  );

  const openReceiptDialog = useCallback((location: LocationData) => {
    setReceiptTarget(location);
    setReceiptFile(null);
    setReceiptAmount(
      location.currentBillingOpenBalanceCents && location.currentBillingOpenBalanceCents > 0
        ? String((location.currentBillingOpenBalanceCents / 100).toFixed(2))
        : location.monthlyFeeCents
          ? String((location.monthlyFeeCents / 100).toFixed(2))
          : '',
    );
    setReceiptPeriodKey(currentPeriodKey());
    setReceiptPaidAt(currentDateInput());
    setReceiptMethod('pix');
    setReceiptNotes('');
  }, []);

  const closeReceiptDialog = useCallback(() => {
    if (receiptActionLoading) return;
    setReceiptTarget(null);
    setReceiptFile(null);
    setReceiptNotes('');
  }, [receiptActionLoading]);

  const priorityActions = useMemo(() => {
    const actions: Array<{
      id: string;
      title: string;
      description: string;
      icon: ReactNode;
      onClick: () => void;
    }> = [];

    if (locations.length === 0) {
      actions.push({
        id: 'create-first',
        title: t('fieldOwner.createFirstLocation'),
        description: t('fieldOwner.guidedEmptyDescription'),
        icon: <LocationIcon fontSize="small" />,
        onClick: () => navigate('/location/create'),
      });
      return actions;
    }

    const firstPending = locations.find((location) => (locationStatusById[location.id]?.pendingCount || 0) > 0);
    if (firstPending) {
      actions.push({
        id: `pending-${firstPending.id}`,
        title: t('fieldOwner.completeRegistration'),
        description: `${firstPending.name} · ${locationStatusById[firstPending.id].pendingCount} ${t('fieldOwner.pendingItemsShort')}`,
        icon: <PendingIcon fontSize="small" />,
        onClick: () => navigate(`/location/${firstPending.id}/edit#basic-info`),
      });
    }

    const firstWithBalance = locations.find((location) => (location.currentBillingOpenBalanceCents || 0) > 0);
    if (firstWithBalance) {
      actions.push({
        id: `billing-${firstWithBalance.id}`,
        title: t('fieldOwner.sendReceipt'),
        description: `${firstWithBalance.name} · ${formatCurrency(firstWithBalance.currentBillingOpenBalanceCents, locale) || t('fieldOwner.subscriptionPending')}`,
        icon: <ReceiptIcon fontSize="small" />,
        onClick: () => openReceiptDialog(firstWithBalance),
      });
    }

    actions.push({
      id: 'manage-all',
      title: t('fieldOwner.manageAllLocations'),
      description: t('fieldOwner.manageAllLocationsDescription'),
      icon: <EditIcon fontSize="small" />,
      onClick: () => navigate('/locations'),
    });

    actions.push({
      id: 'create-new',
      title: t('fieldOwner.addNewField'),
      description: t('fieldOwner.createAnotherLocationDescription'),
      icon: <StorefrontIcon fontSize="small" />,
      onClick: () => navigate('/location/create'),
    });

    return actions.slice(0, 4);
  }, [locale, locationStatusById, locations, navigate, openReceiptDialog, t]);

  const handleReceiptFile = useCallback((file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
      showError(t('fieldOwner.receiptTypeError'));
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      showError(t('fieldOwner.receiptSizeError'));
      return;
    }
    setReceiptFile(file);
  }, [showError, t]);

  const uploadReceipt = useCallback(async (location: LocationData, file: File) => {
    const extension = RECEIPT_EXTENSION_BY_TYPE[file.type] || 'pdf';
    const path = [
      'locations',
      location.id,
      'subscription_receipts',
      location.ownerId,
      `${Date.now()}-${safeStorageName(file.name)}.${extension}`,
    ].join('/');
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, {
      contentType: file.type,
      customMetadata: {
        locationId: location.id,
        ownerId: location.ownerId,
        commercialDocument: 'subscription_receipt',
      },
    });
    return ref.fullPath;
  }, []);

  const handleSubmitReceipt = useCallback(async () => {
    if (!receiptTarget || !receiptFile) {
      showError(t('fieldOwner.receiptSelectFile'));
      return;
    }

    const amountCents = Math.round(Number(receiptAmount.replace(/,/g, '.')) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      showError(t('fieldOwner.receiptAmountError'));
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(receiptPeriodKey.trim())) {
      showError(t('fieldOwner.receiptPeriodError'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptPaidAt.trim())) {
      showError(t('fieldOwner.receiptPaidAtError'));
      return;
    }

    setReceiptActionLoading(true);
    try {
      const receiptStoragePath = await uploadReceipt(receiptTarget, receiptFile);
      await submitLocationSubscriptionReceipt({
        locationId: receiptTarget.id,
        amountCents,
        periodKey: receiptPeriodKey.trim(),
        paidAtIso: `${receiptPaidAt.trim()}T12:00:00.000Z`,
        method: receiptMethod.trim() || null,
        receiptStoragePath,
        notes: receiptNotes.trim() || null,
      });
      showSuccess(t('fieldOwner.receiptSuccess'));
      setReceiptFile(null);
      setReceiptNotes('');
      setReceiptTarget(null);
    } catch (submitError) {
      logger.error('Erro ao enviar comprovante da quadra:', submitError);
      showError(t('fieldOwner.receiptSubmitError'));
    } finally {
      setReceiptActionLoading(false);
    }
  }, [
    receiptAmount,
    receiptFile,
    receiptMethod,
    receiptNotes,
    receiptPaidAt,
    receiptPeriodKey,
    receiptTarget,
    showError,
    showSuccess,
    t,
    uploadReceipt,
  ]);

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
          <Typography variant="h6" sx={{ ml: 1, minWidth: 0 }}>
            {t('fieldOwner.title')}
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="dashboard">
        <Card
          sx={{
            mb: 3,
            overflow: 'hidden',
            borderRadius: 4,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 58%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} justifyContent="space-between">
              <Stack spacing={1.25} sx={{ minWidth: 0, maxWidth: 720 }}>
                <Typography variant="overline" color="primary.main" fontWeight={800}>
                  {t('fieldOwner.portfolioStatus')}
                </Typography>
                <Typography variant="h4" fontWeight={900} sx={{ lineHeight: 1.05 }}>
                  {locations.length === 0
                    ? t('fieldOwner.guidedEmptyTitle')
                    : t('fieldOwner.heroReadyTitle', { count: locations.length })}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {locations.length === 0
                    ? t('fieldOwner.guidedEmptyDescription')
                    : t('fieldOwner.heroDescription', {
                      published: stats.publishedLocations,
                      pending: stats.pendingLocations,
                    })}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    color={stats.publishedLocations > 0 ? 'success' : 'default'}
                    label={t('fieldOwner.publishedLocationsChip', { count: stats.publishedLocations })}
                  />
                  <Chip
                    color={stats.totalPendingItems > 0 ? 'warning' : 'success'}
                    label={t('fieldOwner.pendingItemsChip', { count: stats.totalPendingItems })}
                  />
                  {stats.averageHourlyPriceCents ? (
                    <Chip
                      color="info"
                      label={t('fieldOwner.averagePriceChip', { value: formatCurrency(stats.averageHourlyPriceCents, locale) })}
                    />
                  ) : null}
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={1.25} sx={{ minWidth: { lg: 260 } }}>
                <Button variant="contained" startIcon={<StorefrontIcon />} onClick={() => navigate('/location/create')} fullWidth>
                  {t('fieldOwner.createFirstLocation')}
                </Button>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => navigate('/locations')} fullWidth>
                  {t('fieldOwner.manage')}
                </Button>
                <Button variant="text" startIcon={<LaunchIcon />} onClick={() => navigate('/map/locations')} fullWidth>
                  {t('fieldOwner.viewPublicCatalog')}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {locations.length === 0 ? (
          <Stack spacing={2.5}>
            <EmptyState
              icon={<LocationIcon />}
              title={t('fieldOwner.guidedEmptyTitle')}
              description={t('fieldOwner.guidedEmptyDescription')}
              actionLabel={t('fieldOwner.createFirstLocation')}
              onAction={() => navigate('/location/create')}
              animate={false}
            />

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                  {t('fieldOwner.firstStepsTitle')}
                </Typography>
                <List disablePadding>
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t('fieldOwner.firstStepOneTitle')}
                      secondary={t('fieldOwner.firstStepOneDescription')}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t('fieldOwner.firstStepTwoTitle')}
                      secondary={t('fieldOwner.firstStepTwoDescription')}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={t('fieldOwner.firstStepThreeTitle')}
                      secondary={t('fieldOwner.firstStepThreeDescription')}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Stack>
        ) : (
          <Stack spacing={3}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(5, minmax(0, 1fr))',
                },
                gap: 1.5,
              }}
            >
              <SummaryCard
                icon={<SoccerIcon />}
                label={t('fieldOwner.gamesLast30Days')}
                value={String(stats.gamesLast30Days)}
              />
              <SummaryCard
                icon={<CalendarIcon />}
                label={t('fieldOwner.upcomingGames')}
                value={String(stats.upcomingGames)}
                helper={t('fieldOwner.gamesThisWeekHelper', { count: stats.gamesThisWeek })}
              />
              <SummaryCard
                icon={<StarIcon />}
                label={t('fieldOwner.averageRating')}
                value={stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : '0.0'}
                helper={t('fieldOwner.totalReviewsHelper', { count: stats.totalReviews })}
              />
              <SummaryCard
                icon={<PaidIcon />}
                label={t('fieldOwner.averageHourlyPrice')}
                value={formatCurrency(stats.averageHourlyPriceCents, locale) || t('fieldOwner.notConfigured')}
              />
              <SummaryCard
                icon={<PendingIcon />}
                label={t('fieldOwner.pendingItems')}
                value={String(stats.totalPendingItems)}
                helper={t('fieldOwner.pendingLocationsHelper', { count: stats.pendingLocations })}
              />
            </Box>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                  {t('fieldOwner.quickActions')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
                  {priorityActions.map((action) => (
                    <Paper
                      key={action.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <ListItemButton onClick={action.onClick} sx={{ py: 1.75 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>{action.icon}</ListItemIcon>
                        <ListItemText
                          primary={action.title}
                          secondary={action.description}
                          primaryTypographyProps={{ fontWeight: 700 }}
                        />
                      </ListItemButton>
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {locations.map((location) => {
                const status = locationStatusById[location.id];
                const fields = fieldsByLocation[location.id] || [];
                const averagePrice = formatCurrency(status.averageHourlyPriceCents, locale);
                const minPrice = formatCurrency(status.minHourlyPriceCents, locale);
                const paymentLabel = formatCurrency(location.currentBillingOpenBalanceCents, locale)
                  || formatCurrency(location.monthlyFeeCents, locale)
                  || t('fieldOwner.notConfigured');

                return (
                  <Card key={location.id} sx={{ height: '100%', borderRadius: 4 }}>
                    <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                            <Avatar
                              src={location.photoUrl}
                              variant="rounded"
                              sx={{
                                width: { xs: 56, sm: 68 },
                                height: { xs: 56, sm: 68 },
                                flexShrink: 0,
                                bgcolor: alpha(theme.palette.primary.main, 0.16),
                                color: 'primary.main',
                              }}
                            >
                              <SoccerIcon />
                            </Avatar>
                            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                              <Typography variant="h6" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
                                {location.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {location.city
                                  ? `${location.city}${location.state ? `, ${location.state}` : ''}`
                                  : t('fieldOwner.cityMissing')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('fieldOwner.fieldsCount', { count: fields.length || location.fieldCount || 0 })}
                              </Typography>
                            </Stack>
                          </Stack>

                          <Button
                            size="small"
                            variant="text"
                            startIcon={<LaunchIcon />}
                            onClick={() => navigate(`/location/${location.id}`)}
                            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                          >
                            {t('fieldOwner.viewPublicPage')}
                          </Button>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip
                            color={status.pendingCount === 0 ? 'success' : 'warning'}
                            label={t('fieldOwner.registrationStatusChip', {
                              completed: status.checklistCompleted,
                              total: status.checklistTotal,
                            })}
                          />
                          <Chip
                            color={location.isVerified ? 'success' : 'warning'}
                            label={t('fieldOwner.approvalStatusChip', {
                              status: location.isVerified ? t('fieldOwner.approved') : t('fieldOwner.pendingApproval'),
                            })}
                          />
                          <Chip
                            color={status.publicationStatus === 'PUBLISHED' ? 'success' : 'default'}
                            label={t('fieldOwner.publicationStatusChip', {
                              status: getPublicationStatusLabel(status.publicationStatus),
                            })}
                          />
                          <Chip
                            color={['TRIAL', 'ACTIVE'].includes(status.subscriptionStatus) ? 'success' : 'warning'}
                            label={t('fieldOwner.subscriptionStatusChip', {
                              status: getSubscriptionStatusLabel(status.subscriptionStatus),
                            })}
                          />
                          <Chip
                            color={status.commerciallyAvailable ? 'success' : 'warning'}
                            label={status.commerciallyAvailable ? t('fieldOwner.availableInApp') : t('fieldOwner.needsAttention')}
                          />
                        </Stack>

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                            gap: 1.25,
                          }}
                        >
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="caption" color="text.secondary">{t('fieldOwner.activeFields')}</Typography>
                            <Typography variant="h6" fontWeight={800}>{status.activeFieldCount || fields.length || 0}</Typography>
                          </Paper>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="caption" color="text.secondary">{t('fieldOwner.gamesLast30Days')}</Typography>
                            <Typography variant="h6" fontWeight={800}>{status.gamesLast30Days}</Typography>
                          </Paper>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="caption" color="text.secondary">{t('fieldOwner.upcomingGames')}</Typography>
                            <Typography variant="h6" fontWeight={800}>{status.upcomingGames}</Typography>
                          </Paper>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                            <Typography variant="caption" color="text.secondary">{t('fieldOwner.averageHourlyPrice')}</Typography>
                            <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                              {averagePrice || t('fieldOwner.notConfigured')}
                            </Typography>
                            {minPrice ? (
                              <Typography variant="caption" color="text.secondary">
                                {t('fieldOwner.startingAt', { value: minPrice })}
                              </Typography>
                            ) : null}
                          </Paper>
                        </Box>

                        {(location.currentBillingOpenBalanceCents || 0) > 0 ? (
                          <Alert severity="warning">
                            <Typography variant="body2" fontWeight={700}>
                              {t('fieldOwner.openBalanceAlertTitle', { value: paymentLabel })}
                            </Typography>
                            <Typography variant="body2">
                              {[
                                location.currentBillingCycleStatus
                                  ? t('fieldOwner.billingCycleLabel', { value: location.currentBillingCycleStatus })
                                  : null,
                                formatDate(location.billingDueAt, locale)
                                  ? t('fieldOwner.billingDueDateLabel', { value: formatDate(location.billingDueAt, locale) })
                                  : null,
                                formatDate(location.billingSuspendAt, locale)
                                  ? t('fieldOwner.billingSuspendDateLabel', { value: formatDate(location.billingSuspendAt, locale) })
                                  : null,
                              ].filter(Boolean).join(' · ')}
                            </Typography>
                          </Alert>
                        ) : null}

                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.75,
                            borderRadius: 3,
                            bgcolor: status.pendingCount === 0
                              ? alpha(theme.palette.success.main, 0.06)
                              : alpha(theme.palette.warning.main, 0.08),
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography variant="subtitle2" fontWeight={800}>
                                {t('fieldOwner.checklistProgress')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {status.checklistCompleted}/{status.checklistTotal}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(status.checklistCompleted / Math.max(status.checklistTotal, 1)) * 100}
                              color={status.pendingCount === 0 ? 'success' : 'warning'}
                              sx={{ height: 8, borderRadius: 999 }}
                            />
                            {status.pendingCount === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                {t('fieldOwner.locationReadyDescription')}
                              </Typography>
                            ) : (
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  {t('fieldOwner.pendingChecklistDescription', { count: status.pendingCount })}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {status.pendingItems.slice(0, 4).map((item) => (
                                    <Chip
                                      key={item}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                      label={getChecklistItemLabel(item)}
                                    />
                                  ))}
                                </Stack>
                                {status.commercialIssues.length > 0 ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {status.commercialIssues.map(getCommercialIssueLabel).join(' · ')}
                                  </Typography>
                                ) : null}
                              </>
                            )}
                          </Stack>
                        </Paper>

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1,
                          }}
                        >
                          <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/location/${location.id}/edit#basic-info`)}
                            fullWidth
                          >
                            {t('fieldOwner.editLocation')}
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<ScheduleIcon />}
                            onClick={() => navigate(`/location/${location.id}/edit#fields`)}
                            fullWidth
                          >
                            {t('fieldOwner.editFieldsAndSchedule')}
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<PhotoIcon />}
                            onClick={() => navigate(`/location/${location.id}/edit#photos`)}
                            fullWidth
                          >
                            {t('fieldOwner.managePhotos')}
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<ReceiptIcon />}
                            onClick={() => openReceiptDialog(location)}
                            fullWidth
                          >
                            {t('fieldOwner.paymentsAndReceipts')}
                          </Button>
                          <Button
                            variant="text"
                            startIcon={<LaunchIcon />}
                            onClick={() => navigate(`/location/${location.id}`)}
                            fullWidth
                          >
                            {t('fieldOwner.viewPublicPage')}
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Stack>
        )}
      </PageContainer>

      <Dialog
        open={!!receiptTarget}
        onClose={closeReceiptDialog}
        fullWidth
        fullScreen={fullScreenDialog}
        maxWidth="sm"
      >
        <DialogTitle>{t('fieldOwner.paymentsDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {receiptTarget?.name}
            </Typography>

            {(receiptTarget?.currentBillingOpenBalanceCents || 0) > 0 ? (
              <Alert severity="warning">
                {t('fieldOwner.openBalanceAlertTitle', {
                  value: formatCurrency(receiptTarget?.currentBillingOpenBalanceCents, locale) || t('fieldOwner.subscriptionPending'),
                })}
              </Alert>
            ) : (
              <Alert severity="info">
                {t('fieldOwner.receiptDialogDescription')}
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label={t('fieldOwner.receiptAmountLabel')}
                value={receiptAmount}
                onChange={(event) => setReceiptAmount(event.target.value.replace(/,/g, '.').replace(/[^\d.]/g, ''))}
                fullWidth
                inputMode="decimal"
                placeholder="199.90"
              />
              <TextField
                label={t('fieldOwner.receiptPeriodLabel')}
                value={receiptPeriodKey}
                onChange={(event) => setReceiptPeriodKey(event.target.value.replace(/[^\d-]/g, '').slice(0, 7))}
                fullWidth
                placeholder="AAAA-MM"
                helperText={t('fieldOwner.receiptPeriodHelper')}
              />
            </Stack>

            <TextField
              label={t('fieldOwner.receiptPaidAtLabel')}
              type="date"
              value={receiptPaidAt}
              onChange={(event) => setReceiptPaidAt(event.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label={t('fieldOwner.receiptMethodLabel')}
              value={receiptMethod}
              onChange={(event) => setReceiptMethod(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 80 }}
            />

            <TextField
              label={t('fieldOwner.receiptNotesLabel')}
              value={receiptNotes}
              onChange={(event) => setReceiptNotes(event.target.value)}
              fullWidth
              multiline
              rows={2}
              inputProps={{ maxLength: 1000 }}
            />

            <Button
              component="label"
              variant="outlined"
              startIcon={<ReceiptIcon />}
              disabled={receiptActionLoading}
            >
              {receiptFile ? `${t('fieldOwner.receiptSelectedLabel')}: ${receiptFile.name}` : t('fieldOwner.receiptSelectLabel')}
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => handleReceiptFile(event.target.files?.[0] ?? null)}
              />
            </Button>

            <Button
              variant="contained"
              onClick={handleSubmitReceipt}
              disabled={receiptActionLoading || !receiptFile}
              startIcon={receiptActionLoading ? <CircularProgress size={16} /> : <PaidIcon />}
            >
              {t('fieldOwner.receiptSubmitLabel')}
            </Button>

            <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={800}>
                  {t('fieldOwner.paymentHistoryTitle')}
                </Typography>
                {subscriptionPayments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('fieldOwner.noPaymentsYet')}
                  </Typography>
                ) : (
                  subscriptionPayments.map((payment) => {
                    const status = getPaymentStatus(payment);
                    const receiptName = payment.receiptStoragePath?.split('/').pop();

                    return (
                      <Card key={payment.id} variant="outlined">
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {formatCurrency(payment.amountCents, locale) || t('fieldOwner.notConfigured')}
                                {payment.periodKey ? ` · ${payment.periodKey}` : ''}
                              </Typography>
                              <Chip
                                label={getPaymentStatusLabel(status)}
                                size="small"
                                color={getPaymentStatusColor(status)}
                                variant={status === 'APPROVED' ? 'filled' : 'outlined'}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {[
                                payment.method || null,
                                payment.paidAt ? t('fieldOwner.paidAtLabel', { value: formatDate(payment.paidAt, locale) }) : null,
                                receiptName || null,
                              ].filter(Boolean).join(' · ')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[
                                payment.submittedAt ? t('fieldOwner.submittedAtLabel', { value: payment.submittedAt.toLocaleString(locale) }) : null,
                              ].filter(Boolean).join(' · ')}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Stack>
            </Box>

            <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={800}>
                  {t('fieldOwner.ledgerTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('fieldOwner.ledgerDescription')}
                </Typography>
                {subscriptionLedger.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('fieldOwner.noLedgerEvents')}
                  </Typography>
                ) : (
                  subscriptionLedger.map((entry) => (
                    <Card key={entry.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={0.75}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {getLedgerTypeLabel(entry.type)}
                            </Typography>
                            {entry.reviewStatus ? (
                              <Chip
                                size="small"
                                label={getPaymentStatusLabel(entry.reviewStatus)}
                                color={getPaymentStatusColor(entry.reviewStatus)}
                                variant="outlined"
                              />
                            ) : null}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {[
                              entry.amountCents ? formatCurrency(entry.amountCents, locale) : null,
                              entry.periodKey || null,
                              entry.method || null,
                              entry.effectiveAt ? formatDate(entry.effectiveAt, locale) : null,
                            ].filter(Boolean).join(' · ')}
                          </Typography>
                          {(entry.previousSubscriptionStatus || entry.nextSubscriptionStatus || entry.monthlyFeeCents || entry.billingDueDay) ? (
                            <Typography variant="caption" color="text.secondary">
                              {[
                                entry.previousSubscriptionStatus || null,
                                entry.nextSubscriptionStatus ? `→ ${entry.nextSubscriptionStatus}` : null,
                                entry.monthlyFeeCents
                                  ? t('fieldOwner.planAmountLabel', { value: formatCurrency(entry.monthlyFeeCents, locale) })
                                  : null,
                                entry.billingDueDay
                                  ? t('fieldOwner.billingDayLabel', { value: entry.billingDueDay })
                                  : null,
                              ].filter(Boolean).join(' · ')}
                            </Typography>
                          ) : null}
                          {(entry.reason || entry.createdAt) ? (
                            <Typography variant="caption" color="text.secondary">
                              {[
                                entry.reason || null,
                                entry.createdAt ? t('fieldOwner.recordedAtLabel', { value: entry.createdAt.toLocaleString(locale) }) : null,
                              ].filter(Boolean).join(' · ')}
                            </Typography>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReceiptDialog} disabled={receiptActionLoading}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
