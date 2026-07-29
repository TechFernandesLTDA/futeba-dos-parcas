import React from 'react';
import { Chip, Tooltip, useTheme, alpha } from '@mui/material';
import { Science as ScienceIcon } from '@mui/icons-material';
import { getDemoDataLabel, isDemoData, type DemoDataLike } from '../../utils/demoData';

interface DemoDataChipProps {
  data?: DemoDataLike | null;
  size?: 'small' | 'medium';
}

export const DemoDataChip: React.FC<DemoDataChipProps> = ({ data, size = 'small' }) => {
  const theme = useTheme();
  if (!isDemoData(data)) return null;

  const label = getDemoDataLabel(data);
  const reason = data?.demoDataReason || data?.seedId || 'Dado marcado para testes e limpeza futura.';
  const isDark = theme.palette.mode === 'dark';
  const chipTextColor = isDark ? theme.palette.warning.light : theme.palette.warning.dark;

  return (
    <Tooltip title={reason}>
      <Chip
        icon={<ScienceIcon />}
        label={label}
        size={size}
        variant="outlined"
        sx={{
          fontWeight: 700,
          bgcolor: alpha(theme.palette.warning.main, 0.12),
          borderColor: alpha(theme.palette.warning.main, 0.5),
          color: chipTextColor,
          '& .MuiChip-icon': { color: chipTextColor },
        }}
      />
    </Tooltip>
  );
};
