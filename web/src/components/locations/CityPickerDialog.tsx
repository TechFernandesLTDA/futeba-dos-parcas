import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useStateCities } from '../../hooks/useVenueSelector';
import { BRAZIL_STATES } from '../../utils/brazilStates';
import { CityRef, formatCityLabel, isSameCity } from '../../utils/venueCity';
import { matchesVenueQuery } from '../../utils/venueSearch';

interface CityPickerDialogProps {
  open: boolean;
  current: CityRef | null;
  onClose: () => void;
  onSelect: (city: CityRef) => void;
}

/** "Trocar cidade": UF → cidade (com a contagem de quadras de cada cidade). */
export const CityPickerDialog: React.FC<CityPickerDialogProps> = ({ open, current, onClose, onSelect }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [uf, setUf] = useState(current?.state ?? '');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (open) {
      setUf(current?.state ?? '');
      setFilter('');
    }
  }, [open, current?.state]);

  const { cities, loading, error } = useStateCities(uf, open);
  const visibleCities = useMemo(
    () => cities.filter((city) => matchesVenueQuery([city.city], filter)),
    [cities, filter],
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="xs" aria-labelledby="city-picker-title">
      <DialogTitle id="city-picker-title" sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Box component="span" sx={{ flex: 1 }}>{t('games.create.venueSelector.changeCityTitle')}</Box>
        <IconButton onClick={onClose} aria-label={t('games.create.venueSelector.close')} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          select
          size="small"
          label={t('games.create.venueSelector.state')}
          value={uf}
          onChange={(event) => {
            setUf(event.target.value);
            setFilter('');
          }}
          fullWidth
        >
          {BRAZIL_STATES.map((state) => (
            <MenuItem key={state.uf} value={state.uf} sx={{ minHeight: 44 }}>
              {state.uf} — {state.name}
            </MenuItem>
          ))}
        </TextField>

        {uf && (
          <TextField
            size="small"
            label={t('games.create.venueSelector.citySearch')}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            }}
          />
        )}

        {!uf && (
          <Typography variant="body2" color="text.secondary">
            {t('games.create.venueSelector.pickState')}
          </Typography>
        )}
        {uf && loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
        )}
        {uf && error && <Alert severity="error">{error}</Alert>}
        {uf && !loading && !error && visibleCities.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('games.create.venueSelector.noCities')}
          </Typography>
        )}
        {visibleCities.length > 0 && (
          <List dense disablePadding aria-label={t('games.create.venueSelector.changeCityTitle')}>
            {visibleCities.map((city) => (
              <ListItemButton
                key={`${city.state}-${city.city}`}
                selected={isSameCity(city, current)}
                onClick={() => {
                  onSelect({ city: city.city, state: city.state });
                  onClose();
                }}
                sx={{ minHeight: 48 }}
              >
                <ListItemText
                  primary={city.city}
                  secondary={t('games.create.venueSelector.venuesCount', { count: city.count })}
                />
              </ListItemButton>
            ))}
          </List>
        )}
        {current && (
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            {t('games.create.venueSelector.keepCity', { city: formatCityLabel(current) })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
