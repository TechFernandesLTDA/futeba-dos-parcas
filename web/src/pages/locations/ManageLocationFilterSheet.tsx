import React from 'react';
import { Box, Button, Chip, Drawer, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ActiveFilterChip } from './manageLocationChips';
import { ManageLocationQueryState } from './manageLocationUrlState';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  onClearAll: () => void;
  /** Quantas quadras passam nos filtros agora (botão "Ver N quadras"). */
  resultCount: number;
  activeCount: number;
  children: React.ReactNode;
}

/** Bottom sheet de filtros para o mobile (≤ 640 px). */
export const ManageLocationFilterSheet: React.FC<SheetProps> = ({
  open,
  onClose,
  onClearAll,
  resultCount,
  activeCount,
  children,
}) => {
  const { t } = useTranslation();
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: '92vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          display: 'flex',
          flexDirection: 'column',
        },
        role: 'dialog',
        'aria-label': t('locations.manageFilters.filters'),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1, pb: 0.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {activeCount > 0
            ? t('locations.manageFilters.filtersCount', { count: activeCount })
            : t('locations.manageFilters.filters')}
        </Typography>
        <IconButton onClick={onClose} aria-label={t('locations.manageFilters.close')} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ overflowY: 'auto', px: 2, py: 1.5, flex: 1 }}>{children}</Box>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          pb: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <Button
          variant="outlined"
          onClick={onClearAll}
          disabled={activeCount === 0}
          sx={{ minHeight: 48, flex: 1 }}
        >
          {t('locations.manageFilters.clearAll')}
        </Button>
        <Button variant="contained" onClick={onClose} sx={{ minHeight: 48, flex: 2 }}>
          {t('locations.manageFilters.showResults', { count: resultCount })}
        </Button>
      </Box>
    </Drawer>
  );
};

interface ChipsProps {
  chips: ActiveFilterChip[];
  onClear: (patch: Partial<ManageLocationQueryState>) => void;
  onClearAll: () => void;
}

/** Chips dos filtros ativos, cada um com "x", e "Limpar tudo". */
export const ManageLocationActiveChips: React.FC<ChipsProps> = ({ chips, onClear, onClearAll }) => {
  const { t } = useTranslation();
  if (chips.length === 0) return null;
  return (
    <Box
      sx={{ display: 'flex', flexWrap: { xs: 'nowrap', md: 'wrap' }, gap: 0.75, alignItems: 'center', overflowX: { xs: 'auto', md: 'visible' }, pb: 0.5 }}
      role="group"
      aria-label={t('locations.manageFilters.activeFilters')}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          size="small"
          color="primary"
          variant="outlined"
          onDelete={() => onClear(chip.clear)}
          deleteIcon={<CloseIcon aria-label={t('locations.manageFilters.removeFilter', { label: chip.label })} />}
          sx={{ flexShrink: 0, minHeight: { xs: 32, md: 28 } }}
        />
      ))}
      <Button size="small" onClick={onClearAll} sx={{ flexShrink: 0, minHeight: 36 }}>
        {t('locations.manageFilters.clearAll')}
      </Button>
    </Box>
  );
};
