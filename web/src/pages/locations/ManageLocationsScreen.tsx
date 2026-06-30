import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  useTheme,
  Button,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  MenuItem,
  Stack,
  Alert,
} from '@mui/material';
import PageContainer from '../../components/common/PageContainer';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Add as AddIcon,
  LocationOn as LocationIcon,
  SportsSoccer as SoccerIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  ReceiptLong as ReceiptIcon,
  EmojiEvents as TrophyIcon,
  LocalOffer as OfferIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, where, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import {
  assignLocationOwner,
  deleteLocation,
  getAdminLocationBillingSummary,
  AdminLocationBillingSummaryResponse,
  inviteLocationManager,
  removeLocationManager,
  reviewLocationCommercialRequest,
  reviewLocationSubscriptionReceipt,
  setLocationPublicationStatus,
  setLocationSubscription,
  submitLocationSubscriptionReceipt,
} from '../../services/cloudFunctions';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenFab } from '../../components/layout';
import {
  Location,
  FieldType,
  FIELD_TYPE_CONFIG,
  LOCATION_BILLING_CYCLE_LABELS,
  LOCATION_BILLING_PLAN_LABELS,
  LOCATION_PUBLICATION_STATUS_LABELS,
  LOCATION_SUBSCRIPTION_STATUS_LABELS,
  LocationBillingCycle,
  LocationBillingPlanCode,
  LocationPublicationStatus,
  LocationSubscriptionStatus,
  canManageLocation,
  AMENITY_LABELS,
  COMMERCIAL_AMENITIES,
} from '../../types/location';
import {
  LocationBooleanFilter,
  LocationDueFilter,
  LocationMonthlyFeeFilter,
  getLocationCommercialIssues,
  getLocationPublicationStatus,
  getLocationSubscriptionStatus,
  locationMatchesManageFilters,
} from './manageLocationFilters';
import {
  getBestRatedLocations,
  getCheapestLocationsByType,
} from './manageLocationRankings';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('ManageLocationsScreen');
const RECEIPT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const RECEIPT_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

interface SubscriptionPaymentReview {
  id: string;
  amountCents?: number;
  periodKey?: string;
  method?: string | null;
  receiptStoragePath?: string | null;
  reviewStatus?: string;
  status?: string;
  submittedBy?: string;
  submittedAt?: Date | null;
  paidAt?: Date | null;
}

interface SubscriptionLedgerEntry {
  id: string;
  type?: string;
  amountCents?: number | null;
  periodKey?: string | null;
  paymentId?: string | null;
  method?: string | null;
  reviewStatus?: string | null;
  previousSubscriptionStatus?: string | null;
  nextSubscriptionStatus?: string | null;
  billingPlanCode?: string | null;
  billingPlanLabel?: string | null;
  billingCycle?: string | null;
  billingBaseFeeCents?: number | null;
  monthlyFeeCents?: number | null;
  billingDueDay?: number | null;
  billingExceptionNote?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
  createdAt?: Date | null;
  effectiveAt?: Date | null;
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
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

const getPaymentStatus = (payment: SubscriptionPaymentReview) =>
  payment.reviewStatus || payment.status || 'PENDING_REVIEW';

const getPaymentStatusLabel = (status: string) => {
  if (status === 'APPROVED') return 'Aprovado';
  if (status === 'REJECTED') return 'Rejeitado';
  if (status === 'PENDING_REVIEW') return 'Em revisão';
  return status;
};

const getPaymentStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'error';
  if (status === 'PENDING_REVIEW') return 'warning';
  return 'default';
};

const getLedgerTypeLabel = (type?: string) => {
  if (type === 'SUBSCRIPTION_STATUS_CHANGED') return 'Plano/status atualizado';
  if (type === 'PAYMENT_REGISTERED') return 'Pagamento registrado';
  if (type === 'PAYMENT_RECEIPT_SUBMITTED') return 'Comprovante enviado';
  if (type === 'PAYMENT_RECEIPT_APPROVED') return 'Comprovante aprovado';
  if (type === 'PAYMENT_RECEIPT_REJECTED') return 'Comprovante rejeitado';
  return type || 'Evento financeiro';
};

const getCommercialRequestStatusLabel = (status?: string) => {
  if (status === 'PENDING_REVIEW') return 'Em revisão';
  if (status === 'NEEDS_CHANGES') return 'Ajustes solicitados';
  if (status === 'APPROVED') return 'Aprovada';
  if (status === 'REJECTED') return 'Rejeitada';
  return 'Sem solicitação';
};

