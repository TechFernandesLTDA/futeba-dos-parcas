import React from 'react';
import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PixKeyType, PIX_KEY_TYPE_LABELS } from '../../../types/game';
import { Field } from '../../../types/location';
import {
  currencyFormatter,
  FieldPricingSummary,
  GameFormData,
  NumericField,
} from './createGameTypes';

export interface CreatePaymentSectionProps {
  formData: GameFormData;
  formErrors: Record<string, string>;
  numericDrafts: Record<NumericField, string>;
  activeNumericFieldRef: React.MutableRefObject<NumericField | null>;
  handleInputChange: (field: string, val: unknown) => void;
  handleNumericDraftChange: (field: NumericField, raw: string, parser: (v: string) => number | null) => void;
  parseCurrencyDraft: (v: string) => number | null;
  selectedField?: Field;
  selectedFieldPricing: FieldPricingSummary | null;
}

export const CreatePaymentSection: React.FC<CreatePaymentSectionProps> = ({
  formData,
  formErrors,
  numericDrafts,
  activeNumericFieldRef,
  handleInputChange,
  handleNumericDraftChange,
  parseCurrencyDraft,
  selectedField,
  selectedFieldPricing,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Preço total do aluguel"
        type="number"
        value={numericDrafts.totalCost}
        onFocus={() => { activeNumericFieldRef.current = 'totalCost'; }}
        onBlur={() => {
          activeNumericFieldRef.current = null;
          if (numericDrafts.totalCost.trim() === '') {
            handleNumericDraftChange('totalCost', '', parseCurrencyDraft);
          }
        }}
        onChange={(e) => handleNumericDraftChange('totalCost', e.target.value, parseCurrencyDraft)}
        error={!!formErrors.totalCost}
        helperText={formErrors.totalCost || t('games.create.totalCostHelp')}
        fullWidth
        placeholder="180,00"
        InputProps={{
          startAdornment: <InputAdornment position="start">R$</InputAdornment>,
        }}
        inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
      />

      {selectedField && selectedFieldPricing && (
        <Alert severity="info" icon={false}>
          {selectedField.name}: {currencyFormatter.format(selectedFieldPricing.hourlyPrice)}/h x {selectedFieldPricing.durationLabel}
          {' = '}
          <strong>{currencyFormatter.format(selectedFieldPricing.totalCost)}</strong>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Preço por jogador"
          type="number"
          value={numericDrafts.dailyPrice}
          onFocus={() => { activeNumericFieldRef.current = 'dailyPrice'; }}
          onBlur={() => {
            activeNumericFieldRef.current = null;
            if (numericDrafts.dailyPrice.trim() === '') {
              handleNumericDraftChange('dailyPrice', '', parseCurrencyDraft);
            }
          }}
          onChange={(e) => handleNumericDraftChange('dailyPrice', e.target.value, parseCurrencyDraft)}
          fullWidth
          disabled={!formData.priceManualOverride}
          error={!!formErrors.dailyPrice}
          helperText={formErrors.dailyPrice || t('games.create.dailyPriceHelp')}
          placeholder="15,00"
          InputProps={{
            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            endAdornment: formData.totalCost > 0 && formData.maxPlayers > 0 && (
              <InputAdornment position="end">
                <Typography variant="caption" color="text.secondary">
                  /{formData.maxPlayers} jogadores
                </Typography>
              </InputAdornment>
            ),
          }}
          inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.priceManualOverride}
              onChange={(e) => handleInputChange('priceManualOverride', e.target.checked)}
              size="small"
            />
          }
          label="Manual"
          sx={{ mt: 1, whiteSpace: 'nowrap' }}
        />
      </Box>

      {formData.totalCost > 0 && formData.maxPlayers > 0 && !formData.priceManualOverride && (
        <Alert severity="info" icon={false}>
          {currencyFormatter.format(formData.totalCost)} ÷ {formData.maxPlayers} jogadores = <strong>{currencyFormatter.format(formData.dailyPrice)}</strong> por pessoa
        </Alert>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={formData.pixPaymentEnabled}
            onChange={(e) => handleInputChange('pixPaymentEnabled', e.target.checked)}
          />
        }
        label={t('games.create.acceptPix')}
      />

      {formData.pixPaymentEnabled && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
          <TextField
            select
            label={t('games.create.pixKeyType')}
            value={formData.pixKeyType}
            onChange={(e) => handleInputChange('pixKeyType', e.target.value as PixKeyType)}
            fullWidth
          >
            {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('games.create.pixKey')}
            value={formData.pixKey}
            onChange={(e) => handleInputChange('pixKey', e.target.value)}
            error={!!formErrors.pixKey}
            helperText={formErrors.pixKey}
            fullWidth
            required
            inputProps={{ maxLength: 200 }}
          />
          <TextField
            label={t('games.create.pixBeneficiaryName')}
            value={formData.pixBeneficiaryName}
            onChange={(e) => handleInputChange('pixBeneficiaryName', e.target.value)}
            error={!!formErrors.pixBeneficiaryName}
            helperText={formErrors.pixBeneficiaryName}
            fullWidth
            required
            inputProps={{ maxLength: 100 }}
          />
        </Box>
      )}
    </Box>
  );
};
