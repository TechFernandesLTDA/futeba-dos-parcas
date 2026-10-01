import React from 'react';
import { Box, Paper, Typography, alpha } from '@mui/material';
import { AutoAwesome, EmojiEvents, Star, TrendingUp } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { motionDuration, motionEasing } from '../../theme/motion';
import { useGamificationColors } from '../../hooks/useGamificationColors';
import type { RewardActivityKind } from './GamificationCelebration.utils';

export const GAMIFICATION_CELEBRATION_DURATION_MS = motionDuration.long * 3;

const particleSlots = Array.from({ length: 12 }, (_, index) => index);

interface GamificationCelebrationProps {
  kind: RewardActivityKind;
  title: string;
  message?: string;
}

function getCelebrationIcon(kind: RewardActivityKind) {
  if (kind === 'level') return <TrendingUp fontSize="small" />;
  if (kind === 'badge') return <Star fontSize="small" />;
  if (kind === 'mvp') return <EmojiEvents fontSize="small" />;
  return <AutoAwesome fontSize="small" />;
}

export const GamificationCelebration = React.memo(function GamificationCelebration({
  kind,
  title,
  message,
}: GamificationCelebrationProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const gColors = useGamificationColors();

  if (reducedMotion) return null;

  const accentColor = kind === 'level' ? gColors.level : kind === 'xp' ? theme.palette.primary.main : gColors.gold;

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={title}
      sx={{
        '@keyframes rewardToastIn': {
          '0%': { opacity: 0, transform: 'translateY(18px) scale(0.94)' },
          '18%': { opacity: 1, transform: 'translateY(0) scale(1)' },
          '82%': { opacity: 1, transform: 'translateY(0) scale(1)' },
          '100%': { opacity: 0, transform: 'translateY(-6px) scale(0.98)' },
        },
        '@keyframes rewardParticle': {
          '0%': { opacity: 0, transform: 'translate3d(0, 12px, 0) scale(0.6)' },
          '20%': { opacity: 1 },
          '100%': { opacity: 0, transform: 'translate3d(var(--tx), var(--ty), 0) scale(0.25)' },
        },
        position: 'fixed',
        right: { xs: 16, sm: 24 },
        bottom: { xs: 88, sm: 32 },
        zIndex: theme.zIndex.snackbar,
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0 }}>
        {particleSlots.map((slot) => {
          const angle = (slot / particleSlots.length) * Math.PI * 2;
          const distance = 38 + (slot % 4) * 10;
          return (
            <Box
              key={slot}
              sx={{
                '--tx': `${Math.cos(angle) * distance}px`,
                '--ty': `${Math.sin(angle) * distance}px`,
                position: 'absolute',
                right: 56,
                bottom: 28,
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: slot % 3 === 0 ? accentColor : theme.palette.secondary.main,
                opacity: 0,
                animation: `rewardParticle ${motionDuration.long}ms ${motionEasing.decelerate} ${slot * 24}ms both`,
              }}
            />
          );
        })}
      </Box>

      <Paper
        elevation={6}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          minWidth: 240,
          maxWidth: 320,
          p: 1.5,
          borderRadius: 2,
          border: `1px solid ${alpha(accentColor, 0.35)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          animation: `rewardToastIn ${GAMIFICATION_CELEBRATION_DURATION_MS}ms ${motionEasing.standard} both`,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            color: theme.palette.getContrastText(accentColor),
            bgcolor: accentColor,
            flex: '0 0 auto',
          }}
        >
          {getCelebrationIcon(kind)}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {title}
          </Typography>
          {message ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {message}
            </Typography>
          ) : null}
        </Box>
      </Paper>
    </Box>
  );
});
