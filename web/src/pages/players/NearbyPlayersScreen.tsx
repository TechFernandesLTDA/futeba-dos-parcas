import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  LocationOff as LocationOffIcon,
  Message as MessageIcon,
  MyLocation as MyLocationIcon,
  PersonSearch as PersonSearchIcon,
  Replay as RetryIcon,
} from '@mui/icons-material';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { NearbyRadiusKm, NearbySocialFilter, useNearbyPlayers } from '../../hooks/useNearbyPlayers';
import { useToast } from '../../contexts/ToastContext';
import { useCreateDirectChat } from '../../hooks/useDirectMessages';

const RADII: NearbyRadiusKm[] = [1, 5, 10, 25];
const FILTERS: NearbySocialFilter[] = ['all', 'following'];

export const NearbyPlayersScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { showError, showSuccess } = useToast();
  const { create: createDirectChat, creating: creatingChat } = useCreateDirectChat();
  const {
    players,
    radiusKm,
    setRadiusKm,
    socialFilter,
    setSocialFilter,
    loading,
    sharingLoading,
    error,
    sharingState,
    canUseLocation,
    refreshFromCurrentLocation,
    enableSharing,
    disableSharing,
  } = useNearbyPlayers();
  useDocumentTitle(t('nearbyPlayers.title'));

  const handleToggleSharing = async (checked: boolean) => {
    try {
      if (checked) {
        await enableSharing();
        showSuccess(t('nearbyPlayers.sharingEnabled'));
      } else {
        await disableSharing();
        showSuccess(t('nearbyPlayers.sharingDisabled'));
      }
    } catch {
      showError(t('nearbyPlayers.sharingError'));
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshFromCurrentLocation();
    } catch {
      showError(t('nearbyPlayers.loadError'));
    }
  };

  const handleMessage = async (playerId: string) => {
    try {
      const chatId = await createDirectChat(playerId);
      navigate(`/messages/${chatId}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : t('directMessages.createError'));
    }
  };

  return (
    <PageContainer maxWidth="focused">
      <Stack spacing={2} sx={{ py: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('nearbyPlayers.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('nearbyPlayers.subtitle')}
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    color: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <MyLocationIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t('nearbyPlayers.sharingTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('nearbyPlayers.sharingDescription')}
                  </Typography>
                </Box>
                {sharingLoading && <CircularProgress size={22} />}
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={sharingState.enabled}
                    disabled={!canUseLocation || sharingLoading}
                    onChange={(event) => void handleToggleSharing(event.target.checked)}
                  />
                }
                label={sharingState.enabled ? t('nearbyPlayers.sharingOn') : t('nearbyPlayers.sharingOff')}
              />

              {!canUseLocation && (
                <Alert severity="warning" icon={<LocationOffIcon />}>
                  {t('nearbyPlayers.geolocationUnavailable')}
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            select
            size="small"
            label={t('nearbyPlayers.radius')}
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value) as NearbyRadiusKm)}
            sx={{ minWidth: 140 }}
          >
            {RADII.map((radius) => (
              <MenuItem key={radius} value={radius}>
                {t('nearbyPlayers.radiusKm', { count: radius })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('nearbyPlayers.filter')}
            value={socialFilter}
            onChange={(event) => setSocialFilter(event.target.value as NearbySocialFilter)}
            sx={{ minWidth: 180 }}
          >
            {FILTERS.map((filter) => (
              <MenuItem key={filter} value={filter}>
                {t(`nearbyPlayers.filter_${filter}`)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <MyLocationIcon />}
            disabled={!canUseLocation || loading}
            onClick={() => void handleRefresh()}
          >
            {t('nearbyPlayers.search')}
          </Button>
        </Stack>

        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RetryIcon />} onClick={() => void handleRefresh()}>
                {t('common.retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading && <LoadingState shimmerCount={4} itemType="CARD" />}

        {!loading && !error && players.length === 0 && (
          <EmptyState
            icon={<PersonSearchIcon />}
            title={t('nearbyPlayers.emptyTitle')}
            description={t('nearbyPlayers.emptyDescription')}
            actionLabel={t('nearbyPlayers.search')}
            onAction={() => void handleRefresh()}
          />
        )}

        {!loading && players.length > 0 && (
          <Stack spacing={1.5}>
            {players.map((player) => (
              <Card key={player.id}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar src={player.photoUrl ?? undefined} alt={player.displayName}>
                      {player.displayName.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>
                        {player.displayName}
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                        <Chip size="small" label={t(`nearbyPlayers.band_${player.distanceBand}`)} />
                        {player.preferredPosition && (
                          <Chip size="small" variant="outlined" label={player.preferredPosition} />
                        )}
                        {player.isFollowing && (
                          <Chip size="small" color="primary" variant="outlined" label={t('nearbyPlayers.following')} />
                        )}
                      </Stack>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
                      <Button variant="outlined" onClick={() => navigate(`/profile/${player.id}`)}>
                        {t('profile.viewProfile')}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={creatingChat ? <CircularProgress size={16} color="inherit" /> : <MessageIcon />}
                        disabled={creatingChat}
                        onClick={() => void handleMessage(player.id)}
                      >
                        {t('directMessages.message')}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
};
