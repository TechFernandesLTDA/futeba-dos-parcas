import { PageContainer } from '../../components/common/PageContainer';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Button,
  Chip,
  useTheme,
  useMediaQuery,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
  SearchOff as SearchOffIcon,
  PersonOff as PersonOffIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  reviewVenueOwnerOnboarding,
  searchAdminUsers,
  setUserRole as setUserRoleCallable,
  upsertVenueAccount,
  type AdminVenueAccountSummary,
  type AdminOwnerOnboardingSummary,
  type AdminOwnerLocationSummary,
  type AdminUserCrmRow,
  type AdminUserSearchResponse,
} from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
// #2176: EmptyState canônico (rico, com i18n) vive em common/EmptyState — não no GameCard.
import { EmptyState } from '../../components/common/EmptyState';
import { DemoDataChip } from '../../components/common/DemoDataChip';
import { createLogger } from '../../utils/logger';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('UserManagementScreen');
const ADMIN_USER_PAGE_SIZE = 50;
type OwnerFilter = 'ALL' | 'FIELD_OWNER' | 'HAS_LOCATIONS' | 'PUBLISHED' | 'OVERDUE' | 'INCOMPLETE';
type VenueAccountStatus = AdminVenueAccountSummary['status'];
type VenueAccountBillingScope = AdminVenueAccountSummary['billingScope'];
type VenueAccountPlanCode = NonNullable<AdminVenueAccountSummary['billingPlanCode']>;
type VenueAccountBillingCycle = NonNullable<AdminVenueAccountSummary['billingCycle']>;

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  gamesPlayed: number;
  level: number;
  isMock?: boolean;
  demoData?: boolean;
  dataOrigin?: string | null;
  seedId?: string | null;
  demoDataReason?: string | null;
  cpfVerified?: boolean;
  phoneVerified?: boolean;
  realDataProtected?: boolean;
}

interface OwnerSummary {
  totalLocations: number;
  publishedLocations: number;
  pendingLocations: number;
  overdueLocations: number;
  incompleteLocations: number;
  activeSubscriptionLocations: number;
  monthlyFeeTotalCents: number;
  managersTotal: number;
}

interface OwnerProfile {
  summary: OwnerSummary;
  locations: AdminOwnerLocationSummary[];
  onboarding: AdminOwnerOnboardingSummary | null;
  venueAccount: AdminVenueAccountSummary | null;
}

const parseAdminUser = (data: AdminUserCrmRow): UserWithRole => ({
  id: data.id,
  name: data.name || 'Sem nome',
  email: data.email || '',
  phone: data.phone || undefined,
  photoUrl: data.photoUrl || undefined,
  role: data.role || 'PLAYER',
  createdAt: data.createdAtIso ? new Date(data.createdAtIso) : undefined,
  updatedAt: data.updatedAtIso ? new Date(data.updatedAtIso) : undefined,
  lastLoginAt: data.lastLoginAtIso ? new Date(data.lastLoginAtIso) : undefined,
  gamesPlayed: data.gamesPlayed || 0,
  level: data.level || 1,
  isMock: data.isMock,
  demoData: data.demoData,
  dataOrigin: data.dataOrigin,
  seedId: data.seedId,
  demoDataReason: data.demoDataReason,
  cpfVerified: data.cpfVerified,
  phoneVerified: data.phoneVerified,
  realDataProtected: data.realDataProtected,
});

