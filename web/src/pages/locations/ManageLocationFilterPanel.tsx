import React from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  AMENITY_LABELS,
  COMMERCIAL_AMENITIES,
  FIELD_TYPE_CONFIG,
  LOCATION_PUBLICATION_STATUS_LABELS,
  LOCATION_SUBSCRIPTION_STATUS_LABELS,
  LocationPublicationStatus,
  LocationSubscriptionStatus,
} from '../../types/location';
import {
  LocationBooleanFilter,
  LocationDueFilter,
  LocationMonthlyFeeFilter,
  MANAGE_QUICK_FILTERS,
} from './manageLocationFilters';
import { FacetOption, GeoFacets } from './manageLocationFacets';
import { ManageLocationQueryState } from './manageLocationUrlState';

interface FilterPanelProps {
  filters: ManageLocationQueryState;
  facets: GeoFacets;
  onChange: (patch: Partial<ManageLocationQueryState>) => void;
  /** Controles extras do admin (ex.: período financeiro). */
  extraControls?: React.ReactNode;
}

const touchTarget = { '& .MuiInputBase-root': { minHeight: 44 } };

interface FacetFieldProps {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  emptyHint?: string;
}

const FacetField: React.FC<FacetFieldProps> = ({ label, options, selected, onChange, emptyHint }) => {
  const { t } = useTranslation();
  const selectedKeys = new Set(selected.map((value) => value.toLowerCase()));
  const value = options.filter((option) => selectedKeys.has(option.value.toLowerCase()));
  return (
    <Autocomplete<FacetOption, true, false, false>
      multiple
      disableCloseOnSelect
      size="small"
      options={options}
      value={value}
      limitTags={2}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, current) => option.value === current.value}
      onChange={(_event, next) => onChange(next.map((option) => option.value))}
      noOptionsText={emptyHint ?? t('locations.manageFilters.noOptions')}
      renderOption={(props, option) => (
        <li {...props} key={option.value} style={{ minHeight: 44 }}>
          <Box sx={{ display: 'flex', width: '100%', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{option.label}</Typography>
            <Typography variant="caption" color="text.secondary">{option.count}</Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} sx={touchTarget} />}
    />
  );
};

/**
 * Conteúdo dos filtros do admin (#4372): atalhos, Estado → Cidade → Bairro com
 * contagens e os filtros que já existiam. Serve ao painel lateral do desktop e
 * ao bottom sheet do mobile.
 */
