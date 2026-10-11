import { PageContainer } from '../../components/common/PageContainer';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18n from 'i18next';
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
  Stack,
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
import { useHideMobileTopBar } from '../../hooks/useMobileTopBarVisibility';

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
  name: data.name || i18n.t('admin.userManagement.noName'),
  email: data.email || '',
  phone: data.phone || undefined,
  photoUrl: data.photoUrl || undefined,
  role: data.role || 'PLAYER',
  createdAt: data.createdAtIso ? new Date(data.createdAtIso) : undefined,
  updatedAt: data.updatedAtIso ? new Date(data.updatedAtIso) : undefined,
  lastLoginAt: data.lastLoginAtIso ? new Date(data.lastLoginAtIso) : undefined,
  gamesPlayed: data.gamesPlayed || 0,
  level: data.level ?? 0,
  isMock: data.isMock,
  demoData: data.demoData,
  dataOrigin: data.dataOrigin,
  seedId: data.seedId,
  demoDataReason: data.demoDataReason,
  cpfVerified: data.cpfVerified,
  phoneVerified: data.phoneVerified,
  realDataProtected: data.realDataProtected,
});

const isLikelyQaUser = (user: UserWithRole): boolean => {
  const email = user.email.toLowerCase();
  const name = user.name.toLowerCase();

  return email.endsWith('@futeba.test') ||
    email.includes('+test') ||
    name.includes(' qa ') ||
    name.endsWith(' qa') ||
    name.includes('qa futeba');
};

