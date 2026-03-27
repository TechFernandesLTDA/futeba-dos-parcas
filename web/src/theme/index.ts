import { createTheme } from '@mui/material/styles';

// Cores do Futeba (igual ao Android)
const primary = {
  main: '#00C853',
  light: '#4ADE80',
  dark: '#00852A',
  contrastText: '#FFFFFF',
};

const secondary = {
  main: '#2979FF',
  light: '#5CC8FF',
  dark: '#0055CC',
  contrastText: '#FFFFFF',
};

// Gamification colors
export const gamificationColors = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  xp: '#9C27B0',
  level: '#00BCD4',
  mvp: '#FFD700',
  streak: '#FF5722',
};

export const futebaTheme = createTheme({
  palette: {
    mode: 'light',
    primary,
    secondary,
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#B71C1C',
    },
    warning: {
      main: '#FF6D00',
      light: '#FF9E40',
      dark: '#CC4E00',
    },
    success: {
      main: '#00C853',
      light: '#4ADE80',
      dark: '#00852A',
    },
    info: {
      main: '#2979FF',
      light: '#5CC8FF',
      dark: '#0055CC',
    },
    background: {
      default: '#FCFCFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1C1E',
      secondary: '#444746',
    },
    divider: '#E5E3E6',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.3 },
    h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
    subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none' as const },
    caption: { fontSize: '0.75rem', lineHeight: 1.5 },
    overline: { fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          padding: '10px 24px',
        },
        contained: {
          boxShadow: `0 2px 4px ${primary.main}33`,
          '&:hover': {
            boxShadow: `0 4px 8px ${primary.main}4D`,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 64,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E5E3E6',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: primary.main,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: `0 4px 12px ${primary.main}4D`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

// Dark theme
export const futebaDarkTheme = createTheme({
  ...futebaTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#4ADE80',
      light: '#86EFAC',
      dark: '#22C55E',
      contrastText: '#000000',
    },
    secondary: {
      main: '#5CC8FF',
      light: '#8DD8FF',
      dark: '#29B6F6',
      contrastText: '#000000',
    },
    background: {
      default: '#0F172A',
      paper: '#1E293B',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: '#334155',
  },
  components: {
    ...futebaTheme.components,
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E293B',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E293B',
          borderTop: '1px solid #334155',
        },
      },
    },
  },
});