const formatAdminDateTime = (date?: Date): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return 'Não informada';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const UserManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.userManagement'));
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { user: currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('ALL');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: UserWithRole; role: string } | null>(null);
  const [ownerSummaries, setOwnerSummaries] = useState<Record<string, OwnerSummary>>({});
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, OwnerProfile>>({});
  const [confirmText, setConfirmText] = useState('');
  const [onboardingReviewReason, setOnboardingReviewReason] = useState('');
  const [onboardingReviewLoading, setOnboardingReviewLoading] = useState<string | null>(null);
  const [venueAccountDialogOpen, setVenueAccountDialogOpen] = useState(false);
  const [venueAccountLoading, setVenueAccountLoading] = useState(false);
  const [venueAccountForm, setVenueAccountForm] = useState({
    status: 'TRIAL' as VenueAccountStatus,
    billingScope: 'OWNER' as VenueAccountBillingScope,
    billingPlanCode: '' as VenueAccountPlanCode | '',
    billingPlanLabel: '',
    billingCycle: 'MONTHLY' as VenueAccountBillingCycle | '',
    billingBaseFee: '',
    defaultLocationFee: '',
    pricePerActiveField: '',
    monthlyFeeOverride: '',
    billingDueDay: '',
    billingStartsAt: '',
    billingExpiresAt: '',
    billingContactName: '',
    billingContactEmail: '',
    billingContactPhone: '',
    billingContactDocument: '',
    notes: '',
    adminNotes: '',
    linkedLocationIds: [] as string[],
  });
  const [onboardingChecklist, setOnboardingChecklist] = useState({
    contactReviewed: false,
    locationsReviewed: false,
    termsReviewed: false,
    billingReviewed: false,
  });
  const [searchMeta, setSearchMeta] = useState<{
    totalMatched: number;
    scannedUsers: number;
    scannedLocations: number;
    scanComplete: boolean;
  } | null>(null);
  const hasActiveFilters = Boolean(searchQuery.trim()) || roleFilter !== 'ALL' || ownerFilter !== 'ALL';

  const handleRetry = () => {
    setFetchError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  const applySearchResponse = useCallback((
    data: AdminUserSearchResponse,
    append: boolean,
  ) => {
    const parsedUsers = data.users.map(parseAdminUser);
    const nextSummaries = data.users.reduce<Record<string, OwnerSummary>>((acc, item) => {
      acc[item.id] = item.ownerSummary;
      return acc;
    }, {});
    const nextProfiles = data.users.reduce<Record<string, OwnerProfile>>((acc, item) => {
      acc[item.id] = {
        summary: item.ownerSummary,
        locations: item.ownerLocations || [],
        onboarding: item.ownerOnboarding,
        venueAccount: item.venueAccount,
      };
      return acc;
    }, {});

    setUsers((prev) => (append ? [...prev, ...parsedUsers] : parsedUsers));
    setOwnerSummaries((prev) => (append ? { ...prev, ...nextSummaries } : nextSummaries));
    setOwnerProfiles((prev) => (append ? { ...prev, ...nextProfiles } : nextProfiles));
    setNextPageToken(data.nextPageToken);
    setHasMore(Boolean(data.nextPageToken));
    setSearchMeta({
      totalMatched: data.totalMatched,
      scannedUsers: data.scannedUsers,
      scannedLocations: data.scannedLocations,
      scanComplete: data.scanComplete,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setFetchError(null);
        setSelectedUsers(new Set());
        const response = await searchAdminUsers({
          search: searchQuery.trim() || null,
          role: roleFilter as 'ALL' | 'ADMIN' | 'FIELD_OWNER' | 'PLAYER',
          ownerFilter,
          pageSize: ADMIN_USER_PAGE_SIZE,
          pageToken: null,
        });
        if (cancelled) return;
        applySearchResponse(response.data, false);
      } catch (error) {
        if (!cancelled) {
          logger.error('Error fetching admin users:', error);
          const message = getFunctionsErrorMessage(error, 'searchAdminUsers', 'Erro ao carregar usuários.');
          setFetchError(message);
          showErrorRef.current(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, searchQuery.trim() ? 350 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applySearchResponse, retryCount, searchQuery, roleFilter, ownerFilter]);

  const handleLoadMore = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await searchAdminUsers({
        search: searchQuery.trim() || null,
        role: roleFilter as 'ALL' | 'ADMIN' | 'FIELD_OWNER' | 'PLAYER',
        ownerFilter,
        pageSize: ADMIN_USER_PAGE_SIZE,
        pageToken: nextPageToken,
      });
      applySearchResponse(response.data, true);
    } catch (error) {
      logger.error('Error loading more users:', error);
      const message = getFunctionsErrorMessage(error, 'searchAdminUsers', 'Erro ao carregar mais usuários.');
      setFetchError(message);
      showError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmRoleChange = (user: UserWithRole, newRole: string) => {
    if (user.role === newRole) return;
    setPendingRoleChange({ user, role: newRole });
    setConfirmText('');
    setConfirmDialogOpen(true);
  };

  const executeRoleChange = async (user: UserWithRole, newRole: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await setUserRoleCallable({ uid: user.id, role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      setDialogOpen(false);
      setSelectedUser(null);
      showSuccess(`Role de ${user.name} atualizado para ${newRole}.`);
    } catch (error) {
      setError(getFunctionsErrorMessage(error, 'setUserRole', 'Erro ao atualizar role'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkRoleChange = async (newRole: string) => {
    setBulkLoading(true);
    let successCount = 0;
    let errorCount = 0;
    for (const uid of selectedUsers) {
      if (uid === currentUser?.id) continue;
      const user = users.find((item) => item.id === uid);
      const hasLinkedLocations = (ownerSummaries[uid]?.totalLocations || 0) > 0;
      if (newRole === 'PLAYER' && user?.role === 'FIELD_OWNER' && hasLinkedLocations) {
        errorCount++;
        continue;
      }
      try {
        await setUserRoleCallable({ uid, role: newRole });
        setUsers((prev) =>
          prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u))
        );
        successCount++;
      } catch {
        errorCount++;
      }
    }
    setBulkLoading(false);
    setBulkDialogOpen(false);
    setSelectedUsers(new Set());
    if (successCount > 0) showSuccess(`${successCount} usuário(s) atualizado(s).`);
    if (errorCount > 0) showError(`${errorCount} falha(s) na atualização.`);
  };

  const toggleSelect = (uid: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    const dir = sortDirection === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortField) {
        case 'name': return dir * a.name.localeCompare(b.name);
        case 'email': return dir * a.email.localeCompare(b.email);
        case 'role': return dir * a.role.localeCompare(b.role);
        case 'createdAt': {
          const aTime = a.createdAt?.getTime?.() ?? 0;
          const bTime = b.createdAt?.getTime?.() ?? 0;
          return dir * (bTime - aTime);
        }
        default: return 0;
      }
    });
    return result;
  }, [users, sortField, sortDirection]);

  const handleTableSort = useCallback((field: 'name' | 'email' | 'role' | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const isPendingSelfDemotion =
    pendingRoleChange?.user.id === currentUser?.id && pendingRoleChange?.role !== 'ADMIN';
  const isPendingAdminDemotion =
    pendingRoleChange?.user.role === 'ADMIN' && pendingRoleChange?.role !== 'ADMIN';
  const isPendingAdminPromotion =
    pendingRoleChange?.user.role !== 'ADMIN' && pendingRoleChange?.role === 'ADMIN';
  const pendingOwnerSummary = pendingRoleChange ? ownerSummaries[pendingRoleChange.user.id] : undefined;
  const isPendingFieldOwnerDemotion =
    pendingRoleChange?.user.role === 'FIELD_OWNER' &&
    pendingRoleChange?.role === 'PLAYER' &&
    Boolean((pendingOwnerSummary?.totalLocations || 0) > 0);
  const requiresStrongConfirmation =
    isPendingSelfDemotion ||
    isPendingAdminDemotion ||
    isPendingAdminPromotion ||
    isPendingFieldOwnerDemotion;
  const canConfirmRoleChange = !requiresStrongConfirmation || confirmText.trim().toUpperCase() === 'ALTERAR';
  const selectedOwnerRiskCount = Array.from(selectedUsers).filter((uid) => {
    const user = users.find((item) => item.id === uid);
    return user?.role === 'FIELD_OWNER' && (ownerSummaries[uid]?.totalLocations || 0) > 0;
  }).length;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return theme.palette.error.main;
      case 'FIELD_OWNER': return theme.palette.warning.main;
      default: return theme.palette.grey[500];
    }
  };

  const formatCurrency = (amountCents?: number | null) => {
    if (!amountCents) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amountCents / 100);
  };

  const parseCurrencyCents = (value: string, fieldLabel: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Informe um valor válido para ${fieldLabel}.`);
    }
    return Math.round(parsed * 100);
  };

  const getVenueAccountScopeLabel = (scope?: AdminVenueAccountSummary['billingScope'] | null) => {
    if (scope === 'OWNER') return 'Cobrança por dono';
    if (scope === 'FIELD_COUNT') return 'Cobrança por campo';
    if (scope === 'MANUAL_OVERRIDE') return 'Cobrança manual';
    return 'Cobrança por quadra';
  };

  const getVenueAccountStatusColor = (
    status?: AdminVenueAccountSummary['status'] | null,
  ): 'success' | 'warning' | 'error' | 'default' => {
    if (status === 'ACTIVE' || status === 'TRIAL') return 'success';
    if (status === 'OVERDUE') return 'warning';
    if (status === 'SUSPENDED' || status === 'CANCELLED') return 'error';
    return 'default';
  };

  const getVenueAccountStatusLabel = (
    status?: AdminVenueAccountSummary['status'] | null,
  ) => {
    if (status === 'TRIAL') return 'Teste';
    if (status === 'ACTIVE') return 'Em dia';
    if (status === 'OVERDUE') return 'Em atraso';
    if (status === 'SUSPENDED') return 'Suspensa';
    if (status === 'CANCELLED') return 'Cancelada';
    return 'Sem conta';
  };

  const openLocation = (locationId: string, edit = false) => {
    setDialogOpen(false);
    navigate(edit ? `/location/${locationId}/edit` : `/location/${locationId}`);
  };

  const selectedOwnerProfile = selectedUser ? ownerProfiles[selectedUser.id] : undefined;
  const selectedOnboarding = selectedOwnerProfile?.onboarding;
  const selectedVenueAccount = selectedOwnerProfile?.venueAccount;
  const onboardingCanApprove = Object.values(onboardingChecklist).every(Boolean);
  const onboardingNeedsReview = selectedOnboarding &&
    ['IN_REVIEW', 'REJECTED', 'SUSPENDED'].includes(selectedOnboarding.status);

  const handleOnboardingChecklist = (field: keyof typeof onboardingChecklist) => {
    setOnboardingChecklist((current) => ({ ...current, [field]: !current[field] }));
  };

  const openVenueAccountDialog = () => {
    if (!selectedUser) return;
    const account = selectedOwnerProfile?.venueAccount;
    const locations = selectedOwnerProfile?.locations || [];
    setVenueAccountForm({
      status: account?.status || 'TRIAL',
      billingScope: account?.billingScope || 'OWNER',
      billingPlanCode: account?.billingPlanCode || '',
      billingPlanLabel: account?.billingPlanLabel || '',
      billingCycle: account?.billingCycle || 'MONTHLY',
      billingBaseFee: '',
      defaultLocationFee: '',
      pricePerActiveField: '',
      monthlyFeeOverride: account?.computedMonthlyFeeCents ? String((account.computedMonthlyFeeCents / 100).toFixed(2)) : '',
      billingDueDay: account?.billingDueDay ? String(account.billingDueDay) : '',
      billingStartsAt: '',
      billingExpiresAt: '',
      billingContactName: account?.billingContactName || selectedOnboarding?.contactName || selectedUser.name,
      billingContactEmail: account?.billingContactEmail || selectedOnboarding?.contactEmail || selectedUser.email,
      billingContactPhone: selectedOnboarding?.phone || '',
      billingContactDocument: '',
      notes: '',
      adminNotes: '',
      linkedLocationIds: account?.linkedLocationIds?.length
        ? account.linkedLocationIds
        : locations.map((location) => location.id),
    });
    setVenueAccountDialogOpen(true);
  };

  const handleToggleVenueAccountLocation = (locationId: string) => {
    setVenueAccountForm((current) => ({
      ...current,
      linkedLocationIds: current.linkedLocationIds.includes(locationId)
        ? current.linkedLocationIds.filter((id) => id !== locationId)
        : [...current.linkedLocationIds, locationId],
    }));
  };

  const handleSaveVenueAccount = async () => {
    if (!selectedUser) return;
    const billingDueDay = venueAccountForm.billingDueDay.trim()
      ? Number(venueAccountForm.billingDueDay)
      : null;
    if (billingDueDay !== null && (!Number.isInteger(billingDueDay) || billingDueDay < 1 || billingDueDay > 31)) {
      showError('Dia de vencimento deve ficar entre 1 e 31.');
      return;
    }
    if (venueAccountForm.billingStartsAt && venueAccountForm.billingExpiresAt) {
      const startsAt = new Date(`${venueAccountForm.billingStartsAt}T00:00:00.000Z`);
      const expiresAt = new Date(`${venueAccountForm.billingExpiresAt}T00:00:00.000Z`);
      if (startsAt > expiresAt) {
        showError('A data de início deve ser anterior ao fim do contrato.');
        return;
      }
    }

    setVenueAccountLoading(true);
    try {
      const billingBaseFeeCents = parseCurrencyCents(venueAccountForm.billingBaseFee, 'valor base');
      const defaultLocationFeeCents = parseCurrencyCents(venueAccountForm.defaultLocationFee, 'valor por quadra');
      const pricePerActiveFieldCents = parseCurrencyCents(venueAccountForm.pricePerActiveField, 'valor por campo ativo');
      const monthlyFeeOverrideCents = parseCurrencyCents(venueAccountForm.monthlyFeeOverride, 'mensalidade final');
      await upsertVenueAccount({
        ownerUid: selectedUser.id,
        status: venueAccountForm.status,
        billingScope: venueAccountForm.billingScope,
        billingPlanCode: venueAccountForm.billingPlanCode || null,
        billingPlanLabel: venueAccountForm.billingPlanLabel.trim() || null,
        billingCycle: venueAccountForm.billingCycle || null,
        billingBaseFeeCents,
        defaultLocationFeeCents,
        pricePerActiveFieldCents,
        monthlyFeeOverrideCents,
        billingDueDay,
        billingStartsAtIso: venueAccountForm.billingStartsAt ? `${venueAccountForm.billingStartsAt}T00:00:00.000Z` : null,
        billingExpiresAtIso: venueAccountForm.billingExpiresAt ? `${venueAccountForm.billingExpiresAt}T00:00:00.000Z` : null,
        billingContactName: venueAccountForm.billingContactName.trim() || null,
        billingContactEmail: venueAccountForm.billingContactEmail.trim() || null,
        billingContactPhone: venueAccountForm.billingContactPhone.trim() || null,
        billingContactDocument: venueAccountForm.billingContactDocument.trim() || null,
        notes: venueAccountForm.notes.trim() || null,
        adminNotes: venueAccountForm.adminNotes.trim() || null,
        linkedLocationIds: venueAccountForm.linkedLocationIds,
      });
      showSuccess('Conta comercial atualizada.');
      setVenueAccountDialogOpen(false);
      setRetryCount((count) => count + 1);
    } catch (error) {
      logger.error('Erro ao salvar conta comercial:', error);
      showError(error instanceof Error ? error.message : getFunctionsErrorMessage(error, 'upsertVenueAccount', 'Não foi possível salvar a conta comercial.'));
    } finally {
      setVenueAccountLoading(false);
    }
  };

  const handleReviewOnboarding = async (decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CANCELLED') => {
    if (!selectedUser || !selectedOnboarding) return;
    if (decision === 'APPROVED' && !onboardingCanApprove) {
      showError('Revise todo o checklist antes de aprovar.');
      return;
    }
    if (decision !== 'APPROVED' && !onboardingReviewReason.trim()) {
      showError('Informe o motivo da decisão.');
      return;
    }
    setOnboardingReviewLoading(decision);
    try {
      const response = await reviewVenueOwnerOnboarding({
        ownerUid: selectedUser.id,
        decision,
        reason: onboardingReviewReason.trim() || null,
        checklist: decision === 'APPROVED' ? onboardingChecklist : null,
      });
      const nextStatus = response.data.status;
      setOwnerProfiles((current) => ({
        ...current,
        [selectedUser.id]: {
          ...(current[selectedUser.id] || { summary: ownerSummaries[selectedUser.id], locations: [] }),
          onboarding: {
            ...selectedOnboarding,
            status: nextStatus,
            reviewReason: onboardingReviewReason.trim() || null,
            reviewedAtIso: new Date().toISOString(),
          },
        },
      }));
      if (decision === 'APPROVED') {
        setUsers((current) => current.map((user) => (
          user.id === selectedUser.id ? { ...user, role: 'FIELD_OWNER' } : user
        )));
        setSelectedUser((current) => current ? { ...current, role: 'FIELD_OWNER' } : current);
      }
      setOnboardingReviewReason('');
      setOnboardingChecklist({
        contactReviewed: false,
        locationsReviewed: false,
        termsReviewed: false,
        billingReviewed: false,
      });
      showSuccess(`Onboarding ${nextStatus.toLowerCase()} para ${selectedUser.name}.`);
    } catch (error) {
      logger.error('Error reviewing owner onboarding:', error);
      showError(getFunctionsErrorMessage(error, 'reviewVenueOwnerOnboarding', 'Não foi possível revisar o onboarding.'));
    } finally {
      setOnboardingReviewLoading(null);
    }
  };

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
          <IconButton onClick={goBack} aria-label={t('a11y.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Gerenciar Usuários
          </Typography>
          {selectedUsers.size > 0 && (
            <Button
              startIcon={<EditIcon />}
              onClick={() => setBulkDialogOpen(true)}
              sx={{ ml: 'auto' }}
              variant="outlined"
              size="small"
            >
              Alterar ({selectedUsers.size})
            </Button>
          )}
        </Box>
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 180px 220px' },
            gap: 1,
            '& .MuiInputBase-root': {
              minHeight: { xs: 44, sm: 'auto' },
            },
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder={t('placeholder.searchUser')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('a11y.searchUser')}
            inputProps={{ maxLength: 200 }}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
          <TextField
            select
            size="small"
            label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value="ALL">Todos os roles</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
            <MenuItem value="FIELD_OWNER">Field Owner</MenuItem>
            <MenuItem value="PLAYER">Player</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Comercial"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}
          >
            <MenuItem value="ALL">Todos</MenuItem>
            <MenuItem value="FIELD_OWNER">Donos de quadra</MenuItem>
            <MenuItem value="HAS_LOCATIONS">Com quadras</MenuItem>
            <MenuItem value="PUBLISHED">Com publicada</MenuItem>
            <MenuItem value="OVERDUE">Com pendência</MenuItem>
            <MenuItem value="INCOMPLETE">Cadastro incompleto</MenuItem>
          </TextField>
        </Box>
      </Box>

      <PageContainer maxWidth="list">
        {fetchError ? (
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Tentar novamente
            </Button>
          }>
            {fetchError}
          </Alert>
        ) : loading ? (
          <LoadingState shimmerCount={8} itemType="LIST" />
        ) : filteredUsers.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={<SearchOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />}
              title={t('empty.noUserFound')}
              description={t('empty.noUserFoundDesc', { query: searchQuery || 'filtros selecionados' })}
              actionLabel="Limpar filtros"
              onAction={() => {
                setSearchQuery('');
                setRoleFilter('ALL');
                setOwnerFilter('ALL');
              }}
            />
          ) : (
            <EmptyState
              icon={<PersonOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />}
              title={t('empty.noUserRegistered')}
              description={t('admin.noUserRegisteredDesc')}
            />
          )
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {filteredUsers.length} de {searchMeta?.totalMatched ?? filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''} exibido{filteredUsers.length !== 1 ? 's' : ''}
              {' · busca server-side em '}
              {searchMeta?.scannedUsers ?? filteredUsers.length} usuário{(searchMeta?.scannedUsers ?? filteredUsers.length) !== 1 ? 's' : ''}
              {' e '}
              {searchMeta?.scannedLocations ?? 0} quadra{(searchMeta?.scannedLocations ?? 0) !== 1 ? 's' : ''}
              {searchMeta?.scanComplete === false ? ' · limite de varredura atingido' : ''}
              {hasMore ? ' · mais disponíveis' : ''}
            </Typography>
            {isMdUp ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.size > 0 && selectedUsers.size === filteredUsers.filter(u => u.id !== currentUser?.id).length}
                          indeterminate={selectedUsers.size > 0 && selectedUsers.size < filteredUsers.filter(u => u.id !== currentUser?.id).length}
                          sx={{ p: 1.25 }}
                          onChange={() => {
                            const eligible = filteredUsers.filter(u => u.id !== currentUser?.id);
                            if (selectedUsers.size === eligible.length) {
                              setSelectedUsers(new Set());
                            } else {
                              setSelectedUsers(new Set(eligible.map(u => u.id)));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDirection : 'desc'} onClick={() => handleTableSort('name')}>
                          Nome
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'email'} direction={sortField === 'email' ? sortDirection : 'desc'} onClick={() => handleTableSort('email')}>
                          Email
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'role'} direction={sortField === 'role' ? sortDirection : 'desc'} onClick={() => handleTableSort('role')}>
                          Role
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'createdAt'} direction={sortField === 'createdAt' ? sortDirection : 'desc'} onClick={() => handleTableSort('createdAt')}>
                          Criado em
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const venueAccount = ownerProfiles[u.id]?.venueAccount;

                      return (
                        <TableRow key={u.id} hover selected={selectedUsers.has(u.id)}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedUsers.has(u.id)}
                              onChange={() => toggleSelect(u.id)}
                              disabled={u.id === currentUser?.id}
                              sx={{ p: 1.25 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PlayerAvatar name={u.name} photoUrl={u.photoUrl} size={32} level={u.level} />
                              <Typography variant="body2" fontWeight={600}>
                                {u.name}
                                {u.id === currentUser?.id && <Chip label="Você" size="small" color="primary" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }} />}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.role}
                              size="small"
                              sx={{
                                bgcolor: alpha(getRoleColor(u.role), 0.1),
                                color: getRoleColor(u.role),
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip label="Ativo" size="small" color="success" variant="outlined" />
                            {(u.role === 'FIELD_OWNER' || (ownerSummaries[u.id]?.totalLocations || 0) > 0) && (
                              <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5, ml: 0.5 }}>
                                <Chip
                                  label={`${ownerSummaries[u.id]?.totalLocations || 0} quadra(s)`}
                                  size="small"
                                  variant="outlined"
                                  color={(ownerSummaries[u.id]?.overdueLocations || 0) > 0 ? 'warning' : 'default'}
                                />
                                {(ownerSummaries[u.id]?.monthlyFeeTotalCents || 0) > 0 && (
                                  <Chip
                                    label={formatCurrency(ownerSummaries[u.id]?.monthlyFeeTotalCents)}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                )}
                                {venueAccount && (
                                  <>
                                    <Chip
                                      label={getVenueAccountStatusLabel(venueAccount.status)}
                                      size="small"
                                      color={getVenueAccountStatusColor(venueAccount.status)}
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={getVenueAccountScopeLabel(venueAccount.billingScope)}
                                      size="small"
                                      variant="outlined"
                                    />
                                    {venueAccount.billingPlanLabel && (
                                      <Chip
                                        label={`Plano ${venueAccount.billingPlanLabel}`}
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </>
                                )}
                                {(ownerSummaries[u.id]?.incompleteLocations || 0) > 0 && (
                                  <Chip label="cadastro incompleto" size="small" color="info" variant="outlined" />
                                )}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {u.createdAt ? u.createdAt.toLocaleDateString() : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => { setSelectedUser(u); setDialogOpen(true); setError(null); }} aria-label={t('a11y.managePermissions')}>
                              <AdminIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Card>
                <List disablePadding aria-label={t('a11y.userList')}>
                  {filteredUsers.map((u, index) => {
                    const venueAccount = ownerProfiles[u.id]?.venueAccount;

                    return (
                      <Box key={u.id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          secondaryAction={
                            <IconButton edge="end" aria-label={t('a11y.managePermissions')} onClick={() => { setSelectedUser(u); setDialogOpen(true); setError(null); }}>
                              <AdminIcon />
                            </IconButton>
                          }
                        >
                          <Checkbox
                            checked={selectedUsers.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            disabled={u.id === currentUser?.id}
                            sx={{ p: 1.25, mr: 1 }}
                          />
                          <ListItemButton
                            onClick={() => { setSelectedUser(u); setDialogOpen(true); setError(null); }}
                          >
                            <PlayerAvatar name={u.name} photoUrl={u.photoUrl} size={48} level={u.level} />
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {u.name}
                                  {u.id === currentUser?.id && <Chip label="Você" size="small" color="primary" variant="outlined" />}
                                  <DemoDataChip data={u} />
                                  {u.realDataProtected && (
                                    <Chip label="Real validado" size="small" color="success" variant="outlined" />
                                  )}
                                  <Chip
                                    label={u.role}
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(getRoleColor(u.role), 0.1),
                                      color: getRoleColor(u.role),
                                    }}
                                  />
                                </Box>
                              }
                              secondary={`${u.email} • ${u.gamesPlayed} jogos`}
                              sx={{ ml: 1 }}
                            />
                          </ListItemButton>
                        </ListItem>
                        {(u.role === 'FIELD_OWNER' || (ownerSummaries[u.id]?.totalLocations || 0) > 0) && (
                          <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            <Chip label={`${ownerSummaries[u.id]?.totalLocations || 0} quadra(s)`} size="small" variant="outlined" />
                            <Chip label={`${ownerSummaries[u.id]?.publishedLocations || 0} publicada(s)`} size="small" color="success" variant="outlined" />
                            {(ownerSummaries[u.id]?.monthlyFeeTotalCents || 0) > 0 && (
                              <Chip label={formatCurrency(ownerSummaries[u.id]?.monthlyFeeTotalCents)} size="small" color="success" variant="outlined" />
                            )}
                            {venueAccount && (
                              <>
                                <Chip
                                  label={getVenueAccountStatusLabel(venueAccount.status)}
                                  size="small"
                                  color={getVenueAccountStatusColor(venueAccount.status)}
                                  variant="outlined"
                                />
                                <Chip
                                  label={getVenueAccountScopeLabel(venueAccount.billingScope)}
                                  size="small"
                                  variant="outlined"
                                />
                              </>
                            )}
                            {(ownerSummaries[u.id]?.pendingLocations || 0) > 0 && (
                              <Chip label={`${ownerSummaries[u.id]?.pendingLocations} em revisão`} size="small" color="info" variant="outlined" />
                            )}
                            {(ownerSummaries[u.id]?.overdueLocations || 0) > 0 && (
                              <Chip label={`${ownerSummaries[u.id]?.overdueLocations} com pendência`} size="small" color="warning" />
                            )}
                            {(ownerSummaries[u.id]?.incompleteLocations || 0) > 0 && (
                              <Chip label={`${ownerSummaries[u.id]?.incompleteLocations} incompleta(s)`} size="small" color="info" />
                            )}
                          </Box>
                          )}
                      </Box>
                    );
                  })}
                </List>
              </Card>
            )}
            {hasMore && (
              <Button
                fullWidth
                variant="outlined"
                onClick={handleLoadMore}
                disabled={loadingMore}
                sx={{ mt: 2 }}
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </Button>
            )}
          </>
        )}
      </PageContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="md" aria-labelledby="manage-user-dialog-title">
        <DialogTitle id="manage-user-dialog-title">Ficha comercial do usuário</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <PlayerAvatar name={selectedUser.name} photoUrl={selectedUser.photoUrl} size={56} level={selectedUser.level} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" gutterBottom>
                    {selectedUser.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {selectedUser.email || 'Email não cadastrado'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {selectedUser.phone || 'Telefone não cadastrado'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    UID: {selectedUser.id}
                  </Typography>
                </Box>
                <Chip
                  label={selectedUser.role}
                  size="small"
                  sx={{
                    ml: 'auto',
                    bgcolor: alpha(getRoleColor(selectedUser.role), 0.1),
                    color: getRoleColor(selectedUser.role),
                    fontWeight: 700,
                  }}
                />
              </Box>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>Contato e atividade</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Email</Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{selectedUser.email || 'Não cadastrado'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Telefone</Typography>
                      <Typography variant="body2">{selectedUser.phone || 'Não cadastrado'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Última atualização</Typography>
                      <Typography variant="body2">{formatAdminDateTime(selectedUser.updatedAt)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Último login</Typography>
                      <Typography variant="body2">{formatAdminDateTime(selectedUser.lastLoginAt)}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2">Onboarding comercial</Typography>
                    <Chip
                      label={selectedOnboarding?.status || 'Sem solicitação'}
                      size="small"
                      color={selectedOnboarding?.status === 'APPROVED' ? 'success' : selectedOnboarding?.status === 'IN_REVIEW' ? 'info' : 'default'}
                      variant={selectedOnboarding ? 'filled' : 'outlined'}
                    />
                  </Box>
                  {selectedOnboarding ? (
                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                      <Typography variant="body2" color="text.secondary">
                        Responsável: {selectedOnboarding.contactName || selectedUser.name} · {selectedOnboarding.contactEmail || selectedUser.email || 'email não informado'} · {selectedOnboarding.phone || selectedUser.phone || 'telefone não informado'}
                      </Typography>
                      {selectedOnboarding.businessName && (
                        <Typography variant="body2" color="text.secondary">
                          Empresa/quadra: {selectedOnboarding.businessName}
                        </Typography>
                      )}
                      {selectedOnboarding.notes && (
                        <Alert severity="info">{selectedOnboarding.notes}</Alert>
                      )}
                      {selectedOnboarding.reviewReason && (
                        <Alert severity="warning">Motivo anterior: {selectedOnboarding.reviewReason}</Alert>
                      )}
                      {onboardingNeedsReview && (
                        <Box sx={{ display: 'grid', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Para aprovar, confirme que contato, quadras, termos e cobrança foram revisados.
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.contactReviewed} onChange={() => handleOnboardingChecklist('contactReviewed')} sx={{ p: 1.25 }} />}
                              label="Contato revisado"
                              sx={{ minHeight: 44 }}
                            />
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.locationsReviewed} onChange={() => handleOnboardingChecklist('locationsReviewed')} sx={{ p: 1.25 }} />}
                              label="Quadras revisadas"
                              sx={{ minHeight: 44 }}
                            />
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.termsReviewed} onChange={() => handleOnboardingChecklist('termsReviewed')} sx={{ p: 1.25 }} />}
                              label="Termos revisados"
                              sx={{ minHeight: 44 }}
                            />
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.billingReviewed} onChange={() => handleOnboardingChecklist('billingReviewed')} sx={{ p: 1.25 }} />}
                              label="Cobrança revisada"
                              sx={{ minHeight: 44 }}
                            />
                          </Box>
                          <TextField
                            label="Motivo/observação da revisão"
                            value={onboardingReviewReason}
                            onChange={(event) => setOnboardingReviewReason(event.target.value)}
                            size="small"
                            multiline
                            minRows={2}
                            inputProps={{ maxLength: 800 }}
                          />
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              disabled={!!onboardingReviewLoading || !onboardingCanApprove}
                              startIcon={onboardingReviewLoading === 'APPROVED' ? <CircularProgress size={16} /> : null}
                              onClick={() => handleReviewOnboarding('APPROVED')}
                            >
                              Aprovar e promover
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              disabled={!!onboardingReviewLoading}
                              onClick={() => handleReviewOnboarding('REJECTED')}
                            >
                              Rejeitar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={!!onboardingReviewLoading}
                              onClick={() => handleReviewOnboarding('SUSPENDED')}
                            >
                              Suspender
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Este usuário ainda não abriu solicitação comercial pelo app.
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2">Conta comercial</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={openVenueAccountDialog}
                      disabled={!selectedUser}
                    >
                      {selectedVenueAccount ? 'Editar conta' : 'Criar conta'}
                    </Button>
                    <Chip
                      label={getVenueAccountStatusLabel(selectedVenueAccount?.status)}
                      size="small"
                      color={getVenueAccountStatusColor(selectedVenueAccount?.status)}
                      variant={selectedVenueAccount ? 'filled' : 'outlined'}
                    />
                    {selectedVenueAccount && (
                      <>
                        <Chip
                          label={getVenueAccountScopeLabel(selectedVenueAccount.billingScope)}
                          size="small"
                          variant="outlined"
                        />
                        {selectedVenueAccount.billingPlanLabel && (
                          <Chip
                            label={`Plano ${selectedVenueAccount.billingPlanLabel}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </>
                    )}
                  </Box>
                  {selectedVenueAccount ? (
                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Mensalidade calculada</Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {formatCurrency(selectedVenueAccount.computedMonthlyFeeCents)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Legado por quadra: {formatCurrency(selectedVenueAccount.legacyMonthlyFeeTotalCents)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Escopo e vencimento</Typography>
                          <Typography variant="body2">
                            {getVenueAccountScopeLabel(selectedVenueAccount.billingScope)}
                            {selectedVenueAccount.billingCycle ? ` · ${selectedVenueAccount.billingCycle.toLowerCase()}` : ''}
                            {selectedVenueAccount.billingDueDay ? ` · dia ${selectedVenueAccount.billingDueDay}` : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedVenueAccount.linkedLocationsCount} quadra(s) · {selectedVenueAccount.activeFieldCount} campo(s) ativo(s)
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Contato financeiro</Typography>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {selectedVenueAccount.billingContactName || selectedOnboarding?.contactName || selectedUser.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', display: 'block' }}>
                            {selectedVenueAccount.billingContactEmail || selectedOnboarding?.contactEmail || selectedUser.email || 'Email não informado'}
                          </Typography>
                        </Box>
                      </Box>
                      <Alert severity={selectedVenueAccount.status === 'OVERDUE' || selectedVenueAccount.status === 'SUSPENDED' ? 'warning' : 'info'}>
                        Conta {getVenueAccountStatusLabel(selectedVenueAccount.status).toLowerCase()} com
                        {' '}{selectedVenueAccount.publishedLocationsCount} quadra(s) publicada(s) vinculada(s).
                      </Alert>
                    </Box>
                  ) : (
                    <Alert severity="info">
                      Este usuário ainda não tem uma conta comercial agregada em `venue_accounts`. As quadras seguem no modelo legado por quadra até a migração.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">Receita mensal</Typography>
                    <Typography variant="h6">{formatCurrency(selectedOwnerProfile?.summary.monthlyFeeTotalCents)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedOwnerProfile?.summary.activeSubscriptionLocations || 0} assinatura(s) ativa(s)
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">Quadras</Typography>
                    <Typography variant="h6">{selectedOwnerProfile?.summary.totalLocations || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedOwnerProfile?.summary.publishedLocations || 0} publicadas · {selectedOwnerProfile?.summary.pendingLocations || 0} em revisão
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">Riscos</Typography>
                    <Typography variant="h6">{(selectedOwnerProfile?.summary.overdueLocations || 0) + (selectedOwnerProfile?.summary.incompleteLocations || 0)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedOwnerProfile?.summary.overdueLocations || 0} pendências · {selectedOwnerProfile?.summary.incompleteLocations || 0} incompletas
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {(selectedOwnerProfile?.summary.totalLocations || 0) > 0 ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BusinessIcon fontSize="small" />
                    Quadras vinculadas e ações comerciais
                  </Typography>
                  <List dense disablePadding>
                    {selectedOwnerProfile?.locations.map((location) => (
                      <ListItem
                        key={location.id}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 2,
                          mb: 1,
                        }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<OpenInNewIcon fontSize="small" />}
                              onClick={() => openLocation(location.id)}
                            >
                              Ver
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => openLocation(location.id, true)}
                            >
                              Editar
                            </Button>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                              <Typography variant="body2" fontWeight={700}>{location.name}</Typography>
                              <Chip label={location.publicationStatus} size="small" variant="outlined" />
                              <Chip
                                label={location.subscriptionStatus}
                                size="small"
                                color={['OVERDUE', 'SUSPENDED', 'CANCELLED'].includes(location.subscriptionStatus) ? 'warning' : 'success'}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={[
                            location.city || location.state ? `${location.city || 'Cidade não informada'}${location.state ? `/${location.state}` : ''}` : 'Endereço comercial incompleto',
                            `${location.fieldCount} campo(s)`,
                            `${location.managersCount} gerente(s)`,
                            location.monthlyFeeCents ? `${formatCurrency(location.monthlyFeeCents)}${location.billingDueDay ? ` · vence dia ${location.billingDueDay}` : ''}` : 'Mensalidade não definida',
                          ].join(' · ')}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Este usuário ainda não tem quadras vinculadas. Promover para Field Owner apenas prepara o acesso comercial.
                </Alert>
              )}

              <Alert severity={(selectedOwnerProfile?.summary.overdueLocations || 0) > 0 ? 'warning' : 'info'} sx={{ mb: 2 }}>
                Alterações de role usam a operação auditada de permissões. Rebaixar dono de quadra com cadastros vinculados exige confirmação reforçada.
              </Alert>
            </Box>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={() => selectedUser && confirmRoleChange(selectedUser, 'PLAYER')}
            disabled={actionLoading || selectedUser?.role === 'PLAYER'}
          >
            Player
          </Button>
          <Button
            onClick={() => selectedUser && confirmRoleChange(selectedUser, 'FIELD_OWNER')}
            disabled={actionLoading || selectedUser?.role === 'FIELD_OWNER'}
            color="warning"
          >
            Field Owner
          </Button>
          <Button
            onClick={() => selectedUser && confirmRoleChange(selectedUser, 'ADMIN')}
            disabled={actionLoading || selectedUser?.role === 'ADMIN'}
            color="error"
          >
            Admin
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirmar alteração de role</DialogTitle>
        <DialogContent>
          {isPendingSelfDemotion ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Você está prestes a remover seu próprio acesso de administrador. Esta ação requer outro admin para reverter.
            </Alert>
          ) : isPendingAdminPromotion ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Admins têm acesso total ao sistema. Confirme apenas se este usuário deve administrar a plataforma.
            </Alert>
          ) : isPendingFieldOwnerDemotion ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Este dono possui {pendingOwnerSummary?.totalLocations || 0} quadra(s) vinculada(s),
              {' '}{pendingOwnerSummary?.publishedLocations || 0} publicada(s) e
              {' '}{formatCurrency(pendingOwnerSummary?.monthlyFeeTotalCents)} de mensalidade agregada.
              Rebaixar para Player não transfere nem suspende as quadras automaticamente.
            </Alert>
          ) : null}
          <Typography sx={{ mb: 2 }}>
            Alterar role de <strong>{pendingRoleChange?.user.name}</strong> de{' '}
            <strong>{pendingRoleChange?.user.role}</strong> para <strong>{pendingRoleChange?.role}</strong>?
          </Typography>
          {requiresStrongConfirmation && (
            <TextField
              fullWidth
              size="small"
              label="Digite ALTERAR para confirmar"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 20 }}
            />
          )}
          <Alert severity="info">
            O usuário precisará fazer login novamente após a alteração.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            color={isPendingAdminDemotion ? 'error' : 'primary'}
            variant="contained"
            disabled={actionLoading || !canConfirmRoleChange}
            onClick={() => {
              const roleChange = pendingRoleChange;
              if (roleChange) {
                executeRoleChange(roleChange.user, roleChange.role);
              }
              setConfirmDialogOpen(false);
              setPendingRoleChange(null);
              setConfirmText('');
            }}
          >
            {actionLoading ? <CircularProgress size={20} /> : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={venueAccountDialogOpen}
        onClose={() => !venueAccountLoading && setVenueAccountDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Conta comercial agregada</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Configure a mensalidade do dono de quadra como contrato único. As alterações usam callable auditada e geram evento comercial.
          </Alert>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mt: 1 }}>
            <TextField
              select
              label="Status"
              value={venueAccountForm.status}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, status: event.target.value as VenueAccountStatus }))}
              fullWidth
            >
              <MenuItem value="TRIAL">Teste</MenuItem>
              <MenuItem value="ACTIVE">Ativa</MenuItem>
              <MenuItem value="OVERDUE">Em atraso</MenuItem>
              <MenuItem value="SUSPENDED">Suspensa</MenuItem>
              <MenuItem value="CANCELLED">Cancelada</MenuItem>
            </TextField>
            <TextField
              select
              label="Modelo de cobrança"
              value={venueAccountForm.billingScope}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingScope: event.target.value as VenueAccountBillingScope }))}
              fullWidth
              helperText="Define como a mensalidade total será calculada."
            >
              <MenuItem value="OWNER">Valor único por dono</MenuItem>
              <MenuItem value="LOCATION">Valor por quadra</MenuItem>
              <MenuItem value="FIELD_COUNT">Valor por campo ativo</MenuItem>
              <MenuItem value="MANUAL_OVERRIDE">Valor manual fechado</MenuItem>
            </TextField>
            <TextField
              select
              label="Plano base"
              value={venueAccountForm.billingPlanCode}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingPlanCode: event.target.value as VenueAccountPlanCode | '' }))}
              fullWidth
            >
              <MenuItem value="">Sem plano definido</MenuItem>
              <MenuItem value="TRIAL">Trial</MenuItem>
              <MenuItem value="BASIC">Basic</MenuItem>
              <MenuItem value="PRO">Pro</MenuItem>
              <MenuItem value="ENTERPRISE">Enterprise</MenuItem>
              <MenuItem value="CUSTOM">Custom</MenuItem>
            </TextField>
            <TextField
              label="Nome comercial do plano"
              value={venueAccountForm.billingPlanLabel}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingPlanLabel: event.target.value }))}
              fullWidth
              helperText="Ex.: Fundador 2026, Parceiro Premium, Customizado."
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              select
              label="Ciclo"
              value={venueAccountForm.billingCycle}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingCycle: event.target.value as VenueAccountBillingCycle | '' }))}
              fullWidth
            >
              <MenuItem value="">Sem ciclo definido</MenuItem>
              <MenuItem value="MONTHLY">Mensal</MenuItem>
              <MenuItem value="QUARTERLY">Trimestral</MenuItem>
              <MenuItem value="SEMIANNUAL">Semestral</MenuItem>
              <MenuItem value="ANNUAL">Anual</MenuItem>
              <MenuItem value="CUSTOM">Customizado</MenuItem>
            </TextField>
            <TextField
              label="Dia de vencimento"
              value={venueAccountForm.billingDueDay}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingDueDay: event.target.value.replace(/\D/g, '').slice(0, 2) }))}
              fullWidth
              helperText="Use 1 a 31. Pode ficar vazio durante onboarding."
            />
            <TextField
              label="Valor base do plano (R$)"
              value={venueAccountForm.billingBaseFee}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingBaseFee: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText="Preço cheio antes de acordos."
            />
            <TextField
              label="Mensalidade final manual (R$)"
              value={venueAccountForm.monthlyFeeOverride}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, monthlyFeeOverride: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText="Usado em cobrança por dono ou override manual."
            />
            <TextField
              label="Valor por quadra (R$)"
              value={venueAccountForm.defaultLocationFee}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, defaultLocationFee: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText="Usado quando o modelo for por quadra."
            />
            <TextField
              label="Valor por campo ativo (R$)"
              value={venueAccountForm.pricePerActiveField}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, pricePerActiveField: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText="Usado quando o modelo for por campo ativo."
            />
            <TextField
              label="Início da cobrança"
              type="date"
              value={venueAccountForm.billingStartsAt}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingStartsAt: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fim/renovação do contrato"
              type="date"
              value={venueAccountForm.billingExpiresAt}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingExpiresAt: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Contato financeiro"
              value={venueAccountForm.billingContactName}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email financeiro"
              value={venueAccountForm.billingContactEmail}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactEmail: event.target.value }))}
              fullWidth
              inputProps={{ maxLength: 254 }}
            />
            <TextField
              label="Telefone financeiro"
              value={venueAccountForm.billingContactPhone}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactPhone: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Documento comercial"
              value={venueAccountForm.billingContactDocument}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactDocument: event.target.value }))}
              fullWidth
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Quadras vinculadas à conta</Typography>
            {(selectedOwnerProfile?.locations || []).length > 0 ? (
              <Box sx={{ display: 'grid', gap: 1 }}>
                {selectedOwnerProfile?.locations.map((location) => (
                  <FormControlLabel
                    key={location.id}
                    control={
                      <Checkbox
                        checked={venueAccountForm.linkedLocationIds.includes(location.id)}
                        onChange={() => handleToggleVenueAccountLocation(location.id)}
                        sx={{ p: 1.25 }}
                      />
                    }
                    label={`${location.name} · ${location.city || 'Cidade não informada'} · ${location.fieldCount} campo(s)`}
                    sx={{ minHeight: 44 }}
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="warning">Este usuário ainda não possui quadras para vincular.</Alert>
            )}
          </Box>
          <TextField
            label="Observação visível/contratual"
            value={venueAccountForm.notes}
            onChange={(event) => setVenueAccountForm((current) => ({ ...current, notes: event.target.value }))}
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 2 }}
            inputProps={{ maxLength: 1000 }}
          />
          <TextField
            label="Notas internas"
            value={venueAccountForm.adminNotes}
            onChange={(event) => setVenueAccountForm((current) => ({ ...current, adminNotes: event.target.value }))}
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 2 }}
            inputProps={{ maxLength: 1000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVenueAccountDialogOpen(false)} disabled={venueAccountLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSaveVenueAccount} disabled={venueAccountLoading || !selectedUser}>
            {venueAccountLoading ? <CircularProgress size={20} /> : 'Salvar conta comercial'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDialogOpen} onClose={() => !bulkLoading && setBulkDialogOpen(false)}>
        <DialogTitle>Alterar role em lote</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Alterar role de {selectedUsers.size} usuário(s) selecionado(s) para:
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Usuários alterados precisarão fazer login novamente. Seu próprio usuário é ignorado em alterações em lote.
          </Alert>
          {selectedOwnerRiskCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {selectedOwnerRiskCount} dono(s) selecionado(s) têm quadras vinculadas. Rebaixamento em lote para Player fica bloqueado;
              faça a alteração individual pela ficha comercial para revisar impacto.
            </Alert>
          )}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)} disabled={bulkLoading}>{t('common.cancel')}</Button>
          <Button onClick={() => handleBulkRoleChange('PLAYER')} disabled={bulkLoading || selectedOwnerRiskCount > 0}>Player</Button>
          <Button onClick={() => handleBulkRoleChange('FIELD_OWNER')} disabled={bulkLoading} color="warning">Field Owner</Button>
          <Button onClick={() => handleBulkRoleChange('ADMIN')} disabled={bulkLoading} color="error">Admin</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