const formatAdminDateTime = (date?: Date): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return i18n.t('admin.userManagement.dateNotInformed');
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
  useHideMobileTopBar();
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
  const tRef = useRef(t);
  tRef.current = t;

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
          const message = getFunctionsErrorMessage(error, 'searchAdminUsers', tRef.current('admin.userManagement.errors.loadUsers'));
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
      const message = getFunctionsErrorMessage(error, 'searchAdminUsers', t('feedback.admin.loadMoreUsersError'));
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
      showSuccess(t('admin.userManagement.success.roleUpdated', { name: user.name, role: newRole }));
    } catch (error) {
      const message = getFunctionsErrorMessage(error, 'setUserRole', t('admin.userManagement.errors.updateRole'));
      setError(message);
      showError(message);
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
    if (successCount > 0) showSuccess(t('admin.userManagement.success.bulkUpdated', { count: successCount }));
    if (errorCount > 0) showError(t('admin.userManagement.errors.bulkFailed', { count: errorCount }));
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
    const isDark = theme.palette.mode === 'dark';
    switch (role) {
      case 'ADMIN': return isDark ? theme.palette.error.main : theme.palette.error.dark;
      case 'FIELD_OWNER': return isDark ? theme.palette.warning.main : theme.palette.warning.dark;
      default: return theme.palette.grey[isDark ? 500 : 700];
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
      throw new Error(t('admin.userManagement.errors.invalidValue', { field: fieldLabel }));
    }
    return Math.round(parsed * 100);
  };

  const getVenueAccountScopeLabel = (scope?: AdminVenueAccountSummary['billingScope'] | null) => {
    if (scope === 'OWNER') return t('admin.userManagement.scope.owner');
    if (scope === 'FIELD_COUNT') return t('admin.userManagement.scope.fieldCount');
    if (scope === 'MANUAL_OVERRIDE') return t('admin.userManagement.scope.manual');
    return t('admin.userManagement.scope.venue');
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
    if (status === 'TRIAL') return t('admin.userManagement.accountStatus.trial');
    if (status === 'ACTIVE') return t('admin.userManagement.accountStatus.active');
    if (status === 'OVERDUE') return t('admin.userManagement.accountStatus.overdue');
    if (status === 'SUSPENDED') return t('admin.userManagement.accountStatus.suspended');
    if (status === 'CANCELLED') return t('admin.userManagement.accountStatus.cancelled');
    return t('admin.userManagement.accountStatus.none');
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
      showError(t('admin.userManagement.errors.dueDayRange'));
      return;
    }
    if (venueAccountForm.billingStartsAt && venueAccountForm.billingExpiresAt) {
      const startsAt = new Date(`${venueAccountForm.billingStartsAt}T00:00:00.000Z`);
      const expiresAt = new Date(`${venueAccountForm.billingExpiresAt}T00:00:00.000Z`);
      if (startsAt > expiresAt) {
        showError(t('admin.userManagement.errors.dateOrder'));
        return;
      }
    }

    setVenueAccountLoading(true);
    try {
      const billingBaseFeeCents = parseCurrencyCents(venueAccountForm.billingBaseFee, t('admin.userManagement.fields.baseValue'));
      const defaultLocationFeeCents = parseCurrencyCents(venueAccountForm.defaultLocationFee, t('admin.userManagement.fields.perVenue'));
      const pricePerActiveFieldCents = parseCurrencyCents(venueAccountForm.pricePerActiveField, t('admin.userManagement.fields.perActiveField'));
      const monthlyFeeOverrideCents = parseCurrencyCents(venueAccountForm.monthlyFeeOverride, t('admin.userManagement.fields.finalMonthly'));
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
      showSuccess(t('admin.userManagement.success.accountUpdated'));
      setVenueAccountDialogOpen(false);
      setRetryCount((count) => count + 1);
    } catch (error) {
      logger.error('Erro ao salvar conta comercial:', error);
      showError(error instanceof Error ? error.message : getFunctionsErrorMessage(error, 'upsertVenueAccount', t('admin.userManagement.errors.saveAccount')));
    } finally {
      setVenueAccountLoading(false);
    }
  };

  const handleReviewOnboarding = async (decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CANCELLED') => {
    if (!selectedUser || !selectedOnboarding) return;
    if (decision === 'APPROVED' && !onboardingCanApprove) {
      showError(t('admin.userManagement.errors.checklistRequired'));
      return;
    }
    if (decision !== 'APPROVED' && !onboardingReviewReason.trim()) {
      showError(t('admin.userManagement.errors.reasonRequired'));
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
      showSuccess(t('admin.userManagement.success.onboardingReviewed', { status: nextStatus.toLowerCase(), name: selectedUser.name }));
    } catch (error) {
      logger.error('Error reviewing owner onboarding:', error);
      showError(getFunctionsErrorMessage(error, 'reviewVenueOwnerOnboarding', t('admin.userManagement.errors.reviewOnboarding')));
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
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ p: 1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <IconButton onClick={goBack} aria-label={t('a11y.back')}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 1, minWidth: 0 }}>
              {t('page.title.userManagement')}
            </Typography>
          </Box>
          {selectedUsers.size > 0 && (
            <Button
              startIcon={<EditIcon />}
              onClick={() => setBulkDialogOpen(true)}
              sx={{ ml: { xs: 0, sm: 'auto' }, alignSelf: { xs: 'flex-start', sm: 'center' } }}
              variant="outlined"
              size="small"
            >
              {t('admin.userManagement.actions.changeSelected', { count: selectedUsers.size })}
            </Button>
          )}
        </Stack>
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 180px 220px' },
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
            label={t('admin.userManagement.filters.roleLabel')}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value="ALL">{t('admin.userManagement.filters.allRoles')}</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
            <MenuItem value="FIELD_OWNER">Field Owner</MenuItem>
            <MenuItem value="PLAYER">Player</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label={t('admin.userManagement.filters.commercialLabel')}
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}
          >
            <MenuItem value="ALL">{t('admin.userManagement.filters.all')}</MenuItem>
            <MenuItem value="FIELD_OWNER">{t('admin.userManagement.filters.fieldOwners')}</MenuItem>
            <MenuItem value="HAS_LOCATIONS">{t('admin.userManagement.filters.withVenues')}</MenuItem>
            <MenuItem value="PUBLISHED">{t('admin.userManagement.filters.withPublished')}</MenuItem>
            <MenuItem value="OVERDUE">{t('admin.userManagement.filters.withPending')}</MenuItem>
            <MenuItem value="INCOMPLETE">{t('admin.userManagement.filters.incomplete')}</MenuItem>
          </TextField>
        </Box>
      </Box>

      <PageContainer maxWidth="list">
        {fetchError ? (
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              {t('common.retry')}
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
              description={t('empty.noUserFoundDesc', { query: searchQuery || t('admin.userManagement.selectedFilters') })}
              actionLabel={t('admin.userManagement.actions.clearFilters')}
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
              {t(filteredUsers.length === 1 ? 'admin.userManagement.summary.shownOne' : 'admin.userManagement.summary.shownOther', { shown: filteredUsers.length, total: searchMeta?.totalMatched ?? filteredUsers.length })}
              {t('admin.userManagement.summary.serverSearch', {
                users: t((searchMeta?.scannedUsers ?? filteredUsers.length) === 1 ? 'admin.userManagement.summary.usersOne' : 'admin.userManagement.summary.usersOther', { count: searchMeta?.scannedUsers ?? filteredUsers.length }),
                venues: t(((searchMeta?.scannedLocations ?? 0)) === 1 ? 'admin.userManagement.summary.venuesOne' : 'admin.userManagement.summary.venuesOther', { count: searchMeta?.scannedLocations ?? 0 }),
              })}
              {searchMeta?.scanComplete === false ? t('admin.userManagement.summary.scanLimit') : ''}
              {hasMore ? t('admin.userManagement.summary.moreAvailable') : ''}
            </Typography>
            {isMdUp ? (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 980 }}>
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
                          {t('admin.userManagement.table.name')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'email'} direction={sortField === 'email' ? sortDirection : 'desc'} onClick={() => handleTableSort('email')}>
                          {t('admin.userManagement.table.email')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'role'} direction={sortField === 'role' ? sortDirection : 'desc'} onClick={() => handleTableSort('role')}>
                          {t('admin.userManagement.filters.roleLabel')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t('admin.userManagement.table.status')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        <TableSortLabel active={sortField === 'createdAt'} direction={sortField === 'createdAt' ? sortDirection : 'desc'} onClick={() => handleTableSort('createdAt')}>
                          {t('admin.userManagement.table.createdAt')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">{t('common.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const venueAccount = ownerProfiles[u.id]?.venueAccount;
                      const likelyQaUser = isLikelyQaUser(u);

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
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                                  {u.name}
                                </Typography>
                                {u.id === currentUser?.id && <Chip label={t('admin.userManagement.badges.you')} size="small" color="primary" variant="outlined" sx={{ mt: 0.25, height: 18, fontSize: '0.7rem' }} />}
                              </Box>
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
                            <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5 }}>
                              <Chip label={t('admin.userManagement.badges.active')} size="small" color="success" variant="outlined" />
                              {likelyQaUser && <Chip label={t('admin.userManagement.badges.qaTest')} size="small" color="warning" variant="outlined" />}
                            </Box>
                            {(u.role === 'FIELD_OWNER' || (ownerSummaries[u.id]?.totalLocations || 0) > 0) && (
                              <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5, ml: 0.5 }}>
                                <Chip
                                  label={t('admin.userManagement.badges.venuesCount', { count: ownerSummaries[u.id]?.totalLocations || 0 })}
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
                                        label={t('admin.userManagement.badges.plan', { label: venueAccount.billingPlanLabel })}
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </>
                                )}
                                {(ownerSummaries[u.id]?.incompleteLocations || 0) > 0 && (
                                  <Chip label={t('admin.userManagement.badges.incompleteRegistration')} size="small" color="info" variant="outlined" />
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
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 'none',
                }}
              >
                <List disablePadding aria-label={t('a11y.userList')} sx={{ bgcolor: 'background.paper' }}>
                  {filteredUsers.map((u, index) => {
                    const venueAccount = ownerProfiles[u.id]?.venueAccount;
                    const ownerSummary = ownerSummaries[u.id];
                    const likelyQaUser = isLikelyQaUser(u);

                    return (
                      <Box key={u.id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          disablePadding
                          sx={{
                            alignItems: 'stretch',
                            display: 'grid',
                            gridTemplateColumns: '36px minmax(0, 1fr) 44px',
                            columnGap: 0.75,
                            rowGap: 0.75,
                            px: 1.25,
                            py: 1.25,
                          }}
                        >
                          <Checkbox
                            checked={selectedUsers.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            disabled={u.id === currentUser?.id}
                            sx={{
                              alignSelf: 'flex-start',
                              justifySelf: 'center',
                              p: 0.75,
                              mt: 0.25,
                            }}
                          />
                          <ListItemButton
                            sx={{
                              gridColumn: '2 / 3',
                              display: 'grid',
                              gridTemplateColumns: '56px minmax(0, 1fr)',
                              columnGap: 1,
                              alignItems: 'flex-start',
                              borderRadius: 1.5,
                              minWidth: 0,
                              p: 0.5,
                              overflow: 'hidden',
                            }}
                            onClick={() => { setSelectedUser(u); setDialogOpen(true); setError(null); }}
                          >
                            <Box sx={{ width: 56, minWidth: 56, display: 'flex', justifyContent: 'flex-start', pt: 0.25 }}>
                              <PlayerAvatar name={u.name} photoUrl={u.photoUrl} size={40} level={u.level} />
                            </Box>
                            <Box sx={{ minWidth: 0, width: '100%' }}>
                              <Typography
                                variant="subtitle2"
                                component="span"
                                sx={{
                                  display: 'block',
                                  lineHeight: 1.25,
                                  overflowWrap: 'anywhere',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {u.name}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  flexWrap: 'wrap',
                                  mt: 0.5,
                                  '& .MuiChip-root': {
                                    maxWidth: '100%',
                                  },
                                  '& .MuiChip-label': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  },
                                }}
                              >
                                {u.id === currentUser?.id && <Chip label={t('admin.userManagement.badges.you')} size="small" color="primary" variant="outlined" />}
                                {likelyQaUser && <Chip label={t('admin.userManagement.badges.qaTest')} size="small" color="warning" variant="outlined" />}
                                <DemoDataChip data={u} />
                                {u.realDataProtected && (
                                  <Chip label={t('admin.userManagement.badges.realValidated')} size="small" color="success" variant="outlined" />
                                )}
                                <Chip
                                  label={u.role}
                                  size="small"
                                  sx={{
                                    bgcolor: alpha(getRoleColor(u.role), 0.1),
                                    color: getRoleColor(u.role),
                                    fontWeight: 700,
                                  }}
                                />
                              </Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  mt: 0.5,
                                  lineHeight: 1.35,
                                  overflowWrap: 'anywhere',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {u.email || t('admin.userManagement.fallback.emailNotRegistered')}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.25 }}
                              >
                                {t(u.gamesPlayed === 1 ? 'admin.userManagement.gamesOne' : 'admin.userManagement.gamesOther', { count: u.gamesPlayed })}
                              </Typography>
                            </Box>
                          </ListItemButton>
                          <IconButton
                            aria-label={t('a11y.managePermissions')}
                            onClick={() => { setSelectedUser(u); setDialogOpen(true); setError(null); }}
                            sx={{
                              gridColumn: '3 / 4',
                              alignSelf: 'flex-start',
                              justifySelf: 'center',
                              color: likelyQaUser ? 'warning.main' : 'text.secondary',
                            }}
                          >
                            <AdminIcon />
                          </IconButton>
                          {(u.role === 'FIELD_OWNER' || (ownerSummary?.totalLocations || 0) > 0) && (
                            <Box
                              sx={{
                                gridColumn: '2 / 4',
                                display: 'flex',
                                gap: 0.5,
                                flexWrap: 'wrap',
                                pl: 0.5,
                                '& .MuiChip-root': {
                                  maxWidth: '100%',
                                },
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                },
                              }}
                            >
                              <Chip label={t('admin.userManagement.badges.venuesCount', { count: ownerSummary?.totalLocations || 0 })} size="small" variant="outlined" />
                              <Chip label={t('admin.userManagement.badges.venuesPublished', { count: ownerSummary?.publishedLocations || 0 })} size="small" color="success" variant="outlined" />
                              {(ownerSummary?.monthlyFeeTotalCents || 0) > 0 && (
                                <Chip label={formatCurrency(ownerSummary?.monthlyFeeTotalCents)} size="small" color="success" variant="outlined" />
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
                              {(ownerSummary?.pendingLocations || 0) > 0 && (
                                <Chip label={t('admin.userManagement.badges.venuesInReview', { count: ownerSummary?.pendingLocations })} size="small" color="info" variant="outlined" />
                              )}
                              {(ownerSummary?.overdueLocations || 0) > 0 && (
                                <Chip label={t('admin.userManagement.badges.venuesOverdue', { count: ownerSummary?.overdueLocations })} size="small" color="warning" />
                              )}
                              {(ownerSummary?.incompleteLocations || 0) > 0 && (
                                <Chip label={t('admin.userManagement.badges.venuesIncomplete', { count: ownerSummary?.incompleteLocations })} size="small" color="info" />
                              )}
                            </Box>
                          )}
                        </ListItem>
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
                {loadingMore ? t('common.loading') : t('common.loadMore')}
              </Button>
            )}
          </>
        )}
      </PageContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="md" aria-labelledby="manage-user-dialog-title">
        <DialogTitle id="manage-user-dialog-title">{t('admin.userManagement.sheet.title')}</DialogTitle>
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
                    {selectedUser.email || t('admin.userManagement.fallback.emailNotRegistered')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {selectedUser.phone || t('admin.userManagement.fallback.phoneNotRegistered')}
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
                  <Typography variant="subtitle2" gutterBottom>{t('admin.userManagement.sheet.contactActivity')}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('admin.userManagement.table.email')}</Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{selectedUser.email || t('admin.userManagement.fallback.notRegistered')}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('admin.userManagement.sheet.phone')}</Typography>
                      <Typography variant="body2">{selectedUser.phone || t('admin.userManagement.fallback.notRegistered')}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('admin.userManagement.sheet.lastUpdate')}</Typography>
                      <Typography variant="body2">{formatAdminDateTime(selectedUser.updatedAt)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('admin.userManagement.sheet.lastLogin')}</Typography>
                      <Typography variant="body2">{formatAdminDateTime(selectedUser.lastLoginAt)}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2">{t('admin.userManagement.sheet.onboarding')}</Typography>
                    <Chip
                      label={selectedOnboarding?.status || t('admin.userManagement.sheet.noRequest')}
                      size="small"
                      color={selectedOnboarding?.status === 'APPROVED' ? 'success' : selectedOnboarding?.status === 'IN_REVIEW' ? 'info' : 'default'}
                      variant={selectedOnboarding ? 'filled' : 'outlined'}
                    />
                  </Box>
                  {selectedOnboarding ? (
                    <Box sx={{ display: 'grid', gap: 1.25 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.userManagement.sheet.responsible', {
                          name: selectedOnboarding.contactName || selectedUser.name,
                          email: selectedOnboarding.contactEmail || selectedUser.email || t('admin.userManagement.fallback.emailNotInformedLower'),
                          phone: selectedOnboarding.phone || selectedUser.phone || t('admin.userManagement.fallback.phoneNotInformedLower'),
                        })}
                      </Typography>
                      {selectedOnboarding.businessName && (
                        <Typography variant="body2" color="text.secondary">
                          {t('admin.userManagement.sheet.business', { name: selectedOnboarding.businessName })}
                        </Typography>
                      )}
                      {selectedOnboarding.notes && (
                        <Alert severity="info">{selectedOnboarding.notes}</Alert>
                      )}
                      {selectedOnboarding.reviewReason && (
                        <Alert severity="warning">{t('admin.userManagement.sheet.previousReason', { reason: selectedOnboarding.reviewReason })}</Alert>
                      )}
                      {onboardingNeedsReview && (
                        <Box sx={{ display: 'grid', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('admin.userManagement.sheet.approveHint')}
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.contactReviewed} onChange={() => handleOnboardingChecklist('contactReviewed')} sx={{ p: 1.25 }} />}
                              label={t('admin.userManagement.sheet.contactReviewed')}
                              sx={{ minHeight: 44 }}
                            />
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.locationsReviewed} onChange={() => handleOnboardingChecklist('locationsReviewed')} sx={{ p: 1.25 }} />}
                              label={t('admin.userManagement.sheet.venuesReviewed')}
                              sx={{ minHeight: 44 }}
                            />
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.termsReviewed} onChange={() => handleOnboardingChecklist('termsReviewed')} sx={{ p: 1.25 }} />}
                              label={t('admin.userManagement.sheet.termsReviewed')}
                              sx={{ minHeight: 44 }}
                            />
                            <FormControlLabel
                              control={<Checkbox checked={onboardingChecklist.billingReviewed} onChange={() => handleOnboardingChecklist('billingReviewed')} sx={{ p: 1.25 }} />}
                              label={t('admin.userManagement.sheet.billingReviewed')}
                              sx={{ minHeight: 44 }}
                            />
                          </Box>
                          <TextField
                            label={t('admin.userManagement.sheet.reviewReason')}
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
                              {t('admin.userManagement.sheet.approve')}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              disabled={!!onboardingReviewLoading}
                              onClick={() => handleReviewOnboarding('REJECTED')}
                            >
                              {t('admin.userManagement.sheet.reject')}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={!!onboardingReviewLoading}
                              onClick={() => handleReviewOnboarding('SUSPENDED')}
                            >
                              {t('admin.userManagement.sheet.suspend')}
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.userManagement.sheet.noRequestYet')}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2">{t('admin.userManagement.account.title')}</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={openVenueAccountDialog}
                      disabled={!selectedUser}
                    >
                      {selectedVenueAccount ? t('admin.userManagement.account.edit') : t('admin.userManagement.account.create')}
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
                            label={t('admin.userManagement.badges.plan', { label: selectedVenueAccount.billingPlanLabel })}
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
                          <Typography variant="caption" color="text.secondary">{t('admin.userManagement.account.computedFee')}</Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {formatCurrency(selectedVenueAccount.computedMonthlyFeeCents)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('admin.userManagement.account.legacy', { amount: formatCurrency(selectedVenueAccount.legacyMonthlyFeeTotalCents) })}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('admin.userManagement.account.scopeDue')}</Typography>
                          <Typography variant="body2">
                            {getVenueAccountScopeLabel(selectedVenueAccount.billingScope)}
                            {selectedVenueAccount.billingCycle ? ` · ${selectedVenueAccount.billingCycle.toLowerCase()}` : ''}
                            {selectedVenueAccount.billingDueDay ? ` · ${t('admin.userManagement.account.dayN', { day: selectedVenueAccount.billingDueDay })}` : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('admin.userManagement.account.venuesFields', { venues: selectedVenueAccount.linkedLocationsCount, fields: selectedVenueAccount.activeFieldCount })}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">{t('admin.userManagement.account.billingContact')}</Typography>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {selectedVenueAccount.billingContactName || selectedOnboarding?.contactName || selectedUser.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', display: 'block' }}>
                            {selectedVenueAccount.billingContactEmail || selectedOnboarding?.contactEmail || selectedUser.email || t('admin.userManagement.fallback.emailNotInformed')}
                          </Typography>
                        </Box>
                      </Box>
                      <Alert severity={selectedVenueAccount.status === 'OVERDUE' || selectedVenueAccount.status === 'SUSPENDED' ? 'warning' : 'info'}>
                        {t('admin.userManagement.account.statusSummary', {
                          status: getVenueAccountStatusLabel(selectedVenueAccount.status).toLowerCase(),
                          count: selectedVenueAccount.publishedLocationsCount,
                        })}
                      </Alert>
                    </Box>
                  ) : (
                    <Alert severity="info">
                      {t('admin.userManagement.account.noAggregated')}
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">{t('admin.userManagement.summaryCards.monthlyRevenue')}</Typography>
                    <Typography variant="h6">{formatCurrency(selectedOwnerProfile?.summary.monthlyFeeTotalCents)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.userManagement.summaryCards.activeSubscriptions', { count: selectedOwnerProfile?.summary.activeSubscriptionLocations || 0 })}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">{t('admin.userManagement.summaryCards.venues')}</Typography>
                    <Typography variant="h6">{selectedOwnerProfile?.summary.totalLocations || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.userManagement.summaryCards.venuesDetail', { published: selectedOwnerProfile?.summary.publishedLocations || 0, pending: selectedOwnerProfile?.summary.pendingLocations || 0 })}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">{t('admin.userManagement.summaryCards.risks')}</Typography>
                    <Typography variant="h6">{(selectedOwnerProfile?.summary.overdueLocations || 0) + (selectedOwnerProfile?.summary.incompleteLocations || 0)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.userManagement.summaryCards.risksDetail', { overdue: selectedOwnerProfile?.summary.overdueLocations || 0, incomplete: selectedOwnerProfile?.summary.incompleteLocations || 0 })}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {(selectedOwnerProfile?.summary.totalLocations || 0) > 0 ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BusinessIcon fontSize="small" />
                    {t('admin.userManagement.venuesList.title')}
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
                              {t('admin.userManagement.venuesList.view')}
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => openLocation(location.id, true)}
                            >
                              {t('common.edit')}
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
                            location.city || location.state ? `${location.city || t('admin.userManagement.fallback.cityNotInformed')}${location.state ? `/${location.state}` : ''}` : t('admin.userManagement.venuesList.incompleteAddress'),
                            t('admin.userManagement.accountDialog.fieldCount', { count: location.fieldCount }),
                            t('admin.userManagement.venuesList.managersCount', { count: location.managersCount }),
                            location.monthlyFeeCents ? `${formatCurrency(location.monthlyFeeCents)}${location.billingDueDay ? ` · ${t('admin.userManagement.venuesList.dueDay', { day: location.billingDueDay })}` : ''}` : t('admin.userManagement.venuesList.feeNotDefined'),
                          ].join(' · ')}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t('admin.userManagement.venuesList.none')}
                </Alert>
              )}

              <Alert severity={(selectedOwnerProfile?.summary.overdueLocations || 0) > 0 ? 'warning' : 'info'} sx={{ mb: 2 }}>
                {t('admin.userManagement.roleDialog.auditNote')}
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
        <DialogTitle>{t('admin.userManagement.confirm.title')}</DialogTitle>
        <DialogContent>
          {isPendingSelfDemotion ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('admin.userManagement.confirm.selfDemotion')}
            </Alert>
          ) : isPendingAdminPromotion ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('admin.userManagement.confirm.adminPromotion')}
            </Alert>
          ) : isPendingFieldOwnerDemotion ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('admin.userManagement.confirm.ownerDemotion', {
                total: pendingOwnerSummary?.totalLocations || 0,
                published: pendingOwnerSummary?.publishedLocations || 0,
                amount: formatCurrency(pendingOwnerSummary?.monthlyFeeTotalCents),
              })}
            </Alert>
          ) : null}
          <Typography sx={{ mb: 2 }}>
            <Trans
              i18nKey="admin.userManagement.confirm.changeRoleQuestion"
              values={{ name: pendingRoleChange?.user.name, from: pendingRoleChange?.user.role, to: pendingRoleChange?.role }}
              components={{ strong: <strong /> }}
            />
          </Typography>
          {requiresStrongConfirmation && (
            <TextField
              fullWidth
              size="small"
              label={t('admin.userManagement.confirm.typeToConfirm')}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 20 }}
            />
          )}
          <Alert severity="info">
            {t('admin.userManagement.confirm.reloginNote')}
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
        <DialogTitle>{t('admin.userManagement.accountDialog.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('admin.userManagement.accountDialog.intro')}
          </Alert>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mt: 1 }}>
            <TextField
              select
              label={t('admin.userManagement.table.status')}
              value={venueAccountForm.status}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, status: event.target.value as VenueAccountStatus }))}
              fullWidth
            >
              <MenuItem value="TRIAL">{t('admin.userManagement.accountStatus.trial')}</MenuItem>
              <MenuItem value="ACTIVE">{t('admin.userManagement.accountDialog.statusActive')}</MenuItem>
              <MenuItem value="OVERDUE">{t('admin.userManagement.accountStatus.overdue')}</MenuItem>
              <MenuItem value="SUSPENDED">{t('admin.userManagement.accountStatus.suspended')}</MenuItem>
              <MenuItem value="CANCELLED">{t('admin.userManagement.accountStatus.cancelled')}</MenuItem>
            </TextField>
            <TextField
              select
              label={t('admin.userManagement.accountDialog.billingModel')}
              value={venueAccountForm.billingScope}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingScope: event.target.value as VenueAccountBillingScope }))}
              fullWidth
              helperText={t('admin.userManagement.accountDialog.billingModelHelp')}
            >
              <MenuItem value="OWNER">{t('admin.userManagement.accountDialog.modelOwner')}</MenuItem>
              <MenuItem value="LOCATION">{t('admin.userManagement.accountDialog.modelVenue')}</MenuItem>
              <MenuItem value="FIELD_COUNT">{t('admin.userManagement.accountDialog.modelField')}</MenuItem>
              <MenuItem value="MANUAL_OVERRIDE">{t('admin.userManagement.accountDialog.modelManual')}</MenuItem>
            </TextField>
            <TextField
              select
              label={t('admin.userManagement.accountDialog.basePlan')}
              value={venueAccountForm.billingPlanCode}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingPlanCode: event.target.value as VenueAccountPlanCode | '' }))}
              fullWidth
            >
              <MenuItem value="">{t('admin.userManagement.accountDialog.noPlan')}</MenuItem>
              <MenuItem value="TRIAL">Trial</MenuItem>
              <MenuItem value="BASIC">Basic</MenuItem>
              <MenuItem value="PRO">Pro</MenuItem>
              <MenuItem value="ENTERPRISE">Enterprise</MenuItem>
              <MenuItem value="CUSTOM">Custom</MenuItem>
            </TextField>
            <TextField
              label={t('admin.userManagement.accountDialog.planName')}
              value={venueAccountForm.billingPlanLabel}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingPlanLabel: event.target.value }))}
              fullWidth
              helperText={t('admin.userManagement.accountDialog.planNameHelp')}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              select
              label={t('admin.userManagement.accountDialog.cycle')}
              value={venueAccountForm.billingCycle}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingCycle: event.target.value as VenueAccountBillingCycle | '' }))}
              fullWidth
            >
              <MenuItem value="">{t('admin.userManagement.accountDialog.noCycle')}</MenuItem>
              <MenuItem value="MONTHLY">{t('admin.userManagement.accountDialog.cycleMonthly')}</MenuItem>
              <MenuItem value="QUARTERLY">{t('admin.userManagement.accountDialog.cycleQuarterly')}</MenuItem>
              <MenuItem value="SEMIANNUAL">{t('admin.userManagement.accountDialog.cycleSemiannual')}</MenuItem>
              <MenuItem value="ANNUAL">{t('admin.userManagement.accountDialog.cycleAnnual')}</MenuItem>
              <MenuItem value="CUSTOM">{t('admin.userManagement.accountDialog.cycleCustom')}</MenuItem>
            </TextField>
            <TextField
              label={t('admin.userManagement.accountDialog.dueDay')}
              value={venueAccountForm.billingDueDay}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingDueDay: event.target.value.replace(/\D/g, '').slice(0, 2) }))}
              fullWidth
              helperText={t('admin.userManagement.accountDialog.dueDayHelp')}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.baseFee')}
              value={venueAccountForm.billingBaseFee}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingBaseFee: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText={t('admin.userManagement.accountDialog.baseFeeHelp')}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.manualFee')}
              value={venueAccountForm.monthlyFeeOverride}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, monthlyFeeOverride: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText={t('admin.userManagement.accountDialog.manualFeeHelp')}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.venueFee')}
              value={venueAccountForm.defaultLocationFee}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, defaultLocationFee: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText={t('admin.userManagement.accountDialog.venueFeeHelp')}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.fieldFee')}
              value={venueAccountForm.pricePerActiveField}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, pricePerActiveField: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))}
              inputMode="decimal"
              fullWidth
              helperText={t('admin.userManagement.accountDialog.fieldFeeHelp')}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.billingStart')}
              type="date"
              value={venueAccountForm.billingStartsAt}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingStartsAt: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.contractEnd')}
              type="date"
              value={venueAccountForm.billingExpiresAt}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingExpiresAt: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('admin.userManagement.account.billingContact')}
              value={venueAccountForm.billingContactName}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactName: event.target.value }))}
              fullWidth
            />
            <TextField
              label={t('admin.userManagement.accountDialog.billingEmail')}
              value={venueAccountForm.billingContactEmail}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactEmail: event.target.value }))}
              fullWidth
              inputProps={{ maxLength: 254 }}
            />
            <TextField
              label={t('admin.userManagement.accountDialog.billingPhone')}
              value={venueAccountForm.billingContactPhone}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactPhone: event.target.value }))}
              fullWidth
            />
            <TextField
              label={t('admin.userManagement.accountDialog.document')}
              value={venueAccountForm.billingContactDocument}
              onChange={(event) => setVenueAccountForm((current) => ({ ...current, billingContactDocument: event.target.value }))}
              fullWidth
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('admin.userManagement.accountDialog.linkedVenues')}</Typography>
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
                    label={`${location.name} · ${location.city || t('admin.userManagement.fallback.cityNotInformed')} · ${t('admin.userManagement.accountDialog.fieldCount', { count: location.fieldCount })}`}
                    sx={{ minHeight: 44 }}
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="warning">{t('admin.userManagement.accountDialog.noVenuesToLink')}</Alert>
            )}
          </Box>
          <TextField
            label={t('admin.userManagement.accountDialog.publicNote')}
            value={venueAccountForm.notes}
            onChange={(event) => setVenueAccountForm((current) => ({ ...current, notes: event.target.value }))}
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 2 }}
            inputProps={{ maxLength: 1000 }}
          />
          <TextField
            label={t('admin.userManagement.accountDialog.internalNotes')}
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
            {venueAccountLoading ? <CircularProgress size={20} /> : t('admin.userManagement.accountDialog.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDialogOpen} onClose={() => !bulkLoading && setBulkDialogOpen(false)}>
        <DialogTitle>{t('admin.userManagement.bulk.title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {t('admin.userManagement.bulk.prompt', { count: selectedUsers.size })}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('admin.userManagement.bulk.note')}
          </Alert>
          {selectedOwnerRiskCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('admin.userManagement.bulk.ownerRisk', { count: selectedOwnerRiskCount })}
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
