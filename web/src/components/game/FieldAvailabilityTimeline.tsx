import React from 'react';
import {
  Box,
  Typography,
  Alert,
  Skeleton,
  Paper,
} from '@mui/material';
import { format, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFieldGames } from '../../hooks/useFieldGames';

const DEFAULT_GAME_DURATION_MINUTES = 60;
const HOUR_START = 6;
const HOUR_END = 23;

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const formatTimeLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

interface FieldAvailabilityTimelineProps {
  fieldId: string;
  selectedDate: string;
  selectedTime: string;
  onSlotSelect: (date: string, time: string) => void;
}

export const FieldAvailabilityTimeline: React.FC<FieldAvailabilityTimelineProps> = ({
  fieldId,
  selectedDate,
  selectedTime,
  onSlotSelect,
}) => {
  const { data, loading, error } = useFieldGames(fieldId, 7);
  const { byDate } = data;

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const selectedMinutes = selectedTime ? parseTime(selectedTime) : null;

  const isSlotOccupied = (day: string, slotStart: number, slotEnd: number) => {
    const slots = byDate.get(day) || [];
    return slots.some((s) => s.startMinutes < slotEnd && s.endMinutes > slotStart);
  };

  const isSelectedSlot = (day: string, slotStart: number) => {
    return day === selectedDate && selectedMinutes === slotStart;
  };

  const slots = Array.from(
    { length: (HOUR_END - HOUR_START) * 2 },
    (_, i) => HOUR_START * 60 + i * 30
  );

  if (!fieldId) {
    return null;
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
          Disponibilidade do campo
        </Typography>
        <Skeleton variant="rounded" height={180} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
          Disponibilidade do campo
        </Typography>
        <Alert severity="error" icon={false}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
        Disponibilidade do campo (proximos 7 dias)
      </Typography>
      <Box sx={{ overflowX: 'auto', pb: 1, WebkitOverflowScrolling: 'touch' }}>
        <Box sx={{ display: 'flex', gap: 1, minWidth: 'min-content' }}>
          {days.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, new Date());
            const dayName = format(day, 'EEE', { locale: ptBR });
            const dayNum = format(day, 'dd/MM');

            return (
              <Paper
                key={dayStr}
                variant="outlined"
                sx={{
                  px: 1,
                  py: 0.5,
                  minWidth: 80,
                  bgcolor: isToday ? (theme) => `${theme.palette.primary.main}15` : 'transparent',
                }}
              >
                <Typography variant="caption" fontWeight={isToday ? 700 : 500} align="center" display="block" noWrap>
                  {dayName} {dayNum}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                  {slots.map((slotStart) => {
                    const slotEnd = slotStart + DEFAULT_GAME_DURATION_MINUTES;
                    const occupied = isSlotOccupied(dayStr, slotStart, slotEnd);
                    const selected = isSelectedSlot(dayStr, slotStart);

                    return (
                      <Box
                        key={slotStart}
                        sx={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: occupied ? 'default' : 'pointer' }}
                        onClick={() => {
                          if (!occupied) {
                            const h = Math.floor(slotStart / 60);
                            const m = slotStart % 60;
                            onSlotSelect(dayStr, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                          }
                        }}
                        title={
                          occupied
                            ? `Ocupado ${formatTimeLabel(slotStart)}`
                            : `Livre ${formatTimeLabel(slotStart)}`
                        }
                      >
                        <Box
                          sx={{
                            height: 6,
                            width: '100%',
                            borderRadius: 1,
                            bgcolor: selected
                              ? 'primary.main'
                              : occupied
                              ? 'error.main'
                              : 'success.light',
                            border: selected ? '1px solid' : undefined,
                            borderColor: selected ? 'primary.dark' : undefined,
                            opacity: occupied && !selected ? 0.6 : 1,
                            '&:hover': {
                              opacity: occupied ? 0.6 : 0.9,
                            },
                            transition: 'opacity 0.15s',
                          }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 6, borderRadius: 1, bgcolor: 'success.light' }} />
          <Typography variant="caption" color="text.secondary">Livre</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 6, borderRadius: 1, bgcolor: 'error.main', opacity: 0.6 }} />
          <Typography variant="caption" color="text.secondary">Ocupado</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 6, borderRadius: 1, bgcolor: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary">Selecionado</Typography>
        </Box>
      </Box>
    </Box>
  );
};
