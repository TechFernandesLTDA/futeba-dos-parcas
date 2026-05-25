import { createTheme, alpha } from '@mui/material/styles';

// Augment MUI palette with custom surface tokens
declare module '@mui/material/styles' {
  interface Palette {
    surfaceContainer: string;
    surfaceContainerHigh: string;
  }
  interface PaletteOptions {
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
  }
}

// Cores do Futeba — primary.main ajustada para WCAG AA (4.76:1 sobre branco)
// Brand original #00C853 (2.24:1, falha WCAG) preservado em gamificationColors.brand
const primary = {
  main: '#00852A',      // ratio 4.76:1 vs #FFFFFF (passa WCAG AA)
  light: '#4ADE80',
  dark: '#005A1C',      // ratio ~7.5:1 vs branco
  contrastText: '#FFFFFF',
};

const secondary = {
  main: '#2979FF',
  light: '#5CC8FF',
  dark: '#0055CC',
  contrastText: '#FFFFFF',
};

// Badge rarity colors — suporta nomes PT-BR (canônico do BadgeRarity) e EN (legacy).
// BADGE_DEFINITIONS usa COMUM/RARO/EPICO/LENDARIO; aliases EN ficam por compat.
export const rarityColors: Record<string, string> = {
  // PT-BR (canônico, alinhado a BadgeRarity em types/gamification.ts)
  COMUM: '#9E9E9E',
  RARO: '#2196F3',
  EPICO: '#9C27B0',
  LENDARIO: '#FF9800',
  // EN aliases (legacy / fallback)
  COMMON: '#9E9E9E',
  RARE: '#2196F3',
  EPIC: '#9C27B0',
  LEGENDARY: '#FF9800',
};

// Gamification colors
// #1574: adicionados platinum e champion para centralizar cores de divisão
export const gamificationColors = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  platinum: '#00E676',
  champion: '#E91E63',
  xp: '#9C27B0',
  level: '#00BCD4',
  mvp: '#FFD700',
  streak: '#FF5722',
};

