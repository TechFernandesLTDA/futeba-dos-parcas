import { alpha, type SxProps, type Theme } from '@mui/material/styles';

export const sxPresets = {
  stickyHeader: {
    position: 'sticky',
    top: 0,
    bgcolor: 'background.paper',
    zIndex: 10,
    borderBottom: 1,
    borderColor: 'divider',
  } as SxProps<Theme>,

  centeredContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  } as SxProps<Theme>,

  cardHover: {
    transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s cubic-bezier(0.2, 0, 0, 1)',
    '@media (hover: hover) and (prefers-reduced-motion: no-preference)': {
      '&:hover': { transform: 'translateY(-3px)' },
    },
  } as SxProps<Theme>,

  fullHeight: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  } as SxProps<Theme>,

  gradientPrimary: (theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  }),

  gradientHero: (theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: theme.palette.primary.contrastText,
    overflow: 'visible',
    position: 'relative',
  }),

  softOutlinedCard: (color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' = 'primary') =>
    (theme: Theme) => ({
      bgcolor: alpha(theme.palette[color].main, theme.palette.mode === 'dark' ? 0.1 : 0.04),
      border: `1px solid ${alpha(theme.palette[color].main, theme.palette.mode === 'dark' ? 0.28 : 0.14)}`,
    }),

  softStatusChip: (color: string) => ({
    bgcolor: alpha(color, 0.12),
    color,
    fontWeight: 600,
    fontSize: '0.75rem',
  }),

  roundedProgress: (theme: Theme) => ({
    height: 8,
    borderRadius: theme.radii.full,
    '& .MuiLinearProgress-bar': {
      borderRadius: theme.radii.full,
    },
  }),
};
