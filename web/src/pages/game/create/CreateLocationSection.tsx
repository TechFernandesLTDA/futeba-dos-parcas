import React from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddLocation as AddLocationIcon,
  History as HistoryIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { VenueSelector } from '../../../components/locations/VenueSelector';
import type { useVenueSelector } from '../../../hooks/useVenueSelector';
import { FieldType } from '../../../types/game';
import { FIELD_TYPE_LABELS } from '../../../types/game';
import { Field, Location as FutebaLocation } from '../../../types/location';
import { currencyFormatter, GameFormData } from './createGameTypes';

export interface CreateLocationSectionProps {
  formData: GameFormData;
  formErrors: Record<string, string>;
  selectedEligibleGroup?: { id: string; name: string };
  eligibleOwnedGroups: Array<{ id: string; name: string; memberCount?: number }>;
  hasAnyOwnedGroup: boolean;
  groupsLoading: boolean;
  groupId: string | null;
  useCustomLocation: boolean;
  setUseCustomLocation: (val: boolean) => void;
  setFormData: React.Dispatch<React.SetStateAction<GameFormData>>;
  handleInputChange: (field: string, value: unknown) => void;
  favoriteIds: string[];
  recentIds: string[];
  localRecentIds: string[];
  locations: FutebaLocation[];
  locationsLoading: boolean;
  locationsError: string | null;
  selectCatalogLocation: (loc: FutebaLocation) => void;
  venueSelector: ReturnType<typeof useVenueSelector>;
  usedLocationIds: string[];
  setVenueQuery: (q: string) => void;
  selectedLocation?: FutebaLocation;
  setQuickLocationOpen: (open: boolean) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => boolean;
  showSuccess: (msg: string) => void;
  cep: string;
  cepError: string | null;
  cepLoading: boolean;
  handleCepChange: (val: string) => void;
  fieldsLoading: boolean;
  fieldsError: string | null;
  fields: Field[];
  calculateFieldRentalCost: (hourlyPrice: number | undefined | null, startTime: string, endTime?: string) => number;
  calculatePerPlayerPrice: (totalCost: number, maxPlayers: number) => number;
  normalizeHourlyPriceForGame: (hourlyPrice?: number | null) => number;
}

