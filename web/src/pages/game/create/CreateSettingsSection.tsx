import React from 'react';
import {
  Box,
  Card,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  FieldType,
  GameGender,
  GameVisibility,
  GAME_GENDER_LABELS,
  FIELD_TYPE_LABELS,
} from '../../../types/game';
import { GAME_VALIDATION } from '../../../utils/validationConstants';
import {
  GameFormData,
  NumericField,
  RECURRENCE_HARD_CAP,
} from './createGameTypes';

export interface CreateSettingsSectionProps {
  formData: GameFormData;
  formErrors: Record<string, string>;
  numericDrafts: Record<NumericField, string>;
  activeNumericFieldRef: React.MutableRefObject<NumericField | null>;
  handleInputChange: (field: string, val: unknown) => void;
  handleNumericDraftChange: (field: NumericField, raw: string, parser: (v: string) => number | null) => void;
  handleNumericDraftBlur: (field: NumericField) => void;
  parseIntegerDraft: (v: string) => number | null;
}

export const CreateSettingsSection: React.FC<CreateSettingsSectionProps> = ({
  formData,
  formErrors,
  numericDrafts,
  activeNumericFieldRef,
  handleInputChange,
  handleNumericDraftChange,
  handleNumericDraftBlur,
  parseIntegerDraft,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        select
        label={t('games.create.fieldTypeLabel')}
        value={formData.fieldType}
        onChange={(e) => { handleInputChange('fieldType', e.target.value as FieldType); }}
        fullWidth
      >
        {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label={t('games.create.gender')}
        value={formData.gender}
        onChange={(e) => { handleInputChange('gender', e.target.value as GameGender); }}
        fullWidth
      >
        {(Object.entries(GAME_GENDER_LABELS) as [GameGender, string][]).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          label={t('games.create.maxPlayers')}
          type="number"
          value={numericDrafts.maxPlayers}
          onFocus={() => { activeNumericFieldRef.current = 'maxPlayers'; }}
          onBlur={() => handleNumericDraftBlur('maxPlayers')}
          onChange={(e) => handleNumericDraftChange('maxPlayers', e.target.value, parseIntegerDraft)}
          error={!!formErrors.maxPlayers}
          helperText={formErrors.maxPlayers || t('games.create.maxPlayersHelp', {
            min: GAME_VALIDATION.MIN_PLAYERS,
            max: GAME_VALIDATION.MAX_PLAYERS,
          })}
          fullWidth
          placeholder="14"
          inputProps={{ min: GAME_VALIDATION.MIN_PLAYERS, max: GAME_VALIDATION.MAX_PLAYERS, inputMode: 'numeric' }}
        />
        <TextField
          label={t('games.create.maxGoalkeepers')}
          type="number"
          value={numericDrafts.maxGoalkeepers}
          onFocus={() => { activeNumericFieldRef.current = 'maxGoalkeepers'; }}
          onBlur={() => handleNumericDraftBlur('maxGoalkeepers')}
          onChange={(e) => handleNumericDraftChange('maxGoalkeepers', e.target.value, parseIntegerDraft)}
          error={!!formErrors.maxGoalkeepers}
          helperText={formErrors.maxGoalkeepers || t('games.create.maxGoalkeepersHelp', {
            min: GAME_VALIDATION.MIN_GOALKEEPERS,
            max: GAME_VALIDATION.MAX_GOALKEEPERS,
          })}
          fullWidth
          placeholder="2"
          inputProps={{ min: GAME_VALIDATION.MIN_GOALKEEPERS, max: GAME_VALIDATION.MAX_GOALKEEPERS, inputMode: 'numeric' }}
        />
      </Box>

      <TextField
        label={t('games.create.numberOfTeams')}
        type="number"
        value={numericDrafts.numberOfTeams}
        onFocus={() => { activeNumericFieldRef.current = 'numberOfTeams'; }}
        onBlur={() => handleNumericDraftBlur('numberOfTeams')}
        onChange={(e) => handleNumericDraftChange('numberOfTeams', e.target.value, parseIntegerDraft)}
        error={!!formErrors.numberOfTeams}
        helperText={formErrors.numberOfTeams || t('games.create.numberOfTeamsHelp', {
          min: GAME_VALIDATION.MIN_TEAMS,
          max: GAME_VALIDATION.MAX_TEAMS,
        })}
        fullWidth
        placeholder="2"
        inputProps={{ min: GAME_VALIDATION.MIN_TEAMS, max: GAME_VALIDATION.MAX_TEAMS, inputMode: 'numeric' }}
      />

      <FormControl error={!!formErrors.visibility}>
        <FormLabel>{t('games.create.visibility')}</FormLabel>
        <RadioGroup
          value={formData.visibility}
          onChange={(e) => handleInputChange('visibility', e.target.value as GameVisibility)}
        >
          <FormControlLabel value="GROUP_ONLY" control={<Radio />} label={t('games.create.visibilityGroupOnly')} />
          <FormControlLabel value="PUBLIC_CLOSED" control={<Radio />} label={t('games.create.visibilityPublicClosed')} />
          <FormControlLabel value="PUBLIC_OPEN" control={<Radio />} label={t('games.create.visibilityPublicOpen')} />
        </RadioGroup>
        {formErrors.visibility && <FormHelperText>{formErrors.visibility}</FormHelperText>}
      </FormControl>

      <Card sx={{ p: 1, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>{t('games.create.recurrence')}</Typography>
            <Typography variant="caption" color="text.secondary">{t('games.create.recurrenceDesc')}</Typography>
          </Box>
          <Switch
            checked={formData.recurrenceEnabled}
            onChange={(e) => handleInputChange('recurrenceEnabled', e.target.checked)}
          />
        </Box>
        {formData.recurrenceEnabled && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField
              select
              label={t('games.create.frequency')}
              value={formData.recurrenceType}
              onChange={(e) => handleInputChange('recurrenceType', e.target.value as 'weekly' | 'biweekly' | 'monthly')}
              fullWidth
              size="small"
            >
              <MenuItem value="weekly">{t('games.create.frequencyWeekly')}</MenuItem>
              <MenuItem value="biweekly">{t('games.create.frequencyBiweekly')}</MenuItem>
              <MenuItem value="monthly">{t('games.create.frequencyMonthly')}</MenuItem>
            </TextField>

            <FormControl>
              <FormLabel sx={{ fontSize: '0.8rem' }}>{t('games.create.recurrenceEnd')}</FormLabel>
              <RadioGroup
                value={formData.recurrenceEndMode}
                onChange={(e) => handleInputChange('recurrenceEndMode', e.target.value as 'forever' | 'count' | 'until')}
              >
                <FormControlLabel value="forever" control={<Radio size="small" />} label={t('games.create.recurrenceEndForever')} />
                <FormControlLabel value="count" control={<Radio size="small" />} label={t('games.create.recurrenceEndCount')} />
                <FormControlLabel value="until" control={<Radio size="small" />} label={t('games.create.recurrenceEndUntil')} />
              </RadioGroup>
            </FormControl>

            {formData.recurrenceEndMode === 'count' && (
              <TextField
                type="number"
                size="small"
                label={t('games.create.recurrenceCountLabel')}
                value={numericDrafts.recurrenceCount}
                onFocus={() => { activeNumericFieldRef.current = 'recurrenceCount'; }}
                onBlur={() => handleNumericDraftBlur('recurrenceCount')}
                onChange={(e) => handleNumericDraftChange('recurrenceCount', e.target.value, parseIntegerDraft)}
                error={!!formErrors.recurrenceCount}
                inputProps={{ min: 2, max: RECURRENCE_HARD_CAP, inputMode: 'numeric' }}
                placeholder="10"
                helperText={formErrors.recurrenceCount || t('games.create.recurrenceCountHelp')}
                fullWidth
              />
            )}

            {formData.recurrenceEndMode === 'until' && (
              <TextField
                type="date"
                size="small"
                label={t('games.create.recurrenceUntilLabel')}
                value={formData.recurrenceEndDate}
                onChange={(e) => handleInputChange('recurrenceEndDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: formData.date || undefined }}
                fullWidth
              />
            )}
          </Box>
        )}
      </Card>

      {formData.groupId && (
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.autoInviteMembers}
              onChange={(e) => handleInputChange('autoInviteMembers', e.target.checked)}
            />
          }
          label={t('games.create.autoInviteMembers') || 'Convidar todos os membros do grupo'}
        />
      )}
    </Box>
  );
};
