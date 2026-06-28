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
} from '@mui/icons-material';
import { collection, query, orderBy, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  assignLocationOwner,
  deleteLocation,
  inviteLocationManager,
  removeLocationManager,
  setLocationPublicationStatus,
  setLocationSubscription,
} from '../../services/cloudFunctions';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenFab } from '../../components/layout';
import {
  Location,
  FIELD_TYPE_CONFIG,
  LOCATION_PUBLICATION_STATUS_LABELS,
  LOCATION_SUBSCRIPTION_STATUS_LABELS,
  LocationPublicationStatus,
  LocationSubscriptionStatus,
  canManageLocation,
  AMENITY_LABELS,
  COMMERCIAL_AMENITIES,
  locationHasAmenities,
} from '../../types/location';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('ManageLocationsScreen');

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
  const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
  const [billingTarget, setBillingTarget] = useState<Location | null>(null);
  const [billingMonthlyFee, setBillingMonthlyFee] = useState('');
  const [billingDueDay, setBillingDueDay] = useState('');
  const [billingNotes, setBillingNotes] = useState('');
  const [teamTarget, setTeamTarget] = useState<Location | null>(null);
  const [teamOwnerId, setTeamOwnerId] = useState('');
  const [teamReason, setTeamReason] = useState('');
  const [managerUid, setManagerUid] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [teamActionLoading, setTeamActionLoading] = useState<string | null>(null);

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

  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return locations.filter((loc) => {
      const matchesSearch = !q ||
        loc.name?.toLowerCase().includes(q) ||
        loc.address?.toLowerCase().includes(q) ||
        loc.city?.toLowerCase().includes(q) ||
        loc.district?.toLowerCase().includes(q) ||
        loc.ownerId?.toLowerCase().includes(q);
      const matchesPublication = publicationFilter === 'ALL' || getPublicationStatus(loc) === publicationFilter;
      const matchesSubscription = subscriptionFilter === 'ALL' || getSubscriptionStatus(loc) === subscriptionFilter;
      const matchesType = typeFilter === 'ALL' || loc.fieldType === typeFilter || loc.primaryFieldType === typeFilter;
      return matchesSearch &&
        matchesPublication &&
        matchesSubscription &&
        matchesType &&
        locationHasAmenities(loc, amenityFilters);
    });
  }, [locations, searchQuery, publicationFilter, subscriptionFilter, typeFilter, amenityFilters]);

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

  const handleAmenityFilter = (amenity: string) => {
    setAmenityFilters((prev) =>
      prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity],
    );
  };

  const getPublicationStatus = (location: Location): LocationPublicationStatus =>
    location.publicationStatus || (location.isVerified ? 'PUBLISHED' : 'PENDING_REVIEW');

  const getSubscriptionStatus = (location: Location): LocationSubscriptionStatus =>
    location.subscriptionStatus || 'ACTIVE';

  const formatMonthlyFee = (monthlyFeeCents?: number) => {
    if (!monthlyFeeCents) return 'Mensalidade não definida';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(monthlyFeeCents / 100);
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

  const openBillingDialog = (location: Location) => {
    setBillingTarget(location);
    setBillingMonthlyFee(location.monthlyFeeCents ? String(location.monthlyFeeCents / 100) : '');
    setBillingDueDay(location.billingDueDay ? String(location.billingDueDay) : '');
    setBillingNotes(location.adminNotes || '');
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
    const monthlyFeeCents = billingMonthlyFee.trim()
      ? Math.round(Number(billingMonthlyFee.replace(',', '.')) * 100)
      : null;
    const billingDue = billingDueDay.trim() ? Number(billingDueDay) : null;
    if (monthlyFeeCents !== null && (!Number.isFinite(monthlyFeeCents) || monthlyFeeCents < 0)) {
      showError('Informe uma mensalidade válida.');
      return;
    }
    if (billingDue !== null && (!Number.isInteger(billingDue) || billingDue < 1 || billingDue > 28)) {
      showError('Dia de vencimento deve ficar entre 1 e 28.');
      return;
    }
    const actionKey = `${billingTarget.id}:billing`;
    setCommercialActionLoading(actionKey);
    try {
      await setLocationSubscription({
        locationId: billingTarget.id,
        subscriptionStatus: getSubscriptionStatus(billingTarget),
        monthlyFeeCents,
        billingDueDay: billingDue,
        adminNotes: billingNotes.trim() || null,
      });
      showSuccess('Mensalidade atualizada.');
      setBillingTarget(null);
    } catch (err) {
      logger.error('Erro ao salvar mensalidade:', err);
      showError('Não foi possível salvar a mensalidade.');
    } finally {
      setCommercialActionLoading(null);
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/location/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            {t('locations.addLocation')}
          </Button>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
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
                <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
                  {COMMERCIAL_AMENITIES.map((amenity) => (
                    <Chip
                      key={amenity}
                      label={AMENITY_LABELS[amenity] || amenity}
                      size="small"
                      color={amenityFilters.includes(amenity) ? 'primary' : 'default'}
                      variant={amenityFilters.includes(amenity) ? 'filled' : 'outlined'}
                      onClick={() => handleAmenityFilter(amenity)}
                      sx={{ flexShrink: 0 }}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('locations.localsCount', { count: filteredLocations.length })}
            {searchQuery && ` ${t('locations.searchingFor', { query: searchQuery })}`}
          </Typography>
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
              {filteredLocations.map((location) => {
                const fieldTypeLabel = location.fieldType
                  ? FIELD_TYPE_CONFIG[location.fieldType]?.label || location.fieldType
                  : null;
                const userCanManage = canManage(location);
                const userCanManageTeam = canManageTeam(location);
                const publicationStatus = getPublicationStatus(location);
                const subscriptionStatus = getSubscriptionStatus(location);
                const isCommercialActionBusy = commercialActionLoading?.startsWith(`${location.id}:`) ?? false;

                return (
                  <Card key={location.id} sx={{ position: 'relative' }}>
                    <CardActionArea onClick={() => navigate(`/location/${location.id}`)}>
                      <CardContent>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          {location.photoUrl ? (
                            <Box
                              component="img"
                              src={location.photoUrl}
                              alt={location.name}
                              loading="lazy"
                              sx={{
                                width: 80,
                                height: 80,
                                borderRadius: 1,
                                objectFit: 'cover',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <Avatar
                              variant="rounded"
                              sx={{
                                width: 80,
                                height: 80,
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
                                <Chip
                                  label={formatMonthlyFee(location.monthlyFeeCents)}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            {isAdmin && (
                              <Alert severity={publicationStatus === 'PUBLISHED' && ['TRIAL', 'ACTIVE'].includes(subscriptionStatus) ? 'success' : 'warning'} sx={{ mt: 1 }}>
                                {publicationStatus === 'PUBLISHED' && ['TRIAL', 'ACTIVE'].includes(subscriptionStatus)
                                  ? 'Visível para usuários.'
                                  : 'Não aparece para seleção pública até publicação/mensalidade ficarem válidas.'}
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
                      </Box>
                    )}
                    {userCanManageTeam && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
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

      <Dialog open={!!billingTarget} onClose={() => !commercialActionLoading && setBillingTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Mensalidade da quadra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {billingTarget?.name}
            </Typography>
            <TextField
              label="Mensalidade do dono da quadra (R$)"
              value={billingMonthlyFee}
              onChange={(e) => setBillingMonthlyFee(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
              fullWidth
              inputMode="decimal"
              placeholder="Ex.: 199.90"
            />
            <TextField
              label="Dia de vencimento"
              value={billingDueDay}
              onChange={(e) => setBillingDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              fullWidth
              helperText="Use 1 a 28 para evitar meses sem o dia selecionado."
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
