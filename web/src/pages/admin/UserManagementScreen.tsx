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
  searchAdminUsers,
  setUserRole as setUserRoleCallable,
  type AdminOwnerLocationSummary,
  type AdminUserCrmRow,
  type AdminUserSearchResponse,
} from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
// #2176: EmptyState canônico (rico, com i18n) vive em common/EmptyState — não no GameCard.
import { EmptyState } from '../../components/common/EmptyState';
import { createLogger } from '../../utils/logger';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('UserManagementScreen');
const ADMIN_USER_PAGE_SIZE = 50;
type OwnerFilter = 'ALL' | 'FIELD_OWNER' | 'HAS_LOCATIONS' | 'PUBLISHED' | 'OVERDUE' | 'INCOMPLETE';

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
  gamesPlayed: number;
  level: number;
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
  gamesPlayed: data.gamesPlayed || 0,
  level: data.level || 1,
});

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
          setFetchError(getFunctionsErrorMessage(error, 'searchAdminUsers', 'Erro ao carregar usuários.'));
          showErrorRef.current('Erro ao carregar usuários.');
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
      setFetchError(getFunctionsErrorMessage(error, 'searchAdminUsers', 'Erro ao carregar mais usuários.'));
      showError(t('feedback.admin.loadMoreUsersError'));
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

  const openLocation = (locationId: string, edit = false) => {
    setDialogOpen(false);
    navigate(edit ? `/location/${locationId}/edit` : `/location/${locationId}`);
  };

  const selectedOwnerProfile = selectedUser ? ownerProfiles[selectedUser.id] : undefined;

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
        <Box sx={{ px: 2, pb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 180px 220px' }, gap: 1 }}>
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
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} hover selected={selectedUsers.has(u.id)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedUsers.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            disabled={u.id === currentUser?.id}
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
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Card>
                <List disablePadding aria-label={t('a11y.userList')}>
                  {filteredUsers.map((u, index) => (
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
                          sx={{ mr: 1 }}
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
                  ))}
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
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
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
                      <Typography variant="body2">{selectedUser.updatedAt ? selectedUser.updatedAt.toLocaleDateString() : 'Não informada'}</Typography>
                    </Box>
                  </Box>
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