export const ManageLocationFilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  facets,
  onChange,
  extraControls,
}) => {
  const { t } = useTranslation();

  const booleanOptions = (allLabel: string, yes?: string, no?: string) => [
    <MenuItem key="ALL" value="ALL">{allLabel}</MenuItem>,
    <MenuItem key="YES" value="YES">{yes ?? t('locations.manageFilters.yes')}</MenuItem>,
    <MenuItem key="NO" value="NO">{no ?? t('locations.manageFilters.no')}</MenuItem>,
  ];

  const toggleAmenity = (amenity: string) =>
    onChange({
      amenityFilters: filters.amenityFilters.includes(amenity)
        ? filters.amenityFilters.filter((item) => item !== amenity)
        : [...filters.amenityFilters, amenity],
    });

  const toggleQuick = (quick: (typeof MANAGE_QUICK_FILTERS)[number]) =>
    onChange({
      quickFilters: filters.quickFilters.includes(quick)
        ? filters.quickFilters.filter((item) => item !== quick)
        : [...filters.quickFilters, quick],
    });

  return (
    <Stack spacing={2} sx={{ '& .MuiTextField-root': { width: '100%' } }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('locations.manageFilters.quickTitle')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {MANAGE_QUICK_FILTERS.map((quick) => {
            const active = filters.quickFilters.includes(quick);
            return (
              <Chip
                key={quick}
                label={t(`locations.manageFilters.quick.${quick}`)}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                onClick={() => toggleQuick(quick)}
                aria-pressed={active}
                sx={{ minHeight: 44, borderRadius: 22 }}
              />
            );
          })}
        </Box>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('locations.manageFilters.geoTitle')}
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <FacetField
            label={t('locations.manageFilters.state')}
            options={facets.states}
            selected={filters.stateFilters}
            onChange={(stateFilters) => onChange({ stateFilters })}
          />
          <FacetField
            label={t('locations.manageFilters.city')}
            options={facets.cities}
            selected={filters.cityFilters}
            onChange={(cityFilters) => onChange({ cityFilters })}
          />
          <FacetField
            label={t('locations.manageFilters.neighborhood')}
            options={facets.neighborhoods}
            selected={filters.neighborhoodFilters}
            onChange={(neighborhoodFilters) => onChange({ neighborhoodFilters })}
            emptyHint={filters.cityFilters.length === 0 && filters.stateFilters.length === 0
              ? undefined
              : t('locations.manageFilters.noOptions')}
          />
        </Stack>
      </Box>

      <Stack spacing={1.5} sx={touchTarget}>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.publication')}
          value={filters.publicationFilter}
          onChange={(e) => onChange({ publicationFilter: e.target.value as 'ALL' | LocationPublicationStatus })}
        >
          <MenuItem value="ALL">{t('locations.manageFilters.all')}</MenuItem>
          {Object.entries(LOCATION_PUBLICATION_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.verified')}
          value={filters.verifiedFilter}
          onChange={(e) => onChange({ verifiedFilter: e.target.value as LocationBooleanFilter })}
        >
          {booleanOptions(t('locations.manageFilters.all'))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.active')}
          value={filters.activeFilter}
          onChange={(e) => onChange({ activeFilter: e.target.value as LocationBooleanFilter })}
        >
          {booleanOptions(t('locations.manageFilters.all'))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.activeFields')}
          value={filters.activeFieldsFilter}
          onChange={(e) => onChange({ activeFieldsFilter: e.target.value as LocationBooleanFilter })}
        >
          {booleanOptions(
            t('locations.manageFilters.all'),
            t('locations.manageFilters.withActiveFields'),
            t('locations.manageFilters.withoutActiveFields'),
          )}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.subscription')}
          value={filters.subscriptionFilter}
          onChange={(e) => onChange({ subscriptionFilter: e.target.value as 'ALL' | LocationSubscriptionStatus })}
        >
          <MenuItem value="ALL">{t('locations.manageFilters.all')}</MenuItem>
          {Object.entries(LOCATION_SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.type')}
          value={filters.typeFilter}
          onChange={(e) => onChange({ typeFilter: e.target.value })}
        >
          <MenuItem value="ALL">{t('locations.manageFilters.allMasc')}</MenuItem>
          {Object.entries(FIELD_TYPE_CONFIG).map(([value, config]) => (
            <MenuItem key={value} value={value}>{config.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.dueDay')}
          value={filters.dueFilter}
          onChange={(e) => onChange({ dueFilter: e.target.value as LocationDueFilter })}
        >
          <MenuItem value="ALL">{t('locations.manageFilters.allMasc')}</MenuItem>
          {(['1_7', '8_14', '15_21', '22_28', 'NO_DUE'] as const).map((value) => (
            <MenuItem key={value} value={value}>{t(`locations.manageFilters.due.${value}`)}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('locations.manageFilters.monthlyFee')}
          value={filters.monthlyFeeFilter}
          onChange={(e) => onChange({ monthlyFeeFilter: e.target.value as LocationMonthlyFeeFilter })}
        >
          <MenuItem value="ALL">{t('locations.manageFilters.all')}</MenuItem>
          {(['NO_FEE', 'UP_TO_100', '100_300', '300_PLUS'] as const).map((value) => (
            <MenuItem key={value} value={value}>{t(`locations.manageFilters.fee.${value}`)}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label={t('locations.manageFilters.owner')}
          value={filters.ownerFilter}
          onChange={(e) => onChange({ ownerFilter: e.target.value })}
          placeholder={t('locations.manageFilters.ownerPlaceholder')}
        />
        {extraControls}
      </Stack>

      <Box>
        <Typography variant="overline" color="text.secondary">
          {t('locations.manageFilters.amenities')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {COMMERCIAL_AMENITIES.map((amenity) => {
            const active = filters.amenityFilters.includes(amenity);
            return (
              <Chip
                key={amenity}
                label={AMENITY_LABELS[amenity] || amenity}
                size="small"
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                onClick={() => toggleAmenity(amenity)}
                aria-pressed={active}
                sx={{ minHeight: { xs: 44, md: 32 } }}
              />
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
};
