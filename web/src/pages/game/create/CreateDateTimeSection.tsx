import React from 'react';
import {
  Alert,
  Badge,
  Box,
  Card,
  CardContent,
  Chip,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { format as formatDate, isSameDay, isWeekend } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { FieldAvailabilityTimeline } from '../../../components/game/FieldAvailabilityTimeline';
import { Location as FutebaLocation } from '../../../types/location';
import { ConflictSuggestion, formatTime, GameFormData } from './createGameTypes';

export interface CreateDateTimeSectionProps {
  formData: GameFormData;
  formErrors: Record<string, string>;
  fieldGames: {
    byDate: Map<string, Array<{ startMinutes: number; endMinutes: number }>>;
    fullyBookedDates: Set<string>;
    conflictDates: Set<string>;
  };
  handleInputChange: (field: string, val: unknown) => void;
  handleStartTimeChange: (time: string) => void;
  handleTimeSlotClick: (slot: string) => void;
  conflictSuggestions: ConflictSuggestion[];
  conflictMessage: string;
  setConflictSuggestions: (s: ConflictSuggestion[]) => void;
  setConflictMessage: (m: string) => void;
  suggestedTimeChips: Array<{ time: string; source: 'habitual' | 'popular' | 'suggested'; label: string }>;
  recurrencePreview: Array<{ hasConflict?: boolean; formattedDate?: string; time?: string }>;
  selectedLocation?: FutebaLocation;
}

export const CreateDateTimeSection: React.FC<CreateDateTimeSectionProps> = ({
  formData,
  formErrors,
  fieldGames,
  handleInputChange,
  handleStartTimeChange,
  handleTimeSlotClick,
  conflictSuggestions,
  conflictMessage,
  setConflictSuggestions,
  setConflictMessage,
  suggestedTimeChips,
  recurrencePreview,
  selectedLocation,
}) => {
  const { t } = useTranslation();
  const { byDate, fullyBookedDates, conflictDates } = fieldGames;

  const CustomDay = (props: PickersDayProps<Date>) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const dateStr = formatDate(day, 'yyyy-MM-dd');
    const dayGames = byDate.get(dateStr) || [];
    const hasGames = dayGames.length > 0;
    const hasConflict = conflictDates.has(dateStr);
    const isFullyBooked = fullyBookedDates.has(dateStr);
    const isWeekendDay = isWeekend(day);
    const isToday = isSameDay(day, new Date());

    const tooltipTitle = hasGames ? (
      <Box sx={{ textAlign: 'center' }}>
        {[...dayGames].sort((a, b) => a.startMinutes - b.startMinutes).map((g, i) => (
          <Typography key={i} variant="caption" sx={{ display: 'block', lineHeight: 1.4 }}>
            {formatTime(g.startMinutes)} - {formatTime(g.endMinutes)}
          </Typography>
        ))}
      </Box>
    ) : '';

    return (
      <Tooltip title={tooltipTitle} arrow disableHoverListener={!hasGames}>
        <span>
          <Badge
            key={dateStr}
            overlap="circular"
            variant="dot"
            color={hasConflict ? 'error' : hasGames ? 'warning' : 'default'}
            invisible={!hasGames}
            sx={{
              '& .MuiBadge-dot': {
                width: 6,
                height: 6,
                minWidth: 6,
                borderRadius: '50%',
              },
            }}
          >
            <PickersDay
              {...other}
              day={day}
              outsideCurrentMonth={outsideCurrentMonth}
              selected={false}
              sx={{
                ...(isFullyBooked && {
                  bgcolor: (theme) => `${theme.palette.error.main}25`,
                  '&:hover': { bgcolor: (theme) => `${theme.palette.error.main}35` },
                }),
                ...(isToday && {
                  border: '2px solid',
                  borderColor: 'primary.main',
                }),
                ...(isWeekendDay && !isToday && {
                  color: 'text.secondary',
                }),
              }}
            />
          </Badge>
        </span>
      </Tooltip>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DatePicker
        label={t('games.create.date')}
        value={formData.date ? new Date(formData.date + 'T12:00:00') : null}
        onChange={(newValue) => {
          const dateStr = newValue ? formatDate(newValue, 'yyyy-MM-dd') : '';
          handleInputChange('date', dateStr);
        }}
        format="dd/MM/yyyy"
        slots={{ day: CustomDay }}
        slotProps={{
          textField: {
            fullWidth: true,
            required: true,
            error: !!formErrors.date,
            helperText: formErrors.date,
            InputLabelProps: { shrink: true },
          },
          popper: {
            sx: { zIndex: 1300 },
          },
        }}
        disablePast
        shouldDisableDate={(date) => {
          const dateStr = formatDate(date, 'yyyy-MM-dd');
          return fullyBookedDates.has(dateStr);
        }}
      />

      {/* Conflict suggestions */}
      {conflictSuggestions.length > 0 && (
        <Alert
          severity="warning"
          onClose={() => { setConflictSuggestions([]); setConflictMessage(''); }}
          icon={false}
        >
          <Typography variant="body2" fontWeight={500}>{conflictMessage}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Sugestões de horários livres:
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {conflictSuggestions.map((s, i) => (
              <Chip
                key={i}
                size="small"
                label={s.label}
                color="primary"
                variant="outlined"
                onClick={() => {
                  handleInputChange('date', s.date);
                  handleStartTimeChange(s.time);
                  setConflictSuggestions([]);
                  setConflictMessage('');
                }}
              />
            ))}
          </Box>
        </Alert>
      )}

      {/* Suggested time slots (chips) */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
          Horários prontos — sem duplicar habitual, populares e sugestões
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {suggestedTimeChips.map((chip) => {
            const isSelected = formData.time === chip.time;
            return (
              <Chip
                key={chip.time}
                label={chip.label}
                size="small"
                variant={isSelected ? 'filled' : 'outlined'}
                color={
                  isSelected
                    ? 'primary'
                    : chip.source === 'habitual'
                      ? 'warning'
                      : chip.source === 'popular'
                        ? 'secondary'
                        : 'default'
                }
                onClick={() => handleTimeSlotClick(chip.time)}
                sx={{
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Manual time inputs (pre-filled from chips) */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label={t('games.create.startTime')}
          type="time"
          value={formData.time}
          onChange={(e) => handleStartTimeChange(e.target.value)}
          error={!!formErrors.time}
          helperText={formErrors.time || 'Início'}
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: -2 }}>
          →
        </Typography>
        <TextField
          label={t('games.create.endTime')}
          type="time"
          value={formData.endTime}
          onChange={(e) => handleInputChange('endTime', e.target.value)}
          error={!!formErrors.endTime}
          helperText={formErrors.endTime || 'Fim (+1h)'}
          fullWidth
          InputLabelProps={{ shrink: true }}
          size="small"
        />
      </Box>

      {/* Recurrence preview */}
      {formData.recurrenceEnabled && recurrencePreview.length > 0 && (
        <Card sx={{ bgcolor: (theme) => `${theme.palette.info.main}15` }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              📅 Próximos jogos recorrentes:
            </Typography>
            {recurrencePreview.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: r.hasConflict ? 400 : 500 }}>
                  {r.hasConflict ? '⚠' : '✓'} {r.formattedDate} — {r.time}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      <FieldAvailabilityTimeline
        fieldId={formData.fieldId}
        selectedDate={formData.date}
        selectedTime={formData.time}
        openingTime={selectedLocation?.openingTime}
        closingTime={selectedLocation?.closingTime}
        onSlotSelect={(date, time) => {
          handleInputChange('date', date);
          handleStartTimeChange(time);
        }}
      />

      <TextField
        label="URL da Live Stream (YouTube/Twitch)"
        value={formData.streamUrl}
        onChange={(e) => handleInputChange('streamUrl', e.target.value)}
        fullWidth
        placeholder={t('placeholder.enterYoutubeUrl')}
        helperText="Opcional. Cole uma URL do YouTube ou Twitch para transmitir ao vivo."
        inputProps={{ maxLength: 2048 }}
      />
    </Box>
  );
};
