import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
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
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AdminPanelSettings as AdminIcon,
  Search as SearchIcon,
  SearchOff as SearchOffIcon,
  PersonOff as PersonOffIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, getDocs, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { setUserRole as setUserRoleCallable } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
// #2176: EmptyState canônico (rico, com i18n) vive em common/EmptyState — não no GameCard.
import { EmptyState } from '../../components/common/EmptyState';
import { createLogger } from '../../utils/logger';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('UserManagementScreen');

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
  createdAt?: Date;
  gamesPlayed: number;
  level: number;
}

// #2276: interface tipada para o doc users (substitui Record<string, any>).
interface RawAdminUserDoc {
  name?: string;
  email?: string;
  photoUrl?: string;
  role?: string;
  createdAt?: { toDate?: () => Date };
  gamesPlayed?: number;
  level?: number;
}

export const UserManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.userManagement'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user: currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const PAGE_SIZE = 50;

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
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

  const handleRetry = () => {
    setFetchError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  const parseUserDoc = (d: DocumentSnapshot) => {
    const data = snakeToCamel<RawAdminUserDoc>(d.data() ?? {});
    return {
      id: d.id,
      name: data.name || 'Sem nome',
      email: data.email || '',
      photoUrl: data.photoUrl,
      role: data.role || 'PLAYER',
      createdAt: data.createdAt?.toDate?.(),
      gamesPlayed: data.gamesPlayed || 0,
      level: data.level || 1,
    };
  };

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('created_at', 'desc'), limit(PAGE_SIZE));
        const snapshot = await getDocs(q);

        if (cancelled) return;

        setUsers(snapshot.docs.map(parseUserDoc));
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (error) {
        if (!cancelled) {
          logger.error('Error fetching users:', error);
          setFetchError('Erro ao carregar usuários.');
          showErrorRef.current('Erro ao carregar usuários.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsers();
    return () => { cancelled = true; };
  }, [retryCount]);

  const handleLoadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('created_at', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);

      setUsers((prev) => [...prev, ...snapshot.docs.map(parseUserDoc)]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      logger.error('Error loading more users:', error);
      setFetchError('Erro ao carregar mais usuários.');
      showError('Erro ao carregar mais usuários.');
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmRoleChange = (user: UserWithRole, newRole: string) => {
    if (user.role === newRole) return;
    setPendingRoleChange({ user, role: newRole });
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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const isPendingSelfDemotion =
    pendingRoleChange?.user.id === currentUser?.id && pendingRoleChange?.role !== 'ADMIN';
  const isPendingAdminDemotion =
    pendingRoleChange?.user.role === 'ADMIN' && pendingRoleChange?.role !== 'ADMIN';
  const isPendingAdminPromotion =
    pendingRoleChange?.user.role !== 'ADMIN' && pendingRoleChange?.role === 'ADMIN';

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return theme.palette.error.main;
      case 'FIELD_OWNER': return theme.palette.warning.main;
      default: return theme.palette.grey[500];
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
          <IconButton onClick={goBack} aria-label="Voltar">
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
        <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar usuário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar usuário"
            inputProps={{ maxLength: 200 }}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
          <TextField
            select
            size="small"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="ALL">Todos os roles</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
            <MenuItem value="FIELD_OWNER">Field Owner</MenuItem>
            <MenuItem value="PLAYER">Player</MenuItem>
          </TextField>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
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
          searchQuery ? (
            <EmptyState
              icon={<SearchOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />}
              title="Nenhum usuário encontrado"
              description={`Não encontramos usuários para "${searchQuery}". Tente outro termo.`}
              actionLabel="Limpar busca"
              onAction={() => setSearchQuery('')}
            />
          ) : (
            <EmptyState
              icon={<PersonOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />}
              title="Nenhum usuário cadastrado"
              description="Ainda não há usuários no sistema."
            />
          )
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''} exibido{filteredUsers.length !== 1 ? 's' : ''}
              {hasMore && !searchQuery ? ' (mais disponíveis)' : ''}
            </Typography>
            <Card>
              <List disablePadding aria-label="Lista de usuários">
                {filteredUsers.map((u, index) => (
                  <Box key={u.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      secondaryAction={
                        <IconButton edge="end" aria-label="Gerenciar permissões" onClick={() => { setSelectedUser(u); setDialogOpen(true); setError(null); }}>
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
                  </Box>
                ))}
              </List>
            </Card>
            {hasMore && !searchQuery && (
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
      </Container>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="manage-user-dialog-title">
        <DialogTitle id="manage-user-dialog-title">Gerenciar Usuário</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                {selectedUser.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedUser.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Role atual: {selectedUser.role}
              </Typography>
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
          ) : null}
          <Typography sx={{ mb: 2 }}>
            Alterar role de <strong>{pendingRoleChange?.user.name}</strong> de{' '}
            <strong>{pendingRoleChange?.user.role}</strong> para <strong>{pendingRoleChange?.role}</strong>?
          </Typography>
          <Alert severity="info">
            O usuário precisará fazer login novamente após a alteração.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            color={isPendingAdminDemotion ? 'error' : 'primary'}
            variant="contained"
            disabled={actionLoading}
            onClick={() => {
              const roleChange = pendingRoleChange;
              if (roleChange) {
                executeRoleChange(roleChange.user, roleChange.role);
              }
              setConfirmDialogOpen(false);
              setPendingRoleChange(null);
            }}
          >
            {t('common.confirm')}
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
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)} disabled={bulkLoading}>{t('common.cancel')}</Button>
          <Button onClick={() => handleBulkRoleChange('PLAYER')} disabled={bulkLoading}>Player</Button>
          <Button onClick={() => handleBulkRoleChange('FIELD_OWNER')} disabled={bulkLoading} color="warning">Field Owner</Button>
          <Button onClick={() => handleBulkRoleChange('ADMIN')} disabled={bulkLoading} color="error">Admin</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