// #1554: variantes para dark mode — mesmas cores com maior saturação/brilho para
// manter contraste adequado sobre fundos escuros (#0F172A / #1E293B)
export const gamificationColorsDark = {
  ...gamificationColors,
  gold: '#FFE033',
  silver: '#D4D4D4',
  bronze: '#E8924A',
  xp: '#CE93D8',
  level: '#4DD0E1',
  mvp: '#FFE033',
  streak: '#FF7043',
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
      main: '#00852A',     // WCAG AA 4.76:1 vs branco
      light: '#4ADE80',
      dark: '#005A1C',
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
    surfaceContainer: '#F0F0F3',
    surfaceContainerHigh: '#ECECEF',
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
    overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  },
  // #1806: sombras customizadas — tokens para uso com theme.shadows[n]
  // 1=sutil, 4=padrão (Card/Paper), 8=elevado (Fab/Dialog), 16=máximo (Modal)
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    '0 1px 5px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.08)',
    '0 2px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
    '0 2px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
    '0 3px 10px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
    '0 3px 12px rgba(0,0,0,0.12), 0 2px 5px rgba(0,0,0,0.1)',
    '0 4px 12px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.1)',
    '0 4px 14px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.12)',
    '0px 5px 6px -3px rgba(0,0,0,0.2),0px 9px 12px 1px rgba(0,0,0,0.14),0px 3px 16px 2px rgba(0,0,0,0.12)',
    '0px 6px 6px -3px rgba(0,0,0,0.2),0px 10px 14px 1px rgba(0,0,0,0.14),0px 4px 18px 3px rgba(0,0,0,0.12)',
    '0px 6px 7px -4px rgba(0,0,0,0.2),0px 11px 15px 1px rgba(0,0,0,0.14),0px 4px 20px 3px rgba(0,0,0,0.12)',
    '0px 7px 8px -4px rgba(0,0,0,0.2),0px 12px 17px 2px rgba(0,0,0,0.14),0px 5px 22px 4px rgba(0,0,0,0.12)',
    '0px 7px 8px -4px rgba(0,0,0,0.2),0px 13px 19px 2px rgba(0,0,0,0.14),0px 5px 24px 4px rgba(0,0,0,0.12)',
    '0px 7px 9px -4px rgba(0,0,0,0.2),0px 14px 21px 2px rgba(0,0,0,0.14),0px 5px 26px 4px rgba(0,0,0,0.12)',
    '0px 8px 9px -5px rgba(0,0,0,0.2),0px 15px 22px 2px rgba(0,0,0,0.14),0px 6px 28px 5px rgba(0,0,0,0.12)',
    '0 8px 32px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.15)',
    '0px 8px 11px -5px rgba(0,0,0,0.2),0px 17px 26px 2px rgba(0,0,0,0.14),0px 6px 32px 5px rgba(0,0,0,0.12)',
    '0px 9px 11px -5px rgba(0,0,0,0.2),0px 18px 28px 2px rgba(0,0,0,0.14),0px 7px 34px 6px rgba(0,0,0,0.12)',
    '0px 9px 12px -6px rgba(0,0,0,0.2),0px 19px 29px 2px rgba(0,0,0,0.14),0px 7px 36px 6px rgba(0,0,0,0.12)',
    '0px 10px 13px -6px rgba(0,0,0,0.2),0px 20px 31px 3px rgba(0,0,0,0.14),0px 8px 38px 7px rgba(0,0,0,0.12)',
    '0px 10px 13px -6px rgba(0,0,0,0.2),0px 21px 33px 3px rgba(0,0,0,0.14),0px 8px 40px 7px rgba(0,0,0,0.12)',
    '0px 10px 14px -6px rgba(0,0,0,0.2),0px 22px 35px 3px rgba(0,0,0,0.14),0px 8px 42px 7px rgba(0,0,0,0.12)',
    '0px 11px 14px -7px rgba(0,0,0,0.2),0px 23px 36px 3px rgba(0,0,0,0.14),0px 9px 44px 8px rgba(0,0,0,0.12)',
    '0px 11px 15px -7px rgba(0,0,0,0.2),0px 24px 38px 3px rgba(0,0,0,0.14),0px 9px 46px 8px rgba(0,0,0,0.12)',
  ] as const,
  shape: {
    borderRadius: 12,
  },
  // #1570: tokens de transição para animações consistentes entre telas
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          padding: '10px 24px',
          touchAction: 'manipulation',
        },
        contained: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 2px 4px ${alpha(theme.palette.primary.main, 0.2)}`,
          '&:hover': {
            boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          // Remove tap delay de 300ms no iOS Safari
          touchAction: 'manipulation',
          // WCAG: touch target minimo 44x44px
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          // Remove tap delay de 300ms no iOS Safari
          touchAction: 'manipulation',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: theme.shadows[4],
        }),
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
        // Fix #413: usar palette tokens em vez de hex hardcoded
        // Hex anteriores quebravam dark mode quando tema dinamico mudava.
        root: ({theme}: {theme: import('@mui/material/styles').Theme}) => ({
          height: 64,
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          '&.Mui-selected': {
            color: theme.palette.primary.main,
          },
        }),
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
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: theme.shadows[1],
        }),
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `,
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
      secondary: '#B0BEC5',
    },
    error: { main: '#EF5350', light: '#FF8A80', dark: '#C62828' },
    warning: { main: '#FFA726', light: '#FFB74D', dark: '#E65100' },
    success: { main: '#66BB6A', light: '#81C784', dark: '#2E7D32' },
    info: { main: '#42A5F5', light: '#64B5F6', dark: '#1565C0' },
    divider: '#334155',
    surfaceContainer: '#273248',
    surfaceContainerHigh: '#2D3A52',
  },
  components: {
    ...futebaTheme.components,
    MuiCard: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          backgroundColor: theme.palette.background.paper,
        }),
      },
    },
    // Sombras do light (rgba 0,0,0,0.08) ficam invisíveis no #0F172A → densificar no dark
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: theme.shadows[8],
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: theme.shadows[8],
        }),
      },
    },
    // Button/Fab usavam constante `primary.main` (verde light #00852A) — no dark precisa o primary do tema (#4ADE80)
    MuiButton: {
      styleOverrides: {
        contained: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 2px 4px ${theme.palette.primary.main}33`,
          '&:hover': {
            boxShadow: `0 4px 8px ${theme.palette.primary.main}4D`,
          },
        }),
      },
    },
    MuiFab: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
        }),
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          '&.Mui-selected': {
            color: theme.palette.primary.main,
          },
        }),
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        // Fix #413: dark mode também usa palette tokens
        root: ({theme}: {theme: import('@mui/material/styles').Theme}) => ({
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    // Fix #1475: Dialog Paper must use dark background.paper in dark mode
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[16],
        }),
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.divider,
            },
          },
        }),
      },
    },
  },
});
