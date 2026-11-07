import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CheckCircle as CheckCircleIcon,
  EventAvailable as EventAvailableIcon,
  Groups as GroupsIcon,
  Paid as PaidIcon,
  Place as PlaceIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  SportsSoccer as SportsSoccerIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { currencyFormatter, GameFormData } from './createGameTypes';

export interface CreateGameSummaryProps {
  formData: GameFormData;
  selectedDateLabel: string;
  selectedTimeLabel: string;
  recurrenceLabel: string;
  requiredChecklist: Array<{ label: string; done: boolean }>;
  completedRequired: number;
  completionPercent: number;
}

export const CreateGameSummary: React.FC<CreateGameSummaryProps> = ({
  formData,
  selectedDateLabel,
  selectedTimeLabel,
  recurrenceLabel,
  requiredChecklist,
  completedRequired,
  completionPercent,
}) => {
  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        position: { lg: 'sticky' },
        top: { lg: 88 },
        borderColor: alpha(theme.palette.primary.main, 0.18),
        boxShadow: theme.shadowsCustom?.cardPremium ?? theme.shadows[2],
        overflow: 'hidden',
      })}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
          <Box
            sx={(theme) => ({
              width: 42,
              height: 42,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            })}
          >
            <SportsSoccerIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={900}>
              Resumo do jogo
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {completedRequired}/{requiredChecklist.length} essenciais prontos
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CircularProgress
            variant="determinate"
            value={completionPercent}
            size={56}
            thickness={5}
            aria-label={`Progresso do formulário: ${completionPercent}%`}
          />
          <Box>
            <Typography variant="h6" fontWeight={900}>
              {completionPercent}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pronto para publicar
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {[
            { icon: <PlaceIcon fontSize="small" />, label: 'Local', value: formData.fieldName || formData.locationName || 'Ainda não definido' },
            { icon: <EventAvailableIcon fontSize="small" />, label: 'Agenda', value: `${selectedDateLabel} · ${selectedTimeLabel}` },
            { icon: <GroupsIcon fontSize="small" />, label: 'Elenco', value: `${formData.maxPlayers} jogadores · ${formData.maxGoalkeepers} goleiros` },
            { icon: <PaidIcon fontSize="small" />, label: 'Valor', value: formData.totalCost > 0 ? `${currencyFormatter.format(formData.dailyPrice)} por jogador` : 'Sem cobrança definida' },
            { icon: <TuneIcon fontSize="small" />, label: 'Ritmo', value: recurrenceLabel },
          ].map((row) => (
            <Box key={row.label} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ color: 'text.secondary', mt: 0.25 }}>{row.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {row.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Checklist antes de chamar a galera
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {requiredChecklist.map((item) => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.done ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : (
                <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
              )}
              <Typography variant="body2" color={item.done ? 'text.primary' : 'text.secondary'}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};
