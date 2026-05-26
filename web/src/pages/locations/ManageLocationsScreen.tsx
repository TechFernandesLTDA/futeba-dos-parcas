import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
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
  Fab,
  Button,
  Rating,
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
import { deleteLocation } from '../../services/cloudFunctions';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { Location, FIELD_TYPE_CONFIG, canManageLocation } from '../../types/location';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ManageLocationsScreen');

export const ManageLocationsScreen: React.FC = () => {
  useDocumentTitle('Gerenciar Locais');
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
        setError('Não foi possível carregar os locais. Verifique sua conexão e tente novamente.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [reloadKey, isAdmin, user?.id]);

  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        loc.name?.toLowerCase().includes(q) ||
        loc.address?.toLowerCase().includes(q) ||
        loc.city?.toLowerCase().includes(q) ||
        loc.district?.toLowerCase().includes(q),
    );
  }, [locations, searchQuery]);

  const canManage = (loc: Location) =>
    isAdmin || (user?.id ? canManageLocation(loc, user.id) : false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLocation({ locationId: deleteTarget.id });
      showSuccess(`Local "${deleteTarget.name}" excluído com sucesso.`);
      setDeleteTarget(null);
    } catch (err) {
      logger.error('Erro ao excluir local:', err);
      showError('Erro ao excluir local. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearSearch = () => setSearchQuery('');

  return (
    <Box sx={{ pb: 10 }}>
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
          <IconButton onClick={() => navigate('/?tab=4')} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Gerenciar Locais
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/location/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            Adicionar Local
          </Button>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por nome, endereço, cidade ou bairro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar locais"
            inputProps={{ maxLength: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch} aria-label="Limpar busca" edge="end" sx={{ minWidth: 44, minHeight: 44 }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>
      </Box>

      <Container maxWidth="md" sx={{ py: 2 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {filteredLocations.length} {filteredLocations.length === 1 ? 'local' : 'locais'}
            {searchQuery && ` para "${searchQuery}"`}
          </Typography>
        )}

        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : !error && filteredLocations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchQuery ? 'Nenhum local encontrado' : 'Nenhum local cadastrado'}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
              {searchQuery
                ? 'Tente alterar os termos da busca'
                : 'Adicione locais para organizar seus jogos!'}
            </Typography>
            {searchQuery ? (
              <Button variant="outlined" onClick={handleClearSearch}>
                Limpar busca
              </Button>
            ) : (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/location/create')}>
                Adicionar primeiro local
              </Button>
            )}
          </Box>
        ) : (
          !error && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredLocations.map((location) => {
                const fieldTypeLabel = location.fieldType
                  ? FIELD_TYPE_CONFIG[location.fieldType]?.label || location.fieldType
                  : null;
                const userCanManage = canManage(location);

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
                                  label={`${location.fieldCount} ${location.fieldCount === 1 ? 'campo' : 'campos'}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </CardActionArea>
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
                          aria-label={`Editar ${location.name}`}
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
                            aria-label={`Excluir ${location.name}`}
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
      </Container>

      {/* FAB mobile */}
      <Fab
        color="primary"
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: { xs: 80, md: 24 },
          right: { xs: 16, md: 24 },
          pb: { xs: 'env(safe-area-inset-bottom, 0px)', md: 0 },
        }}
        onClick={() => navigate('/location/create')}
        aria-label="Adicionar local"
      >
        <AddIcon />
      </Fab>

      {/* Confirmação de exclusão */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        aria-labelledby="delete-location-title"
      >
        <DialogTitle id="delete-location-title">Excluir local?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
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