export const CreateLocationSection: React.FC<CreateLocationSectionProps> = ({
  formData,
  formErrors,
  selectedEligibleGroup,
  eligibleOwnedGroups,
  hasAnyOwnedGroup,
  groupsLoading,
  groupId,
  useCustomLocation,
  setUseCustomLocation,
  setFormData,
  handleInputChange,
  favoriteIds,
  recentIds,
  localRecentIds,
  locations,
  locationsLoading,
  locationsError,
  selectCatalogLocation,
  venueSelector,
  usedLocationIds,
  setVenueQuery,
  selectedLocation,
  setQuickLocationOpen,
  isFavorite,
  toggleFavorite,
  showSuccess,
  cep,
  cepError,
  cepLoading,
  handleCepChange,
  fieldsLoading,
  fieldsError,
  fields,
  calculateFieldRentalCost,
  calculatePerPlayerPrice,
  normalizeHourlyPriceForGame,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {selectedEligibleGroup && (
        <Alert severity="info">
          {t('games.create.creatingForGroup')} <strong>{selectedEligibleGroup.name}</strong>
        </Alert>
      )}

      {!groupsLoading && eligibleOwnedGroups.length === 0 && (
        <Alert severity="warning">
          {hasAnyOwnedGroup ? t('games.create.noQualifiedGroups') : t('games.create.noOwnedGroups')}
        </Alert>
      )}

      {groupId && formData.groupId && !groupsLoading && !selectedEligibleGroup && (
        <Alert severity="error">
          {t('games.create.currentGroupNotQualified')}
        </Alert>
      )}

      {!groupId && (
        <TextField
          select
          label={t('games.create.group')}
          value={formData.groupId || ''}
          onChange={(e) => {
            const selectedGroup = eligibleOwnedGroups.find((g) => g.id === e.target.value);
            setFormData((prev) => ({
              ...prev,
              groupId: selectedGroup?.id,
              groupName: selectedGroup?.name,
              visibility: selectedGroup ? 'PUBLIC_OPEN' : prev.visibility,
            }));
          }}
          disabled={groupsLoading || eligibleOwnedGroups.length === 0}
          error={!!formErrors.groupId}
          helperText={
            formErrors.groupId ||
            (groupsLoading ? t('games.create.loadingGroups') : t('games.create.selectQualifiedGroupRequired'))
          }
          fullWidth
        >
          {eligibleOwnedGroups.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name} ({t('games.create.membersCount', { count: g.memberCount ?? 0 })})
            </MenuItem>
          ))}
        </TextField>
      )}

      {/* Quick-pick: Favoritos e Recentes */}
      {!useCustomLocation && (favoriteIds.length > 0 || recentIds.length > 0) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {favoriteIds.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                ⭐
              </Typography>
              {favoriteIds.map((id) => {
                const loc = (locations || []).find((l) => l.id === id);
                if (!loc) return null;
                return (
                  <Chip
                    key={id}
                    size="small"
                    icon={<StarIcon sx={{ fontSize: 14 }} />}
                    label={loc.name}
                    color="warning"
                    variant="outlined"
                    onClick={() => selectCatalogLocation(loc)}
                  />
                );
              })}
            </Box>
          )}
          {(localRecentIds.length > 0 || recentIds.length > 0) && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <HistoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              {(() => {
                const merged = [...new Set([...localRecentIds, ...recentIds])];
                return merged.filter((id) => !favoriteIds.includes(id)).slice(0, 5).map((id) => {
                  const loc = (locations || []).find((l) => l.id === id);
                  if (!loc) return null;
                  return (
                    <Chip
                      key={id}
                      size="small"
                      label={loc.name}
                      variant="outlined"
                      onClick={() => selectCatalogLocation(loc)}
                    />
                  );
                });
              })()}
            </Box>
          )}
        </Box>
      )}

      {/* Seletor de localização */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <VenueSelector
          label={t('games.create.fieldOrLocation')}
          city={venueSelector.city}
          citySource={venueSelector.citySource}
          resolvingCity={venueSelector.resolvingCity}
          onChangeCity={venueSelector.changeCity}
          inCity={venueSelector.inCity}
          otherCities={venueSelector.otherCities}
          recentIds={usedLocationIds}
          loading={venueSelector.loading}
          loadingOtherCities={venueSelector.loadingOtherCities}
          onSearchQueryChange={setVenueQuery}
          selectedVenue={useCustomLocation ? null : (selectedLocation ?? null)}
          customSelected={useCustomLocation}
          customLabel={t('games.create.otherLocation')}
          onSelectVenue={selectCatalogLocation}
          onSelectCustom={() => {
            setUseCustomLocation(true);
            setFormData((prev) => ({
              ...prev,
              locationId: '',
              locationName: '',
              locationAddress: '',
              locationLat: undefined,
              locationLng: undefined,
              fieldId: '',
              fieldName: '',
            }));
          }}
          onClear={() => {
            setUseCustomLocation(false);
            setFormData((prev) => ({
              ...prev,
              locationId: '',
              locationName: '',
              locationAddress: '',
              locationLat: undefined,
              locationLng: undefined,
              fieldId: '',
              fieldName: '',
            }));
          }}
          error={!!formErrors.locationName}
          helperText={formErrors.locationName || (locationsLoading
            ? t('games.create.loadingFields')
            : venueSelector.city
              ? t('games.create.venueSelector.countInCity', {
                count: venueSelector.cityVenues.length,
                city: venueSelector.city.city,
              })
              : t('games.create.venueSelector.cityUnknown'))}
        />
        <IconButton
          onClick={() => setQuickLocationOpen(true)}
          sx={{ mt: 0.5 }}
          size="small"
          color="primary"
          aria-label={t('a11y.createNewLocation')}
        >
          <AddLocationIcon />
        </IconButton>
        {formData.locationId && !useCustomLocation && (
          <Tooltip
            title={isFavorite(formData.locationId)
              ? t('games.create.removeFavorite')
              : t('games.create.addFavorite')}
          >
            <IconButton
              onClick={() => {
                const added = toggleFavorite(formData.locationId);
                showSuccess(t(added
                  ? 'games.create.favoriteAdded'
                  : 'games.create.favoriteRemoved'));
              }}
              sx={{ mt: 0.5 }}
              size="small"
              aria-label={isFavorite(formData.locationId)
                ? t('games.create.removeFavorite')
                : t('games.create.addFavorite')}
              aria-pressed={isFavorite(formData.locationId)}
            >
              {isFavorite(formData.locationId) ? (
                <StarIcon color="warning" />
              ) : (
                <StarBorderIcon />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {!useCustomLocation && !locationsLoading && !locationsError && venueSelector.city &&
        venueSelector.cityVenues.length === 0 && (
        <Alert severity="warning" icon={false}>
          {t('games.create.venueSelector.noVenuesInCity', { city: venueSelector.city.city })}
        </Alert>
      )}

      {useCustomLocation && (
        <>
          <TextField
            label="CEP"
            value={cep}
            onChange={(e) => handleCepChange(e.target.value)}
            fullWidth
            placeholder="00000000"
            error={!!cepError}
            helperText={cepError || (cepLoading ? 'Buscando endereço...' : 'Digite o CEP para preencher automaticamente')}
            InputProps={{
              endAdornment: cepLoading ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : undefined,
            }}
            inputProps={{ inputMode: 'numeric', maxLength: 8 }}
          />
          <TextField
            label={t('games.create.locationName')}
            value={formData.locationName}
            onChange={(e) => handleInputChange('locationName', e.target.value)}
            error={!!formErrors.locationName}
            helperText={formErrors.locationName}
            fullWidth
            required
            placeholder={t('games.create.locationNamePlaceholder')}
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            label={t('games.create.fullAddress')}
            value={formData.locationAddress}
            onChange={(e) => handleInputChange('locationAddress', e.target.value)}
            error={!!formErrors.locationAddress}
            helperText={formErrors.locationAddress}
            fullWidth
            required
            placeholder={t('games.create.fullAddressPlaceholder')}
            inputProps={{ maxLength: 500 }}
          />
        </>
      )}

      {!useCustomLocation && formData.locationId && (
        fieldsLoading ? (
          <Alert severity="info" icon={false}>
            {t('games.create.loadingFields')}
          </Alert>
        ) : fieldsError ? (
          <Alert severity="error" icon={false}>
            {fieldsError}
          </Alert>
        ) : fields.length > 0 ? (
          <TextField
            select
            label={t('games.create.field')}
            value={formData.fieldId}
            onChange={(e) => {
              const field = fields.find((f) => f.id === e.target.value);
              if (field) {
                const totalCost = calculateFieldRentalCost(field.hourlyPrice, formData.time, formData.endTime);
                setFormData((prev) => ({
                  ...prev,
                  fieldId: field.id,
                  fieldName: field.name,
                  fieldType: (field.type as FieldType) || prev.fieldType,
                  gameType: (field.type as string) || prev.gameType,
                  totalCost: totalCost || prev.totalCost,
                  dailyPrice: prev.priceManualOverride
                    ? prev.dailyPrice
                    : calculatePerPlayerPrice(totalCost || prev.totalCost, prev.maxPlayers),
                }));
              }
            }}
            error={!!formErrors.fieldId}
            helperText={formErrors.fieldId || t('games.create.fieldsAtLocation', { count: fields.length })}
            fullWidth
            required
          >
            {fields.map((f) => (
              <MenuItem key={f.id} value={f.id}>
                {f.name} — {FIELD_TYPE_LABELS[f.type as FieldType] || f.type}
                {normalizeHourlyPriceForGame(f.hourlyPrice)
                  ? ` (${currencyFormatter.format(normalizeHourlyPriceForGame(f.hourlyPrice))}/h)`
                  : ''}
                {f.isCovered ? ` · ${t('games.create.covered')}` : ''}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Alert severity="warning" icon={false}>
            {t('games.create.noActiveFieldsAtLocation')}
          </Alert>
        )
      )}

      {!useCustomLocation && formData.locationName && (
        <Alert severity="success" icon={false}>
          📍 <strong>{formData.locationName}</strong>
          {formData.fieldName && <> — {formData.fieldName}</>}
          <br />
          {formData.locationAddress}
        </Alert>
      )}
    </Box>
  );
};
