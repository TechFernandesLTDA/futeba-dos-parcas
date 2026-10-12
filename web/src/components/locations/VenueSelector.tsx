import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import { EditLocationAlt as EditLocationAltIcon, Place as PlaceIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Location } from '../../types/location';
import { CitySource, CityRef, formatCityLabel } from '../../utils/venueCity';
import { isVenueUnverified } from '../../utils/venueSelector';
import { CityPickerDialog } from './CityPickerDialog';

type VenueGroup = 'recent' | 'city' | 'other' | 'custom';

type VenueOption =
  | { kind: 'venue'; venue: Location; group: VenueGroup }
  | { kind: 'custom'; group: 'custom' }
  | { kind: 'empty'; group: 'city' };

const CUSTOM_OPTION: VenueOption = { kind: 'custom', group: 'custom' };

const SOURCE_KEYS: Record<CitySource, string> = {
  geolocation: 'sourceGeolocation',
  profile: 'sourceProfile',
  saved: 'sourceSaved',
  manual: 'sourceManual',
};

export interface VenueSelectorProps {
  label: string;
  /** Cidade atual e de onde ela veio. */
  city: CityRef | null;
  citySource: CitySource | null;
  resolvingCity: boolean;
  onChangeCity: (city: CityRef) => void;
  /** Quadras da cidade (ordenadas) e, se a busca não achou nada nela, de outras cidades. */
  inCity: readonly Location[];
  otherCities: readonly Location[];
  /** Quadras das últimas utilizações (para agrupar no topo). */
  recentIds: readonly string[];
  loading: boolean;
  loadingOtherCities: boolean;
  onSearchQueryChange: (query: string) => void;
  selectedVenue: Location | null;
  customSelected: boolean;
  customLabel: string;
  onSelectVenue: (venue: Location) => void;
  onSelectCustom: () => void;
  onClear: () => void;
  error?: boolean;
  helperText?: string;
}

/**
 * Seletor de quadras (#4370): cidade atual com "Trocar cidade", busca
 * inteligente e lista com as últimas utilizações no topo.
 */
export const VenueSelector: React.FC<VenueSelectorProps> = ({
  label,
  city,
  citySource,
  resolvingCity,
  onChangeCity,
  inCity,
  otherCities,
  recentIds,
  loading,
  loadingOtherCities,
  onSearchQueryChange,
  selectedVenue,
  customSelected,
  customLabel,
  onSelectVenue,
  onSelectCustom,
  onClear,
  error,
  helperText,
}) => {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const options = useMemo<VenueOption[]>(() => {
    const recent = new Set(recentIds);
    const venues: VenueOption[] = [
      ...inCity.map((venue): VenueOption => ({
        kind: 'venue', venue, group: recent.has(venue.id) ? 'recent' : 'city',
      })),
      ...otherCities.map((venue): VenueOption => ({ kind: 'venue', venue, group: 'other' })),
    ];
    if (venues.length === 0 && !loading && !loadingOtherCities && !resolvingCity) {
      venues.push({ kind: 'empty', group: 'city' });
    }
    return [...venues, CUSTOM_OPTION];
  }, [inCity, otherCities, recentIds, loading, loadingOtherCities, resolvingCity]);

  const selectedOption: VenueOption | null = customSelected
    ? CUSTOM_OPTION
    : selectedVenue
      ? { kind: 'venue', venue: selectedVenue, group: 'city' }
      : null;

  const groupLabel = (group: string) => {
    switch (group) {
      case 'recent': return t('games.create.venueSelector.groupRecent');
      case 'other': return t('games.create.venueSelector.groupOther');
      case 'city': return city
        ? t('games.create.venueSelector.groupCity', { city: formatCityLabel(city) })
        : '';
      default: return '';
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          icon={<PlaceIcon />}
          color={city ? 'primary' : 'default'}
          variant="outlined"
          label={
            city
              ? t('games.create.venueSelector.currentCity', { city: formatCityLabel(city) })
              : resolvingCity
                ? t('games.create.venueSelector.detecting')
                : t('games.create.venueSelector.cityUnknown')
          }
          sx={{ maxWidth: '100%' }}
        />
        {city && citySource && (
          <Typography variant="caption" color="text.secondary">
            {t(`games.create.venueSelector.${SOURCE_KEYS[citySource]}`)}
          </Typography>
        )}
        <Button
          size="small"
          startIcon={<EditLocationAltIcon />}
          onClick={() => setPickerOpen(true)}
          sx={{ minHeight: 44, ml: { sm: 'auto' } }}
        >
          {t('games.create.venueSelector.changeCity')}
        </Button>
      </Box>

      <Autocomplete<VenueOption, false, false, false>
        options={options}
        value={selectedOption}
        onChange={(_event, option) => {
          if (!option) {
            onClear();
          } else if (option.kind === 'custom') {
            onSelectCustom();
          } else if (option.kind === 'venue') {
            onSelectVenue(option.venue);
          }
        }}
        onInputChange={(_event, value, reason) => {
          onSearchQueryChange(reason === 'input' ? value : '');
        }}
        filterOptions={(all) => all}
        getOptionLabel={(option) => {
          if (option.kind === 'custom') return customLabel;
          if (option.kind === 'empty') return '';
          return option.venue.name;
        }}
        isOptionEqualToValue={(option, value) =>
          option.kind === value.kind &&
          (option.kind !== 'venue' || value.kind !== 'venue' || option.venue.id === value.venue.id)}
        getOptionDisabled={(option) => option.kind === 'empty'}
        groupBy={(option) => option.group}
        renderGroup={(params) => (
          <li key={params.key}>
            {groupLabel(params.group) && (
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', px: 2, pt: 1, lineHeight: 1.8 }}
              >
                {groupLabel(params.group)}
              </Typography>
            )}
            <ul style={{ padding: 0 }}>{params.children}</ul>
          </li>
        )}
        renderOption={(props, option) => {
          if (option.kind === 'empty') {
            return (
              <li {...props} key="empty">
                <Typography variant="body2" color="text.secondary">
                  {t('games.create.venueSelector.empty')}
                </Typography>
              </li>
            );
          }
          if (option.kind === 'custom') {
            return (
              <li {...props} key="custom" style={{ minHeight: 48 }}>
                {customLabel}
              </li>
            );
          }
          const { venue } = option;
          const area = venue.neighborhood || venue.district || '';
          const place = option.group === 'other'
            ? formatCityLabel({ city: venue.city, state: venue.state })
            : [area, venue.street || venue.address].filter(Boolean).join(' · ');
          return (
            <li {...props} key={venue.id} style={{ minHeight: 48 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {venue.name}
                  </Typography>
                  {isVenueUnverified(venue) && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={t('games.create.venueSelector.unverified')}
                    />
                  )}
                </Box>
                {place && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                    {place}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required
            error={error}
            helperText={helperText}
            placeholder={t('games.create.venueSelector.searchHint')}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {(loading || loadingOtherCities || resolvingCity) && <CircularProgress color="inherit" size={18} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        ListboxProps={{ style: { maxHeight: 360 } }}
        fullWidth
      />

      <CityPickerDialog
        open={pickerOpen}
        current={city}
        onClose={() => setPickerOpen(false)}
        onSelect={onChangeCity}
      />
    </Box>
  );
};
