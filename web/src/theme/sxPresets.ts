import type { SxProps, Theme } from '@mui/material/styles';

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
    '@media (hover: hover)': {
      '&:hover': {
        boxShadow: 4,
        transform: 'translateY(-2px)',
      },
    },
    transition: (theme) => theme.transitions.create(['box-shadow', 'transform'], {
      duration: theme.transitions.duration.shortest,
    }),
  } as SxProps<Theme>,

  fullHeight: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  } as SxProps<Theme>,

  gradientPrimary: (theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  }),
};
