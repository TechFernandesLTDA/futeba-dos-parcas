import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  DirectionsCar as DirectionsCarIcon,
  NearMe as NearMeIcon,
  PersonPinCircle as PersonPinCircleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { Game } from '../../types/game';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/common/EmptyState';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { useGameRides, type GameRide, type GameRideType } from '../../hooks/useGameRides';

interface GameRidesPanelProps {
  game: Game;
  canUse: boolean;
}

const DEFAULT_SEATS = 1;

function getRideAvatarColor(type: GameRideType) {
  return type === 'OFFER' ? 'success.main' : 'warning.main';
}

const GameRideItem: React.FC<{ ride: GameRide }> = ({ ride }) => {
  const { t } = useTranslation();

  return (
    <ListItem alignItems="flex-start" disableGutters>
      <ListItemAvatar>
        <Avatar src={ride.userPhoto} sx={{ bgcolor: getRideAvatarColor(ride.type), color: 'common.white' }}>
          {ride.userName.charAt(0).toUpperCase()}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={(
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
            <Typography variant="body2" fontWeight={700}>{ride.userName}</Typography>
            <Chip
              size="small"
              color={ride.type === 'OFFER' ? 'success' : 'warning'}
              label={t(`gameRides.types.${ride.type}`)}
            />
            {ride.type === 'OFFER' && ride.seats && (
              <Chip size="small" variant="outlined" label={t('gameRides.seatsCount', { count: ride.seats })} />
            )}
          </Stack>
        )}
        secondary={(
          <Box sx={{ mt: 0.75 }}>
            <Typography variant="body2" color="text.secondary">
              {t('gameRides.route', { origin: ride.originLabel, destination: ride.destinationLabel })}
            </Typography>
            {ride.note && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {ride.note}
              </Typography>
            )}
          </Box>
        )}
      />
    </ListItem>
  );
};

export const GameRidesPanel: React.FC<GameRidesPanelProps> = ({ game, canUse }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const {
    rides,
    currentUserRide,
    loading,
    saving,
    cancelling,
    error,
    refetch,
    saveRide,
    cancelRide,
  } = useGameRides(game, canUse);

  const [type, setType] = useState<GameRideType>('OFFER');
  const [originLabel, setOriginLabel] = useState('');
  const [destinationLabel, setDestinationLabel] = useState(game.locationName || '');
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (currentUserRide) {
      setType(currentUserRide.type);
      setOriginLabel(currentUserRide.originLabel);
      setDestinationLabel(currentUserRide.destinationLabel);
      setSeats(currentUserRide.seats || DEFAULT_SEATS);
      setNote(currentUserRide.note);
      return;
    }

    setDestinationLabel(game.locationName || '');
  }, [currentUserRide, game.locationName]);

  if (!['SCHEDULED', 'CONFIRMED', 'LIVE'].includes(game.status)) return null;

  const offerCount = rides.filter((ride) => ride.type === 'OFFER').length;
  const requestCount = rides.filter((ride) => ride.type === 'REQUEST').length;

  const handleSave = async () => {
    try {
      await saveRide({
        type,
        originLabel,
        destinationLabel,
        seats: type === 'OFFER' ? seats : null,
        note,
      });
      showSuccess(t('gameRides.saveSuccess'));
    } catch (err) {
      showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRide();
      setOriginLabel('');
      setNote('');
      setSeats(DEFAULT_SEATS);
      showSuccess(t('gameRides.cancelSuccess'));
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'info.main', color: 'info.contrastText' }}>
            <DirectionsCarIcon />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('gameRides.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('gameRides.description')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75}>
            <Chip size="small" color="success" variant="outlined" label={t('gameRides.offersCount', { count: offerCount })} />
            <Chip size="small" color="warning" variant="outlined" label={t('gameRides.requestsCount', { count: requestCount })} />
          </Stack>
        </Stack>

        {!canUse && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('gameRides.confirmationRequired')}
          </Alert>
        )}

        {canUse && (
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="game-ride-type-label">{t('gameRides.typeLabel')}</InputLabel>
                <Select
                  labelId="game-ride-type-label"
                  value={type}
                  label={t('gameRides.typeLabel')}
                  onChange={(event) => setType(event.target.value as GameRideType)}
                  disabled={saving || cancelling}
                >
                  <MenuItem value="OFFER">{t('gameRides.types.OFFER')}</MenuItem>
                  <MenuItem value="REQUEST">{t('gameRides.types.REQUEST')}</MenuItem>
                </Select>
              </FormControl>
              {type === 'OFFER' && (
                <TextField
                  type="number"
                  size="small"
                  label={t('gameRides.seatsLabel')}
                  value={seats}
                  onChange={(event) => setSeats(Number(event.target.value))}
                  inputProps={{ min: 1, max: 8 }}
                  disabled={saving || cancelling}
                  sx={{ minWidth: { sm: 140 } }}
                />
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label={t('gameRides.originLabel')}
                placeholder={t('gameRides.originPlaceholder')}
                value={originLabel}
                onChange={(event) => setOriginLabel(event.target.value)}
                inputProps={{ maxLength: 120 }}
                disabled={saving || cancelling}
              />
              <TextField
                fullWidth
                size="small"
                label={t('gameRides.destinationLabel')}
                value={destinationLabel}
                onChange={(event) => setDestinationLabel(event.target.value)}
                inputProps={{ maxLength: 120 }}
                disabled={saving || cancelling}
              />
            </Stack>
            <TextField
              fullWidth
              size="small"
              label={t('gameRides.noteLabel')}
              placeholder={t('gameRides.notePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              inputProps={{ maxLength: 180 }}
              helperText={t('common.charCount', { current: note.length, max: 180 })}
              disabled={saving || cancelling}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <NearMeIcon />}
                onClick={handleSave}
                disabled={saving || cancelling || originLabel.trim().length < 2 || destinationLabel.trim().length < 2}
              >
                {saving ? t('common.saving') : t(currentUserRide ? 'gameRides.update' : 'gameRides.publish')}
              </Button>
              {currentUserRide && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleCancel}
                  disabled={saving || cancelling}
                  startIcon={cancelling ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {cancelling ? t('gameRides.cancelling') : t('gameRides.cancelRide')}
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={refetch}>{t('common.retry')}</Button>}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : rides.length === 0 ? (
          <EmptyState
            icon={<PersonPinCircleIcon sx={{ fontSize: 48 }} />}
            title={t('gameRides.emptyTitle')}
            description={t('gameRides.emptyDescription')}
          />
        ) : (
          <List disablePadding aria-label={t('gameRides.listAria')}>
            {rides.map((ride, index) => (
              <Box key={ride.id}>
                {index > 0 && <Divider />}
                <GameRideItem ride={ride} />
              </Box>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