const getCommercialRequestTypeLabel = (type?: string) => {
  if (type === 'COMMERCIAL_UPDATE') return 'Alteração comercial';
  return 'Publicação';
};

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const ManageLocationsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.manageLocations'));
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const isAdmin = user?.role === 'ADMIN';

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [commercialActionLoading, setCommercialActionLoading] = useState<string | null>(null);
  const [publicationFilter, setPublicationFilter] = useState<'ALL' | LocationPublicationStatus>('ALL');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'ALL' | LocationSubscriptionStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | string>('ALL');
  const [dueFilter, setDueFilter] = useState<LocationDueFilter>('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
  const [verifiedFilter, setVerifiedFilter] = useState<LocationBooleanFilter>('ALL');
  const [activeFilter, setActiveFilter] = useState<LocationBooleanFilter>('ALL');
  const [activeFieldsFilter, setActiveFieldsFilter] = useState<LocationBooleanFilter>('ALL');
  const [monthlyFeeFilter, setMonthlyFeeFilter] = useState<LocationMonthlyFeeFilter>('ALL');
  const [billingPeriod, setBillingPeriod] = useState(currentPeriodKey());
  const [billingSummary, setBillingSummary] = useState<AdminLocationBillingSummaryResponse | null>(null);
  const [billingSummaryLoading, setBillingSummaryLoading] = useState(false);
  const [billingSummaryError, setBillingSummaryError] = useState<string | null>(null);
  const [billingTarget, setBillingTarget] = useState<Location | null>(null);
  const [billingPlanCode, setBillingPlanCode] = useState<LocationBillingPlanCode | ''>('');
  const [billingPlanLabel, setBillingPlanLabel] = useState('');
  const [billingCycle, setBillingCycle] = useState<LocationBillingCycle | ''>('');
  const [billingBaseFee, setBillingBaseFee] = useState('');
  const [billingMonthlyFee, setBillingMonthlyFee] = useState('');
  const [billingDueDay, setBillingDueDay] = useState('');
  const [billingStartsAt, setBillingStartsAt] = useState('');
  const [billingExceptionNote, setBillingExceptionNote] = useState('');
  const [billingNotes, setBillingNotes] = useState('');
  const [teamTarget, setTeamTarget] = useState<Location | null>(null);
  const [teamOwnerId, setTeamOwnerId] = useState('');
  const [teamReason, setTeamReason] = useState('');
  const [managerUid, setManagerUid] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [teamActionLoading, setTeamActionLoading] = useState<string | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<Location | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptPeriodKey, setReceiptPeriodKey] = useState(currentPeriodKey());
  const [receiptPaidAt, setReceiptPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [receiptMethod, setReceiptMethod] = useState('pix');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptActionLoading, setReceiptActionLoading] = useState<string | null>(null);
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPaymentReview[]>([]);
  const [subscriptionLedger, setSubscriptionLedger] = useState<SubscriptionLedgerEntry[]>([]);
  const [requestReviewTarget, setRequestReviewTarget] = useState<Location | null>(null);
  const [requestReviewNotes, setRequestReviewNotes] = useState('');
  const [requestReviewActionLoading, setRequestReviewActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const locRef = collection(db, 'locations');
    const q = isAdmin
      ? query(locRef, orderBy('name', 'asc'), limit(200))
      : query(locRef, where('owner_id', '==', user?.id ?? ''), orderBy('name', 'asc'), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const locData = snapshot.docs.map((d) => ({
          ...snakeToCamel<Location>(d.data()),
          id: d.id,
        }));
        setLocations(locData);
        setLoading(false);
      },
      (err) => {
        logger.error('Erro ao carregar locais:', err);
        setError(t('feedback.location.loadAllError'));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [reloadKey, isAdmin, user?.id, t]);

  useEffect(() => {
    if (!isAdmin) {
      setBillingSummary(null);
      setBillingSummaryError(null);
      setBillingSummaryLoading(false);
      return undefined;
    }
    let cancelled = false;
    setBillingSummaryLoading(true);
    setBillingSummaryError(null);
    getAdminLocationBillingSummary({ periodKey: billingPeriod })
      .then((result) => {
        if (cancelled) return;
        setBillingSummary(result.data);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Erro ao carregar resumo financeiro das quadras:', err);
        setBillingSummaryError('Não foi possível carregar o painel financeiro.');
      })
      .finally(() => {
        if (!cancelled) setBillingSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, billingPeriod]);

  useEffect(() => {
    if (!receiptTarget) {
      setSubscriptionPayments([]);
      setSubscriptionLedger([]);
      return undefined;
    }
    const paymentsRef = collection(db, 'locations', receiptTarget.id, 'subscription_payments');
    const paymentsQuery = query(paymentsRef, orderBy('created_at', 'desc'), limit(20));
    const unsubscribe = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        setSubscriptionPayments(snapshot.docs
          .map((paymentDoc) => {
            const data = snakeToCamel<Record<string, unknown>>(paymentDoc.data());
            return {
              id: paymentDoc.id,
              amountCents: typeof data.amountCents === 'number' ? data.amountCents : undefined,
              periodKey: typeof data.periodKey === 'string' ? data.periodKey : undefined,
              method: typeof data.method === 'string' ? data.method : null,
              receiptStoragePath: typeof data.receiptStoragePath === 'string' ? data.receiptStoragePath : null,
              reviewStatus: typeof data.reviewStatus === 'string' ? data.reviewStatus : undefined,
              status: typeof data.status === 'string' ? data.status : undefined,
              submittedBy: typeof data.submittedBy === 'string' ? data.submittedBy : undefined,
              submittedAt: toDate(data.submittedAt),
              paidAt: toDate(data.paidAt),
            };
          }));
      },
      (err) => {
        logger.error('Erro ao carregar comprovantes pendentes:', err);
        showError('Não foi possível carregar pagamentos e comprovantes.');
      },
    );
    return unsubscribe;
  }, [receiptTarget, showError]);

  useEffect(() => {
    if (!receiptTarget) {
      setSubscriptionLedger([]);
      return undefined;
    }
    const ledgerRef = collection(db, 'locations', receiptTarget.id, 'subscription_ledger');
    const ledgerQuery = query(ledgerRef, orderBy('created_at', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        setSubscriptionLedger(snapshot.docs.map((ledgerDoc) => {
          const data = snakeToCamel<Record<string, unknown>>(ledgerDoc.data());
          return {
            id: ledgerDoc.id,
            type: typeof data.type === 'string' ? data.type : undefined,
            amountCents: typeof data.amountCents === 'number' ? data.amountCents : null,
            periodKey: typeof data.periodKey === 'string' ? data.periodKey : null,
            paymentId: typeof data.paymentId === 'string' ? data.paymentId : null,
            method: typeof data.method === 'string' ? data.method : null,
            reviewStatus: typeof data.reviewStatus === 'string' ? data.reviewStatus : null,
            previousSubscriptionStatus: typeof data.previousSubscriptionStatus === 'string' ? data.previousSubscriptionStatus : null,
            nextSubscriptionStatus: typeof data.nextSubscriptionStatus === 'string' ? data.nextSubscriptionStatus : null,
            billingPlanCode: typeof data.billingPlanCode === 'string' ? data.billingPlanCode : null,
            billingPlanLabel: typeof data.billingPlanLabel === 'string' ? data.billingPlanLabel : null,
            billingCycle: typeof data.billingCycle === 'string' ? data.billingCycle : null,
            billingBaseFeeCents: typeof data.billingBaseFeeCents === 'number' ? data.billingBaseFeeCents : null,
            monthlyFeeCents: typeof data.monthlyFeeCents === 'number' ? data.monthlyFeeCents : null,
            billingDueDay: typeof data.billingDueDay === 'number' ? data.billingDueDay : null,
            billingExceptionNote: typeof data.billingExceptionNote === 'string' ? data.billingExceptionNote : null,
            reason: typeof data.reason === 'string' ? data.reason : null,
            actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : null,
            createdAt: toDate(data.createdAt),
            effectiveAt: toDate(data.effectiveAt),
          };
        }));
      },
      (err) => {
        logger.error('Erro ao carregar ledger financeiro da quadra:', err);
        showError('Não foi possível carregar o histórico financeiro.');
      },
    );
    return unsubscribe;
  }, [receiptTarget, showError]);

  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => locationMatchesManageFilters(loc, {
      searchQuery,
      ownerFilter,
      publicationFilter,
      subscriptionFilter,
      typeFilter,
      cityFilter,
      dueFilter,
      verifiedFilter,
      activeFilter,
      activeFieldsFilter,
      monthlyFeeFilter,
      amenityFilters,
    }));
  }, [
    locations,
    searchQuery,
    publicationFilter,
    subscriptionFilter,
    typeFilter,
    cityFilter,
    ownerFilter,
    dueFilter,
    verifiedFilter,
    activeFilter,
    activeFieldsFilter,
    monthlyFeeFilter,
    amenityFilters,
  ]);

  const cityOptions = useMemo(() => (
    Array.from(new Set(locations.map((loc) => loc.city).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    )
  ), [locations]);

  const billingRowsByLocationId = useMemo(() => new Map(
    (billingSummary?.locations || []).map((row) => [row.id, row]),
  ), [billingSummary]);

  const bestRatedLocations = useMemo(
    () => getBestRatedLocations(filteredLocations, 3),
    [filteredLocations],
  );

  const cheapestLocationsByType = useMemo(
    () => getCheapestLocationsByType(filteredLocations),
    [filteredLocations],
  );

  const canManage = (loc: Location) =>
    isAdmin || (user?.id ? canManageLocation(loc, user.id) : false);

  const canManageTeam = (loc: Location) =>
    isAdmin || Boolean(user?.id && loc.ownerId === user.id);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLocation({ locationId: deleteTarget.id });
      showSuccess(t('locations.deleteSuccess', { name: deleteTarget.name }));
      setDeleteTarget(null);
    } catch (err) {
      logger.error('Erro ao excluir local:', err);
      showError(t('feedback.location.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const handleClearSearch = () => setSearchQuery('');

  const handleExportBillingCsv = () => {
    if (!billingSummary) {
      showError('Carregue o resumo financeiro antes de exportar.');
      return;
    }
    const header = [
      'id',
      'nome',
      'owner_uid',
      'venue_account_id',
      'venue_account_status',
      'venue_account_scope',
      'venue_account_plan',
      'venue_account_total_centavos',
      'venue_account_quadras',
      'venue_account_campos_ativos',
      'cidade',
      'estado',
      'publicacao',
      'mensalidade_status',
      'plano',
      'ciclo',
      'plano_base_centavos',
      'mensalidade_centavos',
      'vencimento_dia',
      'inicio_cobranca',
      'previsto_centavos',
      'recebido_centavos',
      'saldo_centavos',
      'excecao_comercial',
      'comprovantes_pendentes',
      'ultimo_pagamento',
    ];
    const rows = billingSummary.locations.map((row) => [
      row.id,
      row.name,
      row.ownerId,
      row.venueAccountId,
      row.venueAccountStatus,
      row.venueAccountChargeScope,
      row.venueAccountPlanLabel || row.venueAccountPlanCode,
      row.venueAccountMonthlyTotalCents,
      row.venueAccountLinkedLocationsCount,
      row.venueAccountActiveFieldsCount,
      row.city,
      row.state,
      row.publicationStatus,
      row.subscriptionStatus,
      row.billingPlanLabel || row.billingPlanCode,
      row.billingCycle,
      row.billingBaseFeeCents,
      row.monthlyFeeCents,
      row.billingDueDay,
      row.billingStartsAtIso,
      row.expectedCents,
      row.receivedCents,
      row.openBalanceCents,
      row.billingExceptionNote,
      row.pendingReceiptCount,
      row.lastPaymentAtIso,
    ].map(csvCell).join(','));
    const csv = [header.map(csvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quadras-financeiro-${billingSummary.periodKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAmenityFilter = (amenity: string) => {
    setAmenityFilters((prev) =>
      prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity],
    );
  };

  const formatMonthlyFee = (monthlyFeeCents?: number) => {
    if (!monthlyFeeCents) return 'Mensalidade não definida';
    return formatCurrency(monthlyFeeCents);
  };

  const formatCurrency = (amountCents = 0) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amountCents / 100);
  };

  const getFieldTypeLabel = (fieldType?: FieldType | null) =>
    fieldType ? FIELD_TYPE_CONFIG[fieldType]?.label || fieldType : 'Quadra';

const formatBillingDate = (iso?: string | null) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('pt-BR');
};

const getBillingPlanLabel = (location: Pick<Location, 'billingPlanCode' | 'billingPlanLabel'>) => {
  if (location.billingPlanLabel?.trim()) return location.billingPlanLabel.trim();
  if (location.billingPlanCode) return LOCATION_BILLING_PLAN_LABELS[location.billingPlanCode];
  return null;
};

const getBillingCycleLabel = (cycle?: string | null) => {
  if (!cycle) return null;
  return LOCATION_BILLING_CYCLE_LABELS[cycle as LocationBillingCycle] || cycle;
};

const getVenueAccountScopeLabel = (scope?: string | null) => {
  if (scope === 'OWNER') return 'Cobrança por dono';
  if (scope === 'FIELD_COUNT') return 'Cobrança por campo';
  if (scope === 'MANUAL_OVERRIDE') return 'Cobrança manual';
  if (scope === 'LOCATION') return 'Cobrança por quadra';
  return null;
};

const getVenueAccountStatusLabel = (status?: string | null) => {
  if (status === 'TRIAL') return 'Conta em teste';
  if (status === 'ACTIVE') return 'Conta em dia';
  if (status === 'OVERDUE') return 'Conta em atraso';
  if (status === 'SUSPENDED') return 'Conta suspensa';
  if (status === 'CANCELLED') return 'Conta cancelada';
  return null;
};

const getVenueAccountStatusColor = (status?: string | null): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'TRIAL' || status === 'ACTIVE') return 'success';
  if (status === 'OVERDUE') return 'warning';
  if (status === 'SUSPENDED' || status === 'CANCELLED') return 'error';
  return 'default';
};

  const handlePublicationStatus = async (
    location: Location,
    publicationStatus: LocationPublicationStatus,
  ) => {
    const actionKey = `${location.id}:publication:${publicationStatus}`;
    setCommercialActionLoading(actionKey);
    try {
      await setLocationPublicationStatus({
        locationId: location.id,
        publicationStatus,
        reason: publicationStatus === 'PUBLISHED' ? undefined : 'Alterado pelo administrador',
      });
      showSuccess(
        `${location.name}: ${LOCATION_PUBLICATION_STATUS_LABELS[publicationStatus].toLowerCase()}.`,
      );
    } catch (err) {
      logger.error('Erro ao alterar publicação da quadra:', err);
      showError('Não foi possível alterar a publicação da quadra.');
    } finally {
      setCommercialActionLoading(null);
    }
  };

  const handleSubscriptionStatus = async (
    location: Location,
    subscriptionStatus: LocationSubscriptionStatus,
  ) => {
    const actionKey = `${location.id}:subscription:${subscriptionStatus}`;
    setCommercialActionLoading(actionKey);
    try {
      await setLocationSubscription({
        locationId: location.id,
        subscriptionStatus,
        monthlyFeeCents: location.monthlyFeeCents ?? null,
        billingDueDay: location.billingDueDay ?? null,
      });
      showSuccess(
        `${location.name}: mensalidade ${LOCATION_SUBSCRIPTION_STATUS_LABELS[subscriptionStatus].toLowerCase()}.`,
      );
    } catch (err) {
      logger.error('Erro ao alterar mensalidade da quadra:', err);
      showError('Não foi possível alterar a mensalidade da quadra.');
    } finally {
      setCommercialActionLoading(null);
    }
  };

  const handleReviewCommercialRequest = async (
    location: Location,
    decision: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED',
  ) => {
    if (!location.latestCommercialRequestId) {
      showError('Esta quadra não possui solicitação ativa para revisão.');
      return;
    }
    const actionKey = `${location.id}:request:${decision}`;
    setRequestReviewActionLoading(actionKey);
    try {
      await reviewLocationCommercialRequest({
        locationId: location.id,
        requestId: location.latestCommercialRequestId,
        decision,
        notes: requestReviewNotes.trim() || null,
      });
      showSuccess(
        decision === 'APPROVED'
          ? 'Solicitação aprovada com sucesso.'
          : decision === 'NEEDS_CHANGES'
            ? 'Solicitação devolvida para ajustes.'
            : 'Solicitação rejeitada.',
      );
      setRequestReviewTarget(null);
      setRequestReviewNotes('');
    } catch (err) {
      logger.error('Erro ao revisar solicitação comercial:', err);
      showError('Não foi possível revisar a solicitação comercial.');
    } finally {
      setRequestReviewActionLoading(null);
    }
  };

  const openBillingDialog = (location: Location) => {
    setBillingTarget(location);
    setBillingPlanCode(location.billingPlanCode || '');
    setBillingPlanLabel(location.billingPlanLabel || '');
    setBillingCycle(location.billingCycle || '');
    setBillingBaseFee(location.billingBaseFeeCents ? String(location.billingBaseFeeCents / 100) : '');
    setBillingMonthlyFee(location.monthlyFeeCents ? String(location.monthlyFeeCents / 100) : '');
    setBillingDueDay(location.billingDueDay ? String(location.billingDueDay) : '');
    setBillingStartsAt(toDate(location.billingStartsAt)?.toISOString().slice(0, 10) || '');
    setBillingExceptionNote(location.billingExceptionNote || '');
    setBillingNotes(location.adminNotes || '');
  };

  const openReceiptDialog = (location: Location) => {
    setReceiptTarget(location);
    setReceiptFile(null);
    setReceiptAmount(location.monthlyFeeCents ? String(location.monthlyFeeCents / 100) : '');
    setReceiptPeriodKey(currentPeriodKey());
    setReceiptPaidAt(new Date().toISOString().slice(0, 10));
    setReceiptMethod('pix');
    setReceiptNotes('');
  };

  const openTeamDialog = (location: Location) => {
    setTeamTarget(location);
    setTeamOwnerId(location.ownerId || '');
    setTeamReason('');
    setManagerUid('');
    setManagerEmail('');
  };

  const handleSaveBilling = async () => {
    if (!billingTarget) return;
    const billingBaseFeeCents = billingBaseFee.trim()
      ? Math.round(Number(billingBaseFee.replace(',', '.')) * 100)
      : null;
    const monthlyFeeCents = billingMonthlyFee.trim()
      ? Math.round(Number(billingMonthlyFee.replace(',', '.')) * 100)
      : null;
    const billingDue = billingDueDay.trim() ? Number(billingDueDay) : null;
    if (billingBaseFeeCents !== null && (!Number.isFinite(billingBaseFeeCents) || billingBaseFeeCents < 0)) {
      showError('Informe um valor base válido.');
      return;
    }
    if (monthlyFeeCents !== null && (!Number.isFinite(monthlyFeeCents) || monthlyFeeCents < 0)) {
      showError('Informe uma mensalidade válida.');
      return;
    }
    if (billingDue !== null && (!Number.isInteger(billingDue) || billingDue < 1 || billingDue > 28)) {
      showError('Dia de vencimento deve ficar entre 1 e 28.');
      return;
    }
    if (billingStartsAt.trim() && Number.isNaN(new Date(`${billingStartsAt}T00:00:00.000Z`).getTime())) {
      showError('Informe uma data de início válida.');
      return;
    }
    const actionKey = `${billingTarget.id}:billing`;
    setCommercialActionLoading(actionKey);
    try {
      await setLocationSubscription({
        locationId: billingTarget.id,
        subscriptionStatus: getLocationSubscriptionStatus(billingTarget),
        billingPlanCode: billingPlanCode || null,
        billingPlanLabel: billingPlanLabel.trim() || null,
        billingCycle: billingCycle || null,
        billingBaseFeeCents,
        monthlyFeeCents,
        billingDueDay: billingDue,
        billingStartsAtIso: billingStartsAt.trim() ? `${billingStartsAt}T00:00:00.000Z` : null,
        billingExceptionNote: billingExceptionNote.trim() || null,
        adminNotes: billingNotes.trim() || null,
      });
      showSuccess('Configuração comercial atualizada.');
      setBillingTarget(null);
    } catch (err) {
      logger.error('Erro ao salvar mensalidade:', err);
      showError('Não foi possível salvar a configuração comercial.');
    } finally {
      setCommercialActionLoading(null);
    }
  };

  const handleReceiptFile = (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
      showError('Comprovante precisa ser JPG, PNG, WebP ou PDF.');
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      showError('Comprovante precisa ter até 10 MB.');
      return;
    }
    setReceiptFile(file);
  };

  const uploadReceipt = async (location: Location, file: File) => {
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
  };

  const handleSubmitReceipt = async (approveImmediately = false) => {
    if (!receiptTarget || !receiptFile) {
      showError('Selecione o comprovante.');
      return;
    }
    const amountCents = Math.round(Number(receiptAmount.replace(',', '.')) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      showError('Informe o valor pago.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(receiptPeriodKey.trim())) {
      showError('Informe o período no formato AAAA-MM.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptPaidAt.trim())) {
      showError('Informe a data de pagamento.');
      return;
    }
    setReceiptActionLoading(approveImmediately ? 'submit-approve' : 'submit');
    try {
      const receiptStoragePath = await uploadReceipt(receiptTarget, receiptFile);
      const submitted = await submitLocationSubscriptionReceipt({
        locationId: receiptTarget.id,
        amountCents,
        periodKey: receiptPeriodKey.trim(),
        paidAtIso: `${receiptPaidAt.trim()}T12:00:00.000Z`,
        method: receiptMethod.trim() || null,
        receiptStoragePath,
        notes: receiptNotes.trim() || null,
      });
      if (approveImmediately && isAdmin) {
        await reviewLocationSubscriptionReceipt({
          locationId: receiptTarget.id,
          paymentId: submitted.data.paymentId,
          decision: 'APPROVED',
          notes: receiptNotes.trim() || 'Registrado manualmente pelo administrador.',
        });
        showSuccess('Pagamento registrado, aprovado e mensalidade ativada.');
      } else {
        showSuccess('Comprovante enviado para revisão. A mensalidade só muda após aprovação.');
      }
      setReceiptFile(null);
      setReceiptNotes('');
    } catch (err) {
      logger.error('Erro ao enviar comprovante da quadra:', err);
      showError('Não foi possível enviar o comprovante.');
    } finally {
      setReceiptActionLoading(null);
    }
  };

  const handleReviewReceipt = async (
    payment: SubscriptionPaymentReview,
    decision: 'APPROVED' | 'REJECTED',
  ) => {
    if (!receiptTarget || !isAdmin) return;
    setReceiptActionLoading(`${decision}:${payment.id}`);
    try {
      await reviewLocationSubscriptionReceipt({
        locationId: receiptTarget.id,
        paymentId: payment.id,
        decision,
        notes: receiptNotes.trim() || null,
      });
      showSuccess(decision === 'APPROVED'
        ? 'Comprovante aprovado e mensalidade ativada.'
        : 'Comprovante rejeitado sem alterar a mensalidade.');
    } catch (err) {
      logger.error('Erro ao revisar comprovante da quadra:', err);
      showError('Não foi possível revisar o comprovante.');
    } finally {
      setReceiptActionLoading(null);
    }
  };

  const handleAssignOwner = async () => {
    if (!teamTarget || !isAdmin) return;
    const newOwnerId = teamOwnerId.trim();
    if (!newOwnerId) {
      showError('Informe o UID do novo dono.');
      return;
    }
    setTeamActionLoading('assign-owner');
    try {
      await assignLocationOwner({
        locationId: teamTarget.id,
        newOwnerId,
        reason: teamReason.trim() || null,
      });
      showSuccess('Dono da quadra atualizado.');
      setTeamTarget(null);
    } catch (err) {
      logger.error('Erro ao transferir dono da quadra:', err);
      showError('Não foi possível atualizar o dono da quadra.');
    } finally {
      setTeamActionLoading(null);
    }
  };

  const handleInviteManager = async () => {
    if (!teamTarget) return;
    const uid = managerUid.trim();
    const email = managerEmail.trim();
    if (!uid && !email) {
      showError('Informe o UID ou email do gerente.');
      return;
    }
    setTeamActionLoading('invite-manager');
    try {
      const result = await inviteLocationManager({
        locationId: teamTarget.id,
        managerUid: uid || null,
        managerEmail: email || null,
      });
      showSuccess(
        result.data.alreadyManager
          ? 'Este usuário já é gerente da quadra.'
          : 'Convite de gerente criado. O acesso só libera após aceite.',
      );
      setManagerUid('');
      setManagerEmail('');
    } catch (err) {
      logger.error('Erro ao convidar gerente da quadra:', err);
      showError('Não foi possível convidar o gerente.');
    } finally {
      setTeamActionLoading(null);
    }
  };

  const handleRemoveManager = async (uid: string) => {
    if (!teamTarget) return;
    setTeamActionLoading(`remove-manager:${uid}`);
    try {
      await removeLocationManager({
        locationId: teamTarget.id,
        managerUid: uid,
        reason: teamReason.trim() || null,
      });
      showSuccess('Gerente removido da quadra.');
      setTeamTarget((current) => current ? {
        ...current,
        managers: current.managers.filter((managerId) => managerId !== uid),
      } : current);
    } catch (err) {
      logger.error('Erro ao remover gerente da quadra:', err);
      showError('Não foi possível remover o gerente.');
    } finally {
      setTeamActionLoading(null);
    }
  };

  return (
    <>
      {/* Header sticky */}
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
          <IconButton onClick={() => navigate('/?tab=4')} aria-label={t('a11y.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('locations.manage')}
          </Typography>
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<AdminIcon />}
              onClick={() => navigate('/admin/users')}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, mr: 1 }}
            >
              Usuários
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/location/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {t('locations.addLocation')}
          </Button>
        </Box>
        <Box
          sx={{
            px: 2,
            pb: 2,
            '& .MuiInputBase-root': {
              minHeight: { xs: 44, sm: 'auto' },
            },
          }}
        >
          <Stack spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('placeholder.searchGroupNameAddressCity')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('a11y.searchLocations')}
              inputProps={{ maxLength: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClearSearch} aria-label={t('a11y.clearSearch')} edge="end" sx={{ minWidth: 44, minHeight: 44 }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            {isAdmin && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField select size="small" label="Publicação" value={publicationFilter} onChange={(e) => setPublicationFilter(e.target.value as 'ALL' | LocationPublicationStatus)} fullWidth>
                    <MenuItem value="ALL">Todas</MenuItem>
                    {Object.entries(LOCATION_PUBLICATION_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Mensalidade" value={subscriptionFilter} onChange={(e) => setSubscriptionFilter(e.target.value as 'ALL' | LocationSubscriptionStatus)} fullWidth>
                    <MenuItem value="ALL">Todas</MenuItem>
                    {Object.entries(LOCATION_SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Tipo" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} fullWidth>
                    <MenuItem value="ALL">Todos</MenuItem>
                    {Object.entries(FIELD_TYPE_CONFIG).map(([value, config]) => (
                      <MenuItem key={value} value={value}>{config.label}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Período financeiro"
                    value={billingPeriod}
                    onChange={(e) => setBillingPeriod(e.target.value.replace(/[^\d-]/g, '').slice(0, 7))}
                    helperText="AAAA-MM"
                    fullWidth
                  />
                  <TextField select size="small" label="Vencimento" value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)} fullWidth>
                    <MenuItem value="ALL">Todos</MenuItem>
                    <MenuItem value="1_7">Dia 1 a 7</MenuItem>
                    <MenuItem value="8_14">Dia 8 a 14</MenuItem>
                    <MenuItem value="15_21">Dia 15 a 21</MenuItem>
                    <MenuItem value="22_28">Dia 22 a 28</MenuItem>
                    <MenuItem value="NO_DUE">Sem vencimento</MenuItem>
                  </TextField>
                  <TextField select size="small" label="Cidade" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} fullWidth>
                    <MenuItem value="ALL">Todas</MenuItem>
                    {cityOptions.map((city) => (
                      <MenuItem key={city} value={city}>{city}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Dono (UID)"
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                    fullWidth
                    placeholder="Filtrar por UID"
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField select size="small" label="Verificada" value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value as LocationBooleanFilter)} fullWidth>
                    <MenuItem value="ALL">Todas</MenuItem>
                    <MenuItem value="YES">Sim</MenuItem>
                    <MenuItem value="NO">Não</MenuItem>
                  </TextField>
                  <TextField select size="small" label="Ativa" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as LocationBooleanFilter)} fullWidth>
                    <MenuItem value="ALL">Todas</MenuItem>
                    <MenuItem value="YES">Sim</MenuItem>
                    <MenuItem value="NO">Não</MenuItem>
                  </TextField>
                  <TextField select size="small" label="Campos ativos" value={activeFieldsFilter} onChange={(e) => setActiveFieldsFilter(e.target.value as LocationBooleanFilter)} fullWidth>
                    <MenuItem value="ALL">Todos</MenuItem>
                    <MenuItem value="YES">Com campos ativos</MenuItem>
                    <MenuItem value="NO">Sem campos ativos</MenuItem>
                  </TextField>
                  <TextField select size="small" label="Mensalidade" value={monthlyFeeFilter} onChange={(e) => setMonthlyFeeFilter(e.target.value as LocationMonthlyFeeFilter)} fullWidth>
                    <MenuItem value="ALL">Todas</MenuItem>
                    <MenuItem value="NO_FEE">Sem mensalidade</MenuItem>
                    <MenuItem value="UP_TO_100">Até R$ 100</MenuItem>
                    <MenuItem value="100_300">R$ 100 a R$ 300</MenuItem>
                    <MenuItem value="300_PLUS">Acima de R$ 300</MenuItem>
                  </TextField>
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pb: 0.5 }}>
                  {COMMERCIAL_AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity}
                      label={AMENITY_LABELS[amenity] || amenity}
                      size="small"
                      color={amenityFilters.includes(amenity) ? 'primary' : 'default'}
                      variant={amenityFilters.includes(amenity) ? 'filled' : 'outlined'}
                      onClick={() => handleAmenityFilter(amenity)}
                      sx={{
                        minHeight: { xs: 44, sm: 32 },
                        px: { xs: 0.5, sm: 0 },
                      }}
                    />
                  ))}
                </Box>
              </>
            )}
          </Stack>
        </Box>
      </Box>

      <PageContainer maxWidth="list">
        {error && (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        )}

        {!loading && !error && (
          <>
            {isAdmin && (
              <>
                {billingSummaryError && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {billingSummaryError}
                  </Alert>
                )}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, minmax(0, 1fr))' },
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">MRR previsto</Typography>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {billingSummaryLoading ? '...' : formatCurrency(billingSummary?.summary.expectedMrrCents || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Recebido {billingPeriod}</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="success.main">
                        {billingSummaryLoading ? '...' : formatCurrency(billingSummary?.summary.receivedCents || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Vencido</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color={(billingSummary?.summary.overdueCents || 0) > 0 ? 'warning.main' : 'text.primary'}>
                        {billingSummaryLoading ? '...' : formatCurrency(billingSummary?.summary.overdueCents || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Trial</Typography>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {billingSummaryLoading ? '...' : `${billingSummary?.summary.trialLocations || 0} · ${formatCurrency(billingSummary?.summary.trialCents || 0)}`}
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">Suspenso</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color={(billingSummary?.summary.suspendedCents || 0) > 0 ? 'error.main' : 'text.primary'}>
                        {billingSummaryLoading ? '...' : `${billingSummary?.summary.suspendedLocations || 0} · ${formatCurrency(billingSummary?.summary.suspendedCents || 0)}`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                {billingSummary && !billingSummary.scanComplete && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Resumo limitado às primeiras {billingSummary.scanLimit} quadras. Criar agregação paginada antes de escalar volume maior.
                  </Alert>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Resumo gerado pelo backend para {billingSummary?.periodKey || billingPeriod}
                    {billingSummary?.generatedAtIso ? ` em ${new Date(billingSummary.generatedAtIso).toLocaleString('pt-BR')}` : ''}.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleExportBillingCsv}
                    disabled={billingSummaryLoading || !billingSummary}
                  >
                    Exportar CSV
                  </Button>
                </Box>
              </>
            )}
            {(bestRatedLocations.length > 0 || cheapestLocationsByType.length > 0) && (
              <Card
                variant="outlined"
                sx={{
                  mb: 2,
                  overflow: 'hidden',
                  borderColor: theme.palette.success.light,
                  background: `linear-gradient(135deg, ${theme.palette.success.light}18 0%, ${theme.palette.background.paper} 42%, ${theme.palette.warning.light}14 100%)`,
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    {bestRatedLocations.length > 0 && (
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: 'warning.light',
                              color: 'warning.contrastText',
                            }}
                          >
                            <TrophyIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={800}>
                              Melhores quadras
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Nota real, avaliações e jogos como desempate.
                            </Typography>
                          </Box>
                        </Stack>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(3, minmax(210px, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1,
                            overflowX: { xs: 'auto', sm: 'visible' },
                            pb: { xs: 0.5, sm: 0 },
                          }}
                        >
                          {bestRatedLocations.map((item, index) => (
                            <Card
                              key={item.location.id}
                              variant="outlined"
                              sx={{ bgcolor: 'background.paper', minWidth: { xs: 210, sm: 0 } }}
                            >
                              <CardActionArea onClick={() => navigate(`/location/${item.location.id}`)}>
                                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                                    <Typography variant="caption" color="text.secondary">
                                      #{index + 1}
                                    </Typography>
                                    <Rating value={item.rating} precision={0.1} readOnly size="small" />
                                  </Stack>
                                  <Typography variant="body2" fontWeight={800} noWrap>
                                    {item.location.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {item.rating.toFixed(1)} de nota · {item.ratingCount} avaliação(ões)
                                  </Typography>
                                </CardContent>
                              </CardActionArea>
                            </Card>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {cheapestLocationsByType.length > 0 && (
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: 'success.light',
                              color: 'success.contrastText',
                            }}
                          >
                            <OfferIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={800}>
                              Mais baratas por tipo
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Preço mínimo por hora calculado no backend.
                            </Typography>
                          </Box>
                        </Stack>
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            overflowX: 'auto',
                            pb: 0.5,
                          }}
                        >
                          {cheapestLocationsByType.map((item) => (
                            <Card
                              key={item.fieldType}
                              variant="outlined"
                              sx={{ minWidth: 178, bgcolor: 'background.paper' }}
                            >
                              <CardActionArea onClick={() => navigate(`/location/${item.location.id}`)}>
                                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                                  <Chip
                                    size="small"
                                    label={getFieldTypeLabel(item.fieldType)}
                                    sx={{ mb: 0.75 }}
                                  />
                                  <Typography variant="h6" fontWeight={900} lineHeight={1.1}>
                                    {formatCurrency(item.priceCents)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {item.location.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {item.activeFieldCount || 1} campo(s) ativo(s)
                                  </Typography>
                                </CardContent>
                              </CardActionArea>
                            </Card>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('locations.localsCount', { count: filteredLocations.length })}
              {searchQuery && ` ${t('locations.searchingFor', { query: searchQuery })}`}
            </Typography>
          </>
        )}

        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : (loading || error) ? null : filteredLocations.length === 0 ? (
          <EmptyState
            icon={<LocationIcon />}
            title={searchQuery ? t('locations.noLocationsFound') : t('locations.noLocations')}
            description={
              searchQuery
                ? t('locations.tryDifferentSearch')
                : t('locations.addLocationsDesc')
            }
            actionLabel={searchQuery ? t('empty.clearSearch') : t('locations.addFirstLocation')}
            actionIcon={searchQuery ? undefined : <AddIcon />}
            onAction={searchQuery ? handleClearSearch : () => navigate('/location/create')}
            actionVariant={searchQuery ? 'outlined' : 'contained'}
          />
        ) : (
          !error && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {isAdmin && filteredLocations.some((location) => location.latestCommercialRequestStatus === 'PENDING_REVIEW') && (
                <Alert severity="info">
                  {filteredLocations.filter((location) => location.latestCommercialRequestStatus === 'PENDING_REVIEW').length} solicitação(ões) comercial(is) aguardando revisão administrativa.
                </Alert>
              )}
              {filteredLocations.map((location) => {
                const fieldTypeLabel = location.fieldType
                  ? FIELD_TYPE_CONFIG[location.fieldType]?.label || location.fieldType
                  : null;
                const userCanManage = canManage(location);
                const userCanManageTeam = canManageTeam(location);
                const publicationStatus = getLocationPublicationStatus(location);
                const subscriptionStatus = getLocationSubscriptionStatus(location);
                const isCommercialActionBusy = commercialActionLoading?.startsWith(`${location.id}:`) ?? false;
                const billingRow = billingRowsByLocationId.get(location.id);
                const commercialIssues = getLocationCommercialIssues(location);
                const hasCommercialRequest = Boolean(location.latestCommercialRequestStatus);
                const requestPending = location.latestCommercialRequestStatus === 'PENDING_REVIEW';
                const venueAccountId = billingRow?.venueAccountId || location.venueAccountId || null;
                const venueAccountStatus = billingRow?.venueAccountStatus || location.venueAccountStatus || null;
                const venueAccountScope = billingRow?.venueAccountChargeScope || location.venueAccountChargeScope || null;
                const venueAccountPlanLabel =
                  billingRow?.venueAccountPlanLabel ||
                  location.venueAccountPlanLabel ||
                  null;
                const venueAccountMonthlyTotalCents =
                  billingRow?.venueAccountMonthlyTotalCents ??
                  location.venueAccountMonthlyTotalCents ??
                  null;
                const venueAccountLinkedLocationsCount =
                  billingRow?.venueAccountLinkedLocationsCount ??
                  location.venueAccountLinkedLocationsCount ??
                  null;
                const venueAccountActiveFieldsCount =
                  billingRow?.venueAccountActiveFieldsCount ??
                  location.venueAccountActiveFieldsCount ??
                  null;

                return (
                  <Card key={location.id} sx={{ position: 'relative' }}>
                    <CardActionArea onClick={() => navigate(`/location/${location.id}`)}>
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                          {location.photoUrl ? (
                            <Box
                              component="img"
                              src={location.photoUrl}
                              alt={location.name}
                              loading="lazy"
                              sx={{
                                width: { xs: '100%', sm: 80 },
                                height: { xs: 148, sm: 80 },
                                borderRadius: 1,
                                objectFit: 'cover',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <Avatar
                              variant="rounded"
                              sx={{
                                width: { xs: '100%', sm: 80 },
                                height: { xs: 148, sm: 80 },
                                bgcolor: 'primary.main',
                                flexShrink: 0,
                              }}
                            >
                              <SoccerIcon />
                            </Avatar>
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={600} noWrap>
                              {location.name}
                            </Typography>
                            <Box
                              sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.25 }}
                            >
                              <LocationIcon
                                color="action"
                                sx={{ fontSize: 16, mt: 0.25, flexShrink: 0 }}
                              />
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {[location.address, location.district, location.city, location.state]
                                  .filter(Boolean)
                                  .join(', ')}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Rating
                                value={location.averageRating || location.rating || 0}
                                precision={0.5}
                                size="small"
                                readOnly
                              />
                              <Typography variant="caption" color="text.secondary">
                                ({location.reviewCount || location.ratingCount || 0})
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                              {fieldTypeLabel && (
                                <Chip label={fieldTypeLabel} size="small" color="primary" variant="outlined" />
                              )}
                              {location.playersPerTeam && (
                                <Chip
                                  label={`${location.playersPerTeam}v${location.playersPerTeam}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {(location.fieldCount ?? 0) > 0 && (
                                <Chip
                                  label={t('locations.fieldsCount', { count: location.fieldCount ?? 0 })}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                label={LOCATION_PUBLICATION_STATUS_LABELS[publicationStatus]}
                                size="small"
                                color={publicationStatus === 'PUBLISHED' ? 'success' : 'warning'}
                                variant={publicationStatus === 'PUBLISHED' ? 'filled' : 'outlined'}
                              />
                              <Chip
                                label={LOCATION_SUBSCRIPTION_STATUS_LABELS[subscriptionStatus]}
                                size="small"
                                color={['TRIAL', 'ACTIVE'].includes(subscriptionStatus) ? 'success' : 'error'}
                                variant="outlined"
                              />
                              {isAdmin && (
                                <>
                                  <Chip
                                    label={location.isActive ? 'Ativa' : 'Inativa'}
                                    size="small"
                                    color={location.isActive ? 'success' : 'error'}
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={location.isVerified ? 'Verificada' : 'Não verificada'}
                                    size="small"
                                    color={location.isVerified ? 'success' : 'warning'}
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={location.hasActiveFields ? 'Campos ativos' : 'Sem campos ativos'}
                                    size="small"
                                    color={location.hasActiveFields ? 'success' : 'warning'}
                                    variant="outlined"
                                  />
                                </>
                              )}
                              {isAdmin && (
                                <Chip
                                  label={formatMonthlyFee(location.monthlyFeeCents)}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {isAdmin && getBillingPlanLabel(location) && (
                                <Chip
                                  label={`Plano ${getBillingPlanLabel(location)}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {isAdmin && location.billingCycle && (
                                <Chip
                                  label={`Ciclo ${getBillingCycleLabel(location.billingCycle)}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {isAdmin && location.billingBaseFeeCents ? (
                                <Chip
                                  label={`Base ${formatCurrency(location.billingBaseFeeCents)}`}
                                  size="small"
                                  variant="outlined"
                                />
                              ) : null}
                              {isAdmin && venueAccountId && (
                                <>
                                  <Chip
                                    label="Conta comercial"
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                  {getVenueAccountStatusLabel(venueAccountStatus) && (
                                    <Chip
                                      label={getVenueAccountStatusLabel(venueAccountStatus)}
                                      size="small"
                                      color={getVenueAccountStatusColor(venueAccountStatus)}
                                      variant="outlined"
                                    />
                                  )}
                                  {getVenueAccountScopeLabel(venueAccountScope) && (
                                    <Chip
                                      label={getVenueAccountScopeLabel(venueAccountScope)}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                  {venueAccountPlanLabel && (
                                    <Chip
                                      label={`Plano ${venueAccountPlanLabel}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                  {typeof venueAccountMonthlyTotalCents === 'number' && (
                                    <Chip
                                      label={`Conta ${formatCurrency(venueAccountMonthlyTotalCents)}`}
                                      size="small"
                                      color="success"
                                      variant="outlined"
                                    />
                                  )}
                                  {typeof venueAccountLinkedLocationsCount === 'number' && (
                                    <Chip
                                      label={`${venueAccountLinkedLocationsCount} quadra(s) no pacote`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                  {typeof venueAccountActiveFieldsCount === 'number' && (
                                    <Chip
                                      label={`${venueAccountActiveFieldsCount} campo(s) ativos`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                </>
                              )}
                              {isAdmin && billingRow && (
                                <>
                                  <Chip
                                    label={`Recebido ${formatCurrency(billingRow.receivedCents)}`}
                                    size="small"
                                    color={billingRow.receivedCents > 0 ? 'success' : 'default'}
                                    variant="outlined"
                                  />
                                  {billingRow.currentBillingCycleStatus && (
                                    <Chip
                                      label={`Ciclo ${billingRow.currentBillingCycleStatus}`}
                                      size="small"
                                      color={billingRow.currentBillingOpenBalanceCents > 0 ? 'warning' : 'success'}
                                      variant="outlined"
                                    />
                                  )}
                                  <Chip
                                    label={`Saldo ${formatCurrency(
                                      billingRow.currentBillingOpenBalanceCents ||
                                      billingRow.openBalanceCents,
                                    )}`}
                                    size="small"
                                    color={
                                      (billingRow.currentBillingOpenBalanceCents ||
                                        billingRow.openBalanceCents) > 0 ?
                                        'warning' :
                                        'success'
                                    }
                                    variant="outlined"
                                  />
                                  {billingRow.pendingReceiptCount > 0 && (
                                    <Chip
                                      label={`${billingRow.pendingReceiptCount} comprovante(s) pendente(s)`}
                                      size="small"
                                      color="warning"
                                      variant="filled"
                                    />
                                  )}
                                  {formatBillingDate(billingRow.billingDueAtIso) && (
                                    <Chip
                                      label={`Venc. ${formatBillingDate(billingRow.billingDueAtIso)}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                  {(billingRow.currentBillingOpenBalanceCents > 0 &&
                                    formatBillingDate(billingRow.billingSuspendAtIso)) && (
                                    <Chip
                                      label={`Susp. ${formatBillingDate(billingRow.billingSuspendAtIso)}`}
                                      size="small"
                                      color="error"
                                      variant="outlined"
                                    />
                                  )}
                                  {billingRow.billingDueDay && (
                                    <Chip
                                      label={`Vence dia ${billingRow.billingDueDay}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                  {billingRow.billingStartsAtIso && (
                                    <Chip
                                      label={`Início ${formatBillingDate(billingRow.billingStartsAtIso)}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                </>
                              )}
                            </Box>
                            {isAdmin && (
                              <Alert severity={commercialIssues.length === 0 ? 'success' : 'warning'} sx={{ mt: 1 }}>
                                {commercialIssues.length === 0
                                  ? 'Cadastro comercial completo e visível para usuários.'
                                  : `Pendências: ${commercialIssues.slice(0, 4).join(', ')}${commercialIssues.length > 4 ? '...' : ''}.`}
                              </Alert>
                            )}
                            {isAdmin && venueAccountId && (
                              <Alert
                                severity={venueAccountStatus === 'OVERDUE' || venueAccountStatus === 'SUSPENDED' ? 'warning' : 'info'}
                                sx={{ mt: 1 }}
                              >
                                Esta quadra está vinculada à conta comercial agregada {venueAccountId}
                                {getVenueAccountScopeLabel(venueAccountScope) ? ` · ${getVenueAccountScopeLabel(venueAccountScope)}` : ''}
                                {typeof venueAccountLinkedLocationsCount === 'number' ? ` · ${venueAccountLinkedLocationsCount} quadra(s) no mesmo contrato` : ''}.
                              </Alert>
                            )}
                            {(isAdmin &&
                              (billingRow?.billingExceptionNote ||
                                (typeof location.billingBaseFeeCents === 'number' &&
                                  typeof location.monthlyFeeCents === 'number' &&
                                  location.billingBaseFeeCents !== location.monthlyFeeCents))) ? (
                              <Alert severity="info" sx={{ mt: 1 }}>
                                {billingRow?.billingExceptionNote
                                  || 'Cobrança negociada com exceção comercial em relação ao plano base.'}
                              </Alert>
                            ) : null}
                            {isAdmin && hasCommercialRequest && (
                              <Alert
                                severity={requestPending ? 'info' : location.latestCommercialRequestStatus === 'REJECTED' ? 'error' : 'success'}
                                sx={{ mt: 1 }}
                              >
                                <Stack spacing={0.5}>
                                  <Typography variant="body2" fontWeight={700}>
                                    {getCommercialRequestTypeLabel(location.latestCommercialRequestType)} · {getCommercialRequestStatusLabel(location.latestCommercialRequestStatus)}
                                  </Typography>
                                  {location.latestCommercialRequestRequestedSections?.length ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Seções: {location.latestCommercialRequestRequestedSections.join(' · ')}
                                    </Typography>
                                  ) : null}
                                  {location.latestCommercialRequestPendingItemIds?.length ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Checklist pendente: {location.latestCommercialRequestPendingItemIds.join(' · ')}
                                    </Typography>
                                  ) : null}
                                  {location.latestCommercialRequestCommercialIssueCodes?.length ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Issues comerciais: {location.latestCommercialRequestCommercialIssueCodes.join(' · ')}
                                    </Typography>
                                  ) : null}
                                  {location.latestCommercialRequestOwnerNotes ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Dono: {location.latestCommercialRequestOwnerNotes}
                                    </Typography>
                                  ) : null}
                                  {location.latestCommercialRequestAdminNotes ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Admin: {location.latestCommercialRequestAdminNotes}
                                    </Typography>
                                  ) : null}
                                </Stack>
                              </Alert>
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                    {isAdmin && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
                        {publicationStatus === 'PUBLISHED' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={isCommercialActionBusy}
                            onClick={() => handlePublicationStatus(location, 'SUSPENDED')}
                          >
                            Suspender
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={isCommercialActionBusy}
                            onClick={() => handlePublicationStatus(location, 'PUBLISHED')}
                          >
                            Publicar
                          </Button>
                        )}
                        {['TRIAL', 'ACTIVE'].includes(subscriptionStatus) ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            disabled={isCommercialActionBusy}
                            onClick={() => handleSubscriptionStatus(location, 'OVERDUE')}
                          >
                            Marcar vencida
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            disabled={isCommercialActionBusy}
                            onClick={() => handleSubscriptionStatus(location, 'ACTIVE')}
                          >
                            Marcar em dia
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={isCommercialActionBusy}
                          onClick={() => openBillingDialog(location)}
                        >
                          Mensalidade
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ReceiptIcon />}
                          disabled={Boolean(receiptActionLoading)}
                          onClick={() => openReceiptDialog(location)}
                        >
                          Comprovantes
                        </Button>
                        {requestPending && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={Boolean(requestReviewActionLoading)}
                            onClick={() => {
                              setRequestReviewTarget(location);
                              setRequestReviewNotes('');
                            }}
                          >
                            Revisar solicitação
                          </Button>
                        )}
                      </Box>
                    )}
                    {userCanManageTeam && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
                        {!isAdmin && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReceiptIcon />}
                            disabled={Boolean(receiptActionLoading)}
                            onClick={() => openReceiptDialog(location)}
                          >
                            Enviar comprovante
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={Boolean(teamActionLoading)}
                          onClick={() => openTeamDialog(location)}
                        >
                          Dono e gerentes
                        </Button>
                      </Box>
                    )}
                    {userCanManage && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          display: 'flex',
                          gap: 0.5,
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/location/${location.id}/edit`);
                          }}
                            aria-label={t('locations.editAriaLabel', { name: location.name })}
                          sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {/* Excluir: apenas ADMIN — owners não veem este botão (#1025) */}
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(location);
                            }}
                              aria-label={t('locations.deleteLocationAria', { name: location.name })}
                            sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }}
                          >
                            <DeleteIcon fontSize="small" color="error" />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </Card>
                );
              })}
            </Box>
          )
        )}
      </PageContainer>

      {/* #2178: ScreenFab padronizado — FAB mobile */}
      <ScreenFab
        icon={<AddIcon />}
        aria-label={t('a11y.addLocation')}
        onClick={() => navigate('/location/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          bottom: { xs: 80, md: 24 },
          right: { xs: 16, md: 24 },
        }}
      />

      {/* Confirmação de exclusão */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        aria-labelledby="delete-location-title"
      >
        <DialogTitle id="delete-location-title">{t('locations.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('locations.deleteConfirm', { name: deleteTarget?.name ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!requestReviewTarget}
        onClose={() => !requestReviewActionLoading && setRequestReviewTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Revisar solicitação comercial</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <DialogContentText>
              {requestReviewTarget?.name}
            </DialogContentText>
            <Alert severity="info">
              {getCommercialRequestTypeLabel(requestReviewTarget?.latestCommercialRequestType)} · {getCommercialRequestStatusLabel(requestReviewTarget?.latestCommercialRequestStatus)}
            </Alert>
            {requestReviewTarget?.latestCommercialRequestRequestedSections?.length ? (
              <Typography variant="body2">
                Seções solicitadas: {requestReviewTarget.latestCommercialRequestRequestedSections.join(' · ')}
              </Typography>
            ) : null}
            {requestReviewTarget?.latestCommercialRequestOwnerNotes ? (
              <Typography variant="body2">
                Observação do dono: {requestReviewTarget.latestCommercialRequestOwnerNotes}
              </Typography>
            ) : null}
            {requestReviewTarget?.latestCommercialRequestPendingItemIds?.length ? (
              <Typography variant="body2" color="text.secondary">
                Checklist pendente: {requestReviewTarget.latestCommercialRequestPendingItemIds.join(' · ')}
              </Typography>
            ) : null}
            {requestReviewTarget?.latestCommercialRequestCommercialIssueCodes?.length ? (
              <Typography variant="body2" color="text.secondary">
                Issues comerciais: {requestReviewTarget.latestCommercialRequestCommercialIssueCodes.join(' · ')}
              </Typography>
            ) : null}
            <TextField
              label="Observação do admin"
              value={requestReviewNotes}
              onChange={(event) => setRequestReviewNotes(event.target.value)}
              multiline
              rows={4}
              fullWidth
              inputProps={{ maxLength: 2000 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestReviewTarget(null)} disabled={Boolean(requestReviewActionLoading)}>
            Cancelar
          </Button>
          <Button
            variant="outlined"
            color="warning"
            disabled={Boolean(requestReviewActionLoading)}
            onClick={() => requestReviewTarget && handleReviewCommercialRequest(requestReviewTarget, 'NEEDS_CHANGES')}
          >
            Pedir ajustes
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={Boolean(requestReviewActionLoading)}
            onClick={() => requestReviewTarget && handleReviewCommercialRequest(requestReviewTarget, 'REJECTED')}
          >
            Rejeitar
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={Boolean(requestReviewActionLoading)}
            onClick={() => requestReviewTarget && handleReviewCommercialRequest(requestReviewTarget, 'APPROVED')}
          >
            {requestReviewActionLoading?.includes('APPROVED') ? <CircularProgress size={16} color="inherit" /> : 'Aprovar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!billingTarget} onClose={() => !commercialActionLoading && setBillingTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Mensalidade da quadra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {billingTarget?.name}
            </Typography>
            <TextField
              select
              label="Plano base"
              value={billingPlanCode}
              onChange={(e) => setBillingPlanCode(e.target.value as LocationBillingPlanCode | '')}
              fullWidth
              helperText="Define o plano padrão da quadra antes de negociações."
            >
              <MenuItem value="">Não definido</MenuItem>
              {Object.entries(LOCATION_BILLING_PLAN_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Ciclo"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as LocationBillingCycle | '')}
              fullWidth
              helperText="Usado para deixar claro como a cobrança foi combinada."
            >
              <MenuItem value="">Não definido</MenuItem>
              {Object.entries(LOCATION_BILLING_CYCLE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Nome comercial do plano"
              value={billingPlanLabel}
              onChange={(e) => setBillingPlanLabel(e.target.value)}
              fullWidth
              helperText="Ex.: Fundador 2026, Parceiro Premium, Plano customizado."
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label="Valor base do plano (R$)"
              value={billingBaseFee}
              onChange={(e) => setBillingBaseFee(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
              fullWidth
              inputMode="decimal"
              placeholder="Ex.: 249.90"
              helperText="Preço cheio antes de descontos ou acordos específicos."
            />
            <TextField
              label="Mensalidade do dono da quadra (R$)"
              value={billingMonthlyFee}
              onChange={(e) => setBillingMonthlyFee(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
              fullWidth
              inputMode="decimal"
              placeholder="Ex.: 199.90"
              helperText="Valor efetivamente cobrado nesta quadra."
            />
            <TextField
              label="Dia de vencimento"
              value={billingDueDay}
              onChange={(e) => setBillingDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              fullWidth
              helperText="Use 1 a 28 para evitar meses sem o dia selecionado."
            />
            <TextField
              label="Início da cobrança"
              type="date"
              value={billingStartsAt}
              onChange={(e) => setBillingStartsAt(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="A data de início ajuda no acompanhamento comercial e financeiro."
            />
            <TextField
              label="Exceção comercial"
              value={billingExceptionNote}
              onChange={(e) => setBillingExceptionNote(e.target.value)}
              fullWidth
              multiline
              rows={2}
              helperText="Resumo do acordo diferente do plano base. O dono vê apenas que existe uma condição personalizada."
              inputProps={{ maxLength: 1000 }}
            />
            <TextField
              label="Notas internas"
              value={billingNotes}
              onChange={(e) => setBillingNotes(e.target.value)}
              fullWidth
              multiline
              rows={3}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBillingTarget(null)} disabled={!!commercialActionLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSaveBilling}
            variant="contained"
            disabled={!!commercialActionLoading}
            startIcon={commercialActionLoading?.endsWith(':billing') ? <CircularProgress size={16} /> : null}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!receiptTarget} onClose={() => !receiptActionLoading && setReceiptTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Comprovantes da mensalidade</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {receiptTarget?.name}
            </Typography>
            <Alert severity="info">
              O arquivo fica em Storage privado. Envio de dono/admin cria uma pendência
              e não altera a mensalidade até aprovação administrativa.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Valor pago (R$)"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
                fullWidth
                inputMode="decimal"
                placeholder="Ex.: 199.90"
              />
              <TextField
                label="Período"
                value={receiptPeriodKey}
                onChange={(e) => setReceiptPeriodKey(e.target.value.replace(/[^\d-]/g, '').slice(0, 7))}
                fullWidth
                placeholder="AAAA-MM"
                helperText="Ex.: 2026-07"
              />
            </Stack>
            <TextField
              label="Data do pagamento"
              type="date"
              value={receiptPaidAt}
              onChange={(e) => setReceiptPaidAt(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Usada no histórico financeiro e na reativação da mensalidade."
            />
            <TextField
              label="Método"
              value={receiptMethod}
              onChange={(e) => setReceiptMethod(e.target.value)}
              fullWidth
              placeholder="pix, boleto, cartão..."
              inputProps={{ maxLength: 80 }}
            />
            <TextField
              label={isAdmin ? 'Notas de envio/revisão' : 'Observações'}
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
              inputProps={{ maxLength: 1000 }}
            />
            <Button
              component="label"
              variant="outlined"
              startIcon={<ReceiptIcon />}
              disabled={!!receiptActionLoading}
            >
              {receiptFile ? `Arquivo: ${receiptFile.name}` : 'Selecionar comprovante'}
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => handleReceiptFile(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSubmitReceipt(false)}
              disabled={!!receiptActionLoading || !receiptFile}
              startIcon={receiptActionLoading === 'submit' ? <CircularProgress size={16} /> : null}
            >
              Enviar para revisão
            </Button>
            {isAdmin && (
              <Button
                variant="outlined"
                color="success"
                onClick={() => handleSubmitReceipt(true)}
                disabled={!!receiptActionLoading || !receiptFile}
                startIcon={receiptActionLoading === 'submit-approve' ? <CircularProgress size={16} /> : null}
              >
                Registrar e aprovar agora
              </Button>
            )}
            <Stack spacing={1}>
              <Typography variant="subtitle2">
                {isAdmin ? 'Histórico e pendências' : 'Meus pagamentos e pendências'}
              </Typography>
              {subscriptionPayments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum pagamento ou comprovante encontrado para esta quadra.
                </Typography>
              ) : (
                subscriptionPayments.map((payment) => {
                  const status = getPaymentStatus(payment);
                  const isPending = status === 'PENDING_REVIEW';
                  return (
                    <Card key={payment.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2">
                              {formatMonthlyFee(payment.amountCents)} · {payment.periodKey || 'Período não informado'}
                            </Typography>
                            <Chip
                              label={getPaymentStatusLabel(status)}
                              size="small"
                              color={getPaymentStatusColor(status)}
                              variant={status === 'APPROVED' ? 'filled' : 'outlined'}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {payment.method ? `${payment.method} · ` : ''}
                            {payment.paidAt ? `pago em ${payment.paidAt.toLocaleDateString('pt-BR')} · ` : ''}
                            {payment.receiptStoragePath || 'Sem path privado'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Enviado por {payment.submittedBy || 'desconhecido'}
                            {payment.submittedAt ? ` em ${payment.submittedAt.toLocaleString('pt-BR')}` : ''}
                          </Typography>
                          {isAdmin && isPending && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                disabled={!!receiptActionLoading}
                                onClick={() => handleReviewReceipt(payment, 'APPROVED')}
                                startIcon={receiptActionLoading === `APPROVED:${payment.id}` ? <CircularProgress size={16} /> : null}
                              >
                                Aprovar
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={!!receiptActionLoading}
                                onClick={() => handleReviewReceipt(payment, 'REJECTED')}
                                startIcon={receiptActionLoading === `REJECTED:${payment.id}` ? <CircularProgress size={16} /> : null}
                              >
                                Rejeitar
                              </Button>
                            </Box>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </Stack>
            <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Ledger financeiro auditável</Typography>
                <Typography variant="caption" color="text.secondary">
                  Histórico imutável das mudanças de plano, status, pagamentos e revisões que
                  explicam o estado comercial atual da quadra.
                </Typography>
                {subscriptionLedger.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum evento financeiro registrado ainda.
                  </Typography>
                ) : (
                  subscriptionLedger.map((entry) => (
                    <Card key={entry.id} variant="outlined">
                      <CardContent>
                        <Stack spacing={0.75}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2">
                              {getLedgerTypeLabel(entry.type)}
                            </Typography>
                            {entry.reviewStatus && (
                              <Chip
                                size="small"
                                label={getPaymentStatusLabel(entry.reviewStatus)}
                                color={getPaymentStatusColor(entry.reviewStatus)}
                                variant="outlined"
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {entry.amountCents ? `${formatMonthlyFee(entry.amountCents)} · ` : ''}
                            {entry.periodKey ? `${entry.periodKey} · ` : ''}
                            {entry.method ? `${entry.method} · ` : ''}
                            {entry.effectiveAt ? entry.effectiveAt.toLocaleDateString('pt-BR') : 'sem data efetiva'}
                          </Typography>
                          {(entry.previousSubscriptionStatus ||
                            entry.nextSubscriptionStatus ||
                            entry.billingPlanCode ||
                            entry.billingPlanLabel ||
                            entry.billingCycle ||
                            entry.billingBaseFeeCents ||
                            entry.monthlyFeeCents ||
                            entry.billingDueDay) && (
                            <Typography variant="caption" color="text.secondary">
                              {entry.previousSubscriptionStatus || 'sem status'} → {entry.nextSubscriptionStatus || 'sem status'}
                              {entry.billingPlanLabel || entry.billingPlanCode ? ` · plano ${entry.billingPlanLabel || entry.billingPlanCode}` : ''}
                              {entry.billingCycle ? ` · ciclo ${getBillingCycleLabel(entry.billingCycle)}` : ''}
                              {entry.billingBaseFeeCents ? ` · base ${formatCurrency(entry.billingBaseFeeCents)}` : ''}
                              {entry.monthlyFeeCents ? ` · plano ${formatMonthlyFee(entry.monthlyFeeCents)}` : ''}
                              {entry.billingDueDay ? ` · vence dia ${entry.billingDueDay}` : ''}
                            </Typography>
                          )}
                          {(entry.reason || entry.actorUserId || entry.createdAt) && (
                            <Typography variant="caption" color="text.secondary">
                              {entry.reason ? `${entry.reason} · ` : ''}
                              {entry.actorUserId ? `ator ${entry.actorUserId}` : 'ator não informado'}
                              {entry.createdAt ? ` · ${entry.createdAt.toLocaleString('pt-BR')}` : ''}
                            </Typography>
                          )}
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
          <Button onClick={() => setReceiptTarget(null)} disabled={!!receiptActionLoading}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!teamTarget} onClose={() => !teamActionLoading && setTeamTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Dono e gerentes da quadra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {teamTarget?.name}
            </Typography>
            <Alert severity="info">
              Gerentes só ganham acesso após aceitar convite. Eles não podem publicar, cobrar,
              alterar dono ou mudar mensalidade.
            </Alert>
            {isAdmin && (
              <Stack spacing={1}>
                <TextField
                  label="UID do dono"
                  value={teamOwnerId}
                  onChange={(e) => setTeamOwnerId(e.target.value.trim())}
                  fullWidth
                  helperText="A transferência de dono é exclusiva de administradores."
                />
                <Button
                  variant="outlined"
                  onClick={handleAssignOwner}
                  disabled={!!teamActionLoading || !teamOwnerId.trim()}
                  startIcon={teamActionLoading === 'assign-owner' ? <CircularProgress size={16} /> : null}
                >
                  Transferir dono
                </Button>
              </Stack>
            )}
            <Stack spacing={1}>
              <Typography variant="subtitle2">Convidar gerente</Typography>
              <TextField
                label="UID do gerente"
                value={managerUid}
                onChange={(e) => setManagerUid(e.target.value.trim())}
                fullWidth
                placeholder="Opcional se informar email"
              />
              <TextField
                label="Email do gerente"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                fullWidth
                type="email"
                placeholder="Opcional se informar UID"
              />
              <Button
                variant="contained"
                onClick={handleInviteManager}
                disabled={!!teamActionLoading || (!managerUid.trim() && !managerEmail.trim())}
                startIcon={teamActionLoading === 'invite-manager' ? <CircularProgress size={16} /> : null}
              >
                Criar convite
              </Button>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Gerentes atuais</Typography>
              {teamTarget?.managers.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {teamTarget.managers.map((uid) => (
                    <Chip
                      key={uid}
                      label={uid}
                      onDelete={() => handleRemoveManager(uid)}
                      disabled={!!teamActionLoading}
                      color={teamActionLoading === `remove-manager:${uid}` ? 'warning' : 'default'}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nenhum gerente vinculado.
                </Typography>
              )}
            </Stack>
            <TextField
              label="Motivo interno"
              value={teamReason}
              onChange={(e) => setTeamReason(e.target.value)}
              fullWidth
              multiline
              rows={2}
              inputProps={{ maxLength: 500 }}
              helperText="Usado na auditoria de transferência/remoção."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamTarget(null)} disabled={!!teamActionLoading}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
