import React from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { SportsSoccer as SportsSoccerIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { GameFormData } from './createGameTypes';

export interface CreateHeroSectionProps {
  formData: GameFormData;
  selectedDateLabel: string;
  selectedTimeLabel: string;
}

export const CreateHeroSection: React.FC<CreateHeroSectionProps> = ({
  formData,
  selectedDateLabel,
  selectedTimeLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        mb: 2.5,
        overflow: 'hidden',
        color: 'primary.contrastText',
        border: 0,
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.secondary.dark} 100%)`,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 18% 20%, ${alpha(theme.palette.common.white, 0.26)}, transparent 28%), radial-gradient(circle at 92% 12%, ${alpha(theme.palette.common.white, 0.18)}, transparent 22%)`,
          pointerEvents: 'none',
        },
      })}
    >
      <CardContent
        sx={{
          position: 'relative',
          p: { xs: 2.5, md: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Box>
          <Chip
            icon={<SportsSoccerIcon />}
            label={t('games.create.hero.chipLabel')}
            size="small"
            sx={(theme) => ({
              mb: 1.5,
              color: 'primary.contrastText',
              bgcolor: alpha(theme.palette.common.white, 0.16),
              border: 1,
              borderColor: alpha(theme.palette.common.white, 0.24),
              '& .MuiChip-icon': { color: 'primary.contrastText' },
            })}
          />
          <Typography
            variant="h4"
            component="p"
            sx={{ fontWeight: 900, letterSpacing: '-0.04em', maxWidth: 680 }}
          >
            {t('games.create.hero.title')}
          </Typography>
          <Typography
            variant="body1"
            sx={(theme) => ({
              mt: 1,
              maxWidth: 620,
              color: alpha(theme.palette.common.white, 0.88),
            })}
          >
            {t('games.create.hero.subtitle')}
          </Typography>
        </Box>
        {/* #4057: no dark o gradiente é claro (#4ADE80 → #3A8FC4) e o véu branco
            0.14 deixava os dois rótulos pequenos em 3.04/3.34:1 — o véu escurece
            para alpha(black, 0.24) no dark e os rótulos usam branco cheio
            (>= 5.6:1 nos dois temas). */}
        <Box
          sx={(theme) => ({
            minWidth: { xs: '100%', md: 260 },
            borderRadius: 4,
            p: 2,
            bgcolor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.black, 0.24)
              : alpha(theme.palette.common.white, 0.14),
            border: 1,
            borderColor: alpha(theme.palette.common.white, 0.24),
            backdropFilter: 'blur(12px)',
          })}
        >
          <Typography variant="caption" sx={{ color: 'common.white' }}>
            {t('games.create.hero.quickPreview')}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 900, color: 'common.white' }}>
            {formData.locationName || t('games.create.hero.locationFallback')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'common.white' }}>
            {selectedDateLabel} · {selectedTimeLabel}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
