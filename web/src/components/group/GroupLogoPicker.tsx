import React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { GROUP_LOGO_PRESETS } from '../../constants/groupLogos';

interface GroupLogoPickerProps {
  value: string;
  disabled?: boolean;
  onChange: (presetId: string) => void;
}

export const GroupLogoPicker: React.FC<GroupLogoPickerProps> = React.memo(({
  value,
  disabled = false,
  onChange,
}) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {t('groups.logoLabel')}
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={value}
        onChange={(_, nextValue: string | null) => {
          if (nextValue) onChange(nextValue);
        }}
        aria-label={t('groups.logoPickerAria')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(6, minmax(0, 1fr))' },
          gap: 1,
          '& .MuiToggleButtonGroup-grouped': {
            m: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          },
        }}
      >
        {GROUP_LOGO_PRESETS.map((preset) => (
          <Tooltip key={preset.id} title={t(preset.labelKey)}>
            <ToggleButton
              value={preset.id}
              disabled={disabled}
              aria-label={t(preset.labelKey)}
              sx={{
                aspectRatio: '1 / 1',
                minWidth: 0,
                p: 0.75,
                '&.Mui-selected': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.selected',
                },
                '&.Mui-selected:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: preset.color,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.35rem',
                  lineHeight: 1,
                }}
              >
                {preset.emoji}
              </Box>
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
});

GroupLogoPicker.displayName = 'GroupLogoPicker';
