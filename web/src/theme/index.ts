import { createTheme, alpha } from '@mui/material/styles';
import { motionDuration, motionEasing } from './motion';

// Augmenta a paleta MUI com todos os 7 surface containers do MD3
declare module '@mui/material/styles' {
  interface Theme {
    shadowsCustom: Record<string, string>;
    radii: typeof radii;
  }
  interface ThemeOptions {
    shadowsCustom?: Record<string, string>;
    radii?: typeof radii;
  }
  interface Palette {
    surfaceDim: string;
    surfaceBright: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
  }
  interface PaletteOptions {
    surfaceDim?: string;
    surfaceBright?: string;
    surfaceContainerLowest?: string;
    surfaceContainerLow?: string;
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
  }
}

// Cores do Futeba — primary.main ajustada para WCAG AA (4.76:1 sobre branco)
// Verde canônico vem de shared/design-tokens.json.
const primary = {
  main: '#00852A',      // ratio 4.76:1 vs #FFFFFF (passa WCAG AA)
  light: '#4ADE80',
  dark: '#005A1C',      // ratio ~7.5:1 vs branco
  contrastText: '#FFFFFF',
};

const secondary = {
  // Escurecido para AA quando usado como texto/ícone pequeno sobre fundo claro.
  main: '#005FCC',
  light: '#5CC8FF',
  dark: '#004399',
  contrastText: '#FFFFFF',
};

const appFontFamily = 'Poppins, "Plus Jakarta Sans", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// =============================================================================
// #2751 — Escala tipográfica MD3 como fonte única de verdade
//
// Tiers GRANDES (display*, headline*) usam clamp() responsivo:
//   clamp(mínimo, valor-fluido, máximo)
//   Base de cálculo: viewport 360px (mobile pequeno) → 1200px (desktop)
//   Slope em vw calculado como (max_rem - min_rem) / (1200 - 360) * 100
//
// Tiers title/body/label mantêm px fixos: são usados em contextos de
// leitura onde variação de tamanho prejudica escaneabilidade.
//
// Os valores alimentam a `typography` do MUI abaixo — sem duplicação de números.
// =============================================================================
export const md3TypeScale = {
  // display* — títulos hero, splash screens
  // displayLarge: 57px max → 40px min (slope ≈ 2.02vw)
  displayLarge: {
    fontSize: 'clamp(2.5rem, 1.688rem + 2.024vw, 3.5625rem)',
    lineHeight: '4rem',       // 64px — MD3 canônico
    letterSpacing: '-0.015625rem', // -0.25px
    fontWeight: 400,
  },
  // displayMedium: 45px max → 36px min (slope ≈ 1.07vw)
  displayMedium: {
    fontSize: 'clamp(2.25rem, 1.893rem + 0.893vw, 2.8125rem)',
    lineHeight: '3.25rem',    // 52px
    letterSpacing: '0rem',
    fontWeight: 400,
  },
  // displaySmall: 36px max → 30px min (slope ≈ 0.71vw)
  displaySmall: {
    fontSize: 'clamp(1.875rem, 1.607rem + 0.714vw, 2.25rem)',
    lineHeight: '2.75rem',    // 44px
    letterSpacing: '0rem',
    fontWeight: 400,
  },
  // headline* — títulos de seção e telas
  // headlineLarge: 32px max → 28px min (slope ≈ 0.48vw)
  headlineLarge: {
    fontSize: 'clamp(1.75rem, 1.554rem + 0.476vw, 2rem)',
    lineHeight: '2.5rem',     // 40px
    letterSpacing: '0rem',
    fontWeight: 600,
  },
  // headlineMedium: 28px max → 24px min (slope ≈ 0.48vw)
  headlineMedium: {
    fontSize: 'clamp(1.5rem, 1.304rem + 0.476vw, 1.75rem)',
    lineHeight: '2.25rem',    // 36px
    letterSpacing: '0rem',
    fontWeight: 600,
  },
  // headlineSmall: 24px max → 22px min (slope ≈ 0.24vw)
  headlineSmall: {
    fontSize: 'clamp(1.375rem, 1.277rem + 0.238vw, 1.5rem)',
    lineHeight: '2rem',       // 32px
    letterSpacing: '0rem',
    fontWeight: 600,
  },
  // title* — títulos de componentes (fixos para legibilidade)
  titleLarge: {
    fontSize: '1.375rem',     // 22px
    lineHeight: '1.75rem',    // 28px
    letterSpacing: '0rem',
    fontWeight: 600,
  },
  titleMedium: {
    fontSize: '1rem',         // 16px
    lineHeight: '1.5rem',     // 24px
    letterSpacing: '0.009375rem', // 0.15px
    fontWeight: 600,
  },
  titleSmall: {
    fontSize: '0.875rem',     // 14px
    lineHeight: '1.25rem',    // 20px
    letterSpacing: '0.00625rem',  // 0.1px
    fontWeight: 700,
  },
  // body* — conteúdo principal (fixos para legibilidade)
  bodyLarge: {
    fontSize: '1rem',         // 16px
    lineHeight: '1.5rem',     // 24px
    letterSpacing: '0.009375rem', // 0.15px
    fontWeight: 400,
  },
  bodyMedium: {
    fontSize: '0.875rem',     // 14px
    lineHeight: '1.25rem',    // 20px
    letterSpacing: '0.015625rem', // 0.25px
    fontWeight: 400,
  },
  bodySmall: {
    fontSize: '0.75rem',      // 12px
    lineHeight: '1rem',       // 16px
    letterSpacing: '0.025rem',    // 0.4px
    fontWeight: 400,
  },
  // label* — botões, chips, rótulos (fixos)
  labelLarge: {
    fontSize: '0.875rem',     // 14px
    lineHeight: '1.25rem',    // 20px
    letterSpacing: '0.00625rem',  // 0.1px
    fontWeight: 600,
  },
  labelMedium: {
    fontSize: '0.75rem',      // 12px
    lineHeight: '1rem',       // 16px
    letterSpacing: '0.03125rem',  // 0.5px
    fontWeight: 600,
  },
  labelSmall: {
    fontSize: '0.6875rem',    // 11px
    lineHeight: '1rem',       // 16px
    letterSpacing: '0.03125rem',  // 0.5px
    fontWeight: 600,
  },
} as const;

// Badge rarity colors — suporta nomes PT-BR (canônico do BadgeRarity) e EN (legacy).
// BADGE_DEFINITIONS usa COMUM/RARO/EPICO/LENDARIO; aliases EN ficam por compat.
export const rarityColors: Record<string, string> = {
  // PT-BR (canônico, alinhado a BadgeRarity em types/gamification.ts)
  COMUM: '#9E9E9E',
  INCOMUM: '#388E3C', // #2163: era #4CAF50 hardcoded; tom mais escuro p/ contraste light
  RARO: '#2196F3',
  EPICO: '#9C27B0',
  LENDARIO: '#FF9800',
  // EN aliases (legacy / fallback)
  COMMON: '#9E9E9E',
  UNCOMMON: '#388E3C',
  RARE: '#2196F3',
  EPIC: '#9C27B0',
  LEGENDARY: '#FF9800',
};

// Dark-mode badge rarity variants — higher brightness for contrast on dark backgrounds
export const rarityColorsDark: Record<string, string> = {
  COMUM: '#BDBDBD',
  INCOMUM: '#66BB6A', // #2163: variante brilhante p/ dark/OLED
  RARO: '#42A5F5',
  EPICO: '#CE93D8',
  LENDARIO: '#FFB74D',
  COMMON: '#BDBDBD',
  UNCOMMON: '#66BB6A',
  RARE: '#42A5F5',
  EPIC: '#CE93D8',
  LEGENDARY: '#FFB74D',
};

// Gamification colors
// #1574: adicionados platinum e champion para centralizar cores de divisão
// #2236: gold/silver/bronze/diamond alinhados ao canônico do Android (GamificationColors em Color.kt)
//   Gold   #FFD700 = 0xFFFFD700
//   Silver #E0E0E0 = 0xFFE0E0E0
//   Bronze #CD7F32 = 0xFFCD7F32
//   Diamond #B9F2FF = 0xFFB9F2FF
// Nota: no light mode, gold (#FFD700) e silver (#E0E0E0) são cores de fundo — use
// contraste de texto via getContrastText() ou texto escuro fixo (#1A1C1E).
export const gamificationColors = {
  gold: '#FFD700',
  silver: '#E0E0E0',
  bronze: '#CD7F32',
  diamond: '#B9F2FF',
  platinum: '#00E676',
  champion: '#E91E63',
  xp: '#9C27B0',
  level: '#00BCD4',
  mvp: '#FFD700',
  streak: '#FF5722',
};

// #1554: variantes para dark mode — mesmas cores com maior saturação/brilho para
// manter contraste adequado sobre fundos escuros (#0F172A / #1E293B)
// #2236: gold/silver/diamond usam os mesmos hex canônicos do Android (já aplicados
// na base acima). Bronze permanece clareado (#E8924A) no dark — o #CD7F32 perde
// contraste sobre fundos escuros.
export const gamificationColorsDark = {
  ...gamificationColors,
  bronze: '#E8924A',
  diamond: '#B9F2FF',
  xp: '#CE93D8',
  level: '#4DD0E1',
  streak: '#FF7043',
};

// #2707: OKLCH variants — wider gamut, perceptually uniform. Progressive
// enhancement: browsers that don't support OKLCH fall back to hex values above.
export const oklchAccent = {
  green50: 'oklch(0.95 0.04 142)',
  green500: 'oklch(0.55 0.18 142)',
  green900: 'oklch(0.28 0.10 142)',
};

// #2705: semantic shadow tokens — layered, single light-source (vertical ~2x horizontal)
export const shadowTokens = {
  card: '0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
  cardHover: '0 2px 4px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
  nav: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  dropdown: '0 4px 6px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)',
  overlay: '0 8px 16px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12)',
  modal: '0 16px 32px rgba(0,0,0,0.12), 0 48px 64px rgba(0,0,0,0.16)',
  cardPremium: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

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
      // Escurecido para contraste AA em chips/labels pequenos no light mode.
      main: '#B45309',
      light: '#FF9E40',
      dark: '#8A3A00',
    },
    success: {
      main: '#00852A',     // WCAG AA 4.76:1 vs branco
      light: '#4ADE80',
      dark: '#005A1C',
    },
    info: {
      main: '#005FCC',
      light: '#5CC8FF',
      dark: '#004399',
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
    // #2754: 7 níveis de surface container — valores canônicos de shared/design-tokens.json
    surfaceDim: '#DDD8DD',
    surfaceBright: '#FDF8FD',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F7F2F7',
    surfaceContainer: '#F1ECF1',
    surfaceContainerHigh: '#EBE6EB',
    surfaceContainerHighest: '#E5E1E6',
  },
  // #2751: typography derivada de md3TypeScale (fonte única — sem duplicação de números)
  // Mapeamento MUI ↔ MD3: h1=displayLarge, h2=displayMedium, h3=displaySmall,
  // h4=headlineLarge, h5=headlineMedium, h6=headlineSmall,
  // subtitle1=titleLarge, subtitle2=titleMedium, body1=bodyLarge, body2=bodyMedium,
  // caption=labelSmall, overline=labelSmall (upper)
  typography: {
    fontFamily: appFontFamily,
    // display* — mapeados em h1-h3 com clamp() responsivo
    h1: { fontSize: md3TypeScale.displayLarge.fontSize, fontWeight: md3TypeScale.displayLarge.fontWeight, lineHeight: md3TypeScale.displayLarge.lineHeight, letterSpacing: md3TypeScale.displayLarge.letterSpacing },
    h2: { fontSize: md3TypeScale.displayMedium.fontSize, fontWeight: md3TypeScale.displayMedium.fontWeight, lineHeight: md3TypeScale.displayMedium.lineHeight, letterSpacing: md3TypeScale.displayMedium.letterSpacing },
    h3: { fontSize: md3TypeScale.displaySmall.fontSize, fontWeight: md3TypeScale.displaySmall.fontWeight, lineHeight: md3TypeScale.displaySmall.lineHeight, letterSpacing: md3TypeScale.displaySmall.letterSpacing },
    // headline* — mapeados em h4-h6 com clamp() responsivo
    h4: { fontSize: md3TypeScale.headlineLarge.fontSize, fontWeight: md3TypeScale.headlineLarge.fontWeight, lineHeight: md3TypeScale.headlineLarge.lineHeight, letterSpacing: md3TypeScale.headlineLarge.letterSpacing },
    h5: { fontSize: md3TypeScale.headlineMedium.fontSize, fontWeight: md3TypeScale.headlineMedium.fontWeight, lineHeight: md3TypeScale.headlineMedium.lineHeight, letterSpacing: md3TypeScale.headlineMedium.letterSpacing },
    h6: { fontSize: md3TypeScale.headlineSmall.fontSize, fontWeight: md3TypeScale.headlineSmall.fontWeight, lineHeight: md3TypeScale.headlineSmall.lineHeight, letterSpacing: md3TypeScale.headlineSmall.letterSpacing },
    // title* / body* — fixos para legibilidade
    subtitle1: { fontSize: md3TypeScale.titleLarge.fontSize, fontWeight: md3TypeScale.titleLarge.fontWeight, lineHeight: md3TypeScale.titleLarge.lineHeight, letterSpacing: md3TypeScale.titleLarge.letterSpacing },
    subtitle2: { fontSize: md3TypeScale.titleMedium.fontSize, fontWeight: md3TypeScale.titleMedium.fontWeight, lineHeight: md3TypeScale.titleMedium.lineHeight, letterSpacing: md3TypeScale.titleMedium.letterSpacing },
    body1: { fontSize: md3TypeScale.bodyLarge.fontSize, lineHeight: md3TypeScale.bodyLarge.lineHeight, letterSpacing: md3TypeScale.bodyLarge.letterSpacing, fontVariantNumeric: 'tabular-nums' },
    body2: { fontSize: md3TypeScale.bodyMedium.fontSize, lineHeight: md3TypeScale.bodyMedium.lineHeight, letterSpacing: md3TypeScale.bodyMedium.letterSpacing, fontVariantNumeric: 'tabular-nums' },
    button: { fontWeight: 600, textTransform: 'none' as const },
    caption: { fontSize: md3TypeScale.labelSmall.fontSize, lineHeight: md3TypeScale.labelSmall.lineHeight, letterSpacing: md3TypeScale.labelSmall.letterSpacing },
    overline: { fontSize: md3TypeScale.labelSmall.fontSize, fontWeight: md3TypeScale.labelSmall.fontWeight, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  },
  shadows: [
    'none',                                                                                          // 0
    shadowTokens.nav,                                                                                // 1 — nav/subtle
    shadowTokens.card,                                                                               // 2 — card default
    '0 2px 8px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06)',                                     // 3
    '0 2px 10px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)',                                     // 4 — paper default
    '0 4px 12px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',                                     // 5
    '0 4px 14px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',                                    // 6
    '0 4px 14px rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.08)',                                   // 7
    shadowTokens.dropdown,                                                                           // 8 — dropdown/popover
    '0 5px 6px rgba(0,0,0,0.12), 0 9px 12px rgba(0,0,0,0.08), 0 4px 18px rgba(0,0,0,0.06)',      // 9
    '0 6px 6px rgba(0,0,0,0.12), 0 10px 14px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.06)',     // 10
    '0 6px 7px rgba(0,0,0,0.12), 0 11px 15px rgba(0,0,0,0.08), 0 4px 22px rgba(0,0,0,0.08)',     // 11
    '0 7px 8px rgba(0,0,0,0.14), 0 12px 17px rgba(0,0,0,0.1), 0 5px 24px rgba(0,0,0,0.08)',      // 12
    '0 7px 8px rgba(0,0,0,0.14), 0 13px 19px rgba(0,0,0,0.1), 0 5px 26px rgba(0,0,0,0.08)',      // 13
    '0 7px 9px rgba(0,0,0,0.14), 0 14px 21px rgba(0,0,0,0.1), 0 5px 28px rgba(0,0,0,0.08)',      // 14
    '0 8px 9px rgba(0,0,0,0.14), 0 15px 22px rgba(0,0,0,0.1), 0 6px 30px rgba(0,0,0,0.08)',      // 15
    shadowTokens.overlay,                                                                            // 16 — dialog
    '0 8px 11px rgba(0,0,0,0.14), 0 17px 26px rgba(0,0,0,0.1), 0 6px 34px rgba(0,0,0,0.08)',     // 17
    '0 9px 11px rgba(0,0,0,0.14), 0 18px 28px rgba(0,0,0,0.1), 0 7px 36px rgba(0,0,0,0.1)',      // 18
    '0 9px 12px rgba(0,0,0,0.16), 0 19px 29px rgba(0,0,0,0.1), 0 7px 38px rgba(0,0,0,0.1)',      // 19
    '0 10px 13px rgba(0,0,0,0.16), 0 20px 31px rgba(0,0,0,0.1), 0 8px 40px rgba(0,0,0,0.1)',     // 20
    '0 10px 13px rgba(0,0,0,0.16), 0 21px 33px rgba(0,0,0,0.1), 0 8px 42px rgba(0,0,0,0.1)',     // 21
    '0 10px 14px rgba(0,0,0,0.16), 0 22px 35px rgba(0,0,0,0.1), 0 8px 44px rgba(0,0,0,0.12)',    // 22
    '0 11px 14px rgba(0,0,0,0.16), 0 23px 36px rgba(0,0,0,0.12), 0 9px 46px rgba(0,0,0,0.12)',   // 23
    shadowTokens.modal,                                                                              // 24 — modal max
  ] as const,
  shadowsCustom: shadowTokens,
  radii,
  shape: {
    borderRadius: radii.md,
  },
  // #1570: tokens de transição para animações consistentes entre telas
  // #2726: adota motionDuration / motionEasing do design system
  transitions: {
    duration: {
      shortest: motionDuration.short,
      shorter: motionDuration.medium,
      short: motionDuration.long,
      standard: motionDuration.medium,
      complex: motionDuration.long,
      // #2755: defaults herdados do MUI (fora do vocabulário de motion do design system)
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: motionEasing.emphasized,
      easeOut: motionEasing.decelerate,
      easeIn: motionEasing.accelerate,
      sharp: motionEasing.accelerate,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: radii.md,
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
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          borderRadius: radii.lg,
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          boxShadow: shadowTokens.card,
        }),
      },
    },
    // #2230: hover/transition consistente em cards interativos (envoltos em
    // CardActionArea). Cards estáticos não são afetados. Respeita reduced-motion
    // via override global em MuiCssBaseline.
    MuiCardActionArea: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          transition: theme.transitions.create(['transform', 'box-shadow'], {
            duration: theme.transitions.duration.shortest,
          }),
          '@media (hover: hover) and (prefers-reduced-motion: no-preference)': {
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: shadowTokens.cardHover,
              '& .MuiCardActionArea-focusHighlight': { opacity: 0.04 },
            },
          },
        }),
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
            borderRadius: radii.md,
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
          borderRadius: radii.full,
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
    // #2169: dialogs fullScreen respeitam safe-area (notch/dynamic island +
    // home indicator) centralizadamente, em vez de patch por tela (12+ dialogs).
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radii.lg,
        },
        paperFullScreen: {
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': {
          boxSizing: 'border-box',
        },
        'html, body, #root': {
          width: '100%',
          minWidth: 0,
          minHeight: '100%',
          overflowX: 'clip',
        },
        '@supports not (overflow: clip)': {
          'html, body, #root': {
            overflowX: 'hidden',
          },
        },
        'img, video, canvas, svg': {
          maxWidth: '100%',
        },
        '.MuiBox-root, .MuiStack-root, .MuiGrid-root, .MuiCard-root, .MuiPaper-root, .MuiContainer-root': {
          minWidth: 0,
        },
        '.MuiButton-root, .MuiChip-root': {
          maxWidth: '100%',
        },
        '.MuiButton-startIcon, .MuiButton-endIcon': {
          flexShrink: 0,
        },
        '.MuiTypography-root, .MuiListItemText-primary, .MuiListItemText-secondary, .MuiChip-label': {
          overflowWrap: 'anywhere',
        },
        // #2208: transição suave ao alternar tema (light/dark/OLED). Limitada a
        // propriedades de cor para evitar footgun de perf de `transition: all`.
        // Composição com prefers-reduced-motion abaixo desativa a animação.
        'body, body *': {
          transitionProperty: 'background-color, color, border-color',
          transitionDuration: '0.25s',
          transitionTimingFunction: 'ease',
        },
        // #2725: View Transitions API — cross-fade em navegações (Chrome 111+)
        '@view-transition': {
          navigation: 'auto',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
          '.stagger-fade-in > *': { opacity: 1, animation: 'none' },
          '@view-transition': { navigation: 'none' },
        },
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        '.stagger-fade-in > *': {
          opacity: 0,
          animation: 'fadeInUp 0.35s ease-out forwards',
        },
        '.stagger-fade-in > *:nth-child(1)': { animationDelay: '0ms' },
        '.stagger-fade-in > *:nth-child(2)': { animationDelay: '40ms' },
        '.stagger-fade-in > *:nth-child(3)': { animationDelay: '80ms' },
        '.stagger-fade-in > *:nth-child(4)': { animationDelay: '120ms' },
        '.stagger-fade-in > *:nth-child(5)': { animationDelay: '160ms' },
        '.stagger-fade-in > *:nth-child(6)': { animationDelay: '200ms' },
        '.stagger-fade-in > *:nth-child(7)': { animationDelay: '240ms' },
        '.stagger-fade-in > *:nth-child(8)': { animationDelay: '280ms' },
        '.stagger-fade-in > *:nth-child(9)': { animationDelay: '320ms' },
        '.stagger-fade-in > *:nth-child(10)': { animationDelay: '360ms' },
        '.stagger-fade-in > *:nth-child(11)': { animationDelay: '400ms' },
        '.stagger-fade-in > *:nth-child(12)': { animationDelay: '400ms' },
        '.MuiCard-root': {
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 200px',
        },
        '.MuiTypography-noWrap': {
          textOverflow: 'ellipsis',
        },
        // #2706: cap max-width for readability on wide surfaces (~68ch)
        '.MuiTypography-body1, .MuiTypography-body2': {
          maxWidth: '68ch',
        },
        // #2240: foco visível consistente para usuários de teclado (WCAG 2.4.7).
        // Outline de 3px com offset; a cor vem de --futeba-focus-ring, definida
        // por tema (light abaixo; dark/OLED sobrescreve em seu MuiCssBaseline)
        // para garantir contraste >= 3:1 contra o fundo. Aplica a qualquer
        // elemento focável via :focus-visible (botões, links, Boxes com
        // role/tabIndex, inputs).
        body: {
          '--futeba-focus-ring': '#1B5E20',
        },
        ':focus-visible': {
          outline: '3px solid var(--futeba-focus-ring, #1B5E20)',
          outlineOffset: '2px',
          borderRadius: `${radii.xs}px`,
        },
        // #2739: prefers-reduced-transparency — desabilita glass (blur/backdrop-filter)
        '@media (prefers-reduced-transparency: reduce)': {
          '.MuiDrawer-paper, .MuiAppBar-root, .MuiPaper-root[style*="backdrop-filter"]': {
            backdropFilter: 'none !important',
          },
        },
        // #2739: prefers-contrast — reforça bordas e texto
        '@media (prefers-contrast: more)': {
          '.MuiDivider-root': { borderColor: 'currentColor', opacity: 0.5 },
          '.MuiOutlinedInput-notchedOutline': { borderColor: 'currentColor', opacity: 0.6 },
        },
        // #2739: forced-colors — anéis de foco e UI essencial
        '@media (forced-colors: active)': {
          '.MuiButton-contained': { border: '2px solid ButtonText' },
          '.MuiChip-root': { border: '1px solid ButtonText' },
          ':focus-visible': { outline: '3px solid Highlight' },
        },
        // #2707: OKLCH progressive enhancement — browsers with OKLCH support
        // get perceptually uniform green accent via CSS custom properties.
        '@supports (color: oklch(0 0 0))': {
          ':root': {
            '--primary-oklch': oklchAccent.green500,
            '--primary-light-oklch': oklchAccent.green50,
            '--primary-dark-oklch': oklchAccent.green900,
          },
        },
        // #2707: P3 wide-gamut support for displays like Apple XDR / OLED HDR.
        '@media (color-gamut: p3)': {
          ':root': {
            '--accent-p3': 'color(display-p3 0 0.53 0.16)',
          },
        },
        // #2177: padding inferior do #mobile-shell removido. O spacer dentro
        // de MobileBottomNav (height = bottomBarHeight + safe-area) já reserva
        // o espaço; a regra aqui duplicava o padding (~128px + 2x safe-area).
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
      dark: '#2E7D32',
      contrastText: '#000000',
    },
    secondary: {
      main: '#5CC8FF',
      light: '#90CAF9',
      dark: '#004399',
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
    error: { main: '#FFB4AB', light: '#FFCDD2', dark: '#B71C1C' },
    warning: { main: '#FF9E40', light: '#FFCC80', dark: '#8A3A00' },
    success: { main: '#66BB6A', light: '#81C784', dark: '#2E7D32' },
    info: { main: '#5CC8FF', light: '#90CAF9', dark: '#004399' },
    divider: '#334155',
    // #2754: 7 níveis de surface container dark — valores canônicos de shared/design-tokens.json
    surfaceDim: '#0F1114',
    surfaceBright: '#36393E',
    surfaceContainerLowest: '#0A0C0E',
    surfaceContainerLow: '#15191C',
    surfaceContainer: '#1A1D21',
    surfaceContainerHigh: '#24282C',
    surfaceContainerHighest: '#2F3337',
  },
  components: {
    ...futebaTheme.components,
    // #2240: no dark/OLED o anel de foco verde-escuro não contrasta com o fundo
    // navy. Sobrescreve --futeba-focus-ring com verde claro (>= 3:1 em #0F172A)
    // preservando as demais regras do baseline.
    MuiCssBaseline: {
      styleOverrides: {
        ...(futebaTheme.components?.MuiCssBaseline?.styleOverrides as Record<string, unknown>),
        body: {
          '--futeba-focus-ring': '#86EFAC',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderRadius: theme.radii.lg,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          boxShadow: shadowTokens.card,
        }),
      },
    },
    // #2705: dark-mode shadows use surface tint (light gradient on dark bg)
    // instead of pure-black rgba which disappears on #0F172A
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}, 0 4px 16px ${alpha(theme.palette.common.black, 0.15)}`,
          backgroundImage: `linear-gradient(${alpha(theme.palette.common.white, 0.035)}, ${alpha(theme.palette.common.white, 0)})`,
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}, 0 4px 12px ${alpha(theme.palette.common.black, 0.12)}`,
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
          borderRadius: theme.radii.lg,
          boxShadow: theme.shadows[16],
        }),
        // #2169: safe-area em fullScreen (este bloco sobrescreve o spread do
        // light theme, então o paperFullScreen precisa ser redeclarado aqui).
        paperFullScreen: {
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: theme.radii.md,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.divider,
            },
          },
        }),
      },
    },
  },
});

export const futebaDarkOledTheme = createTheme({
  ...futebaDarkTheme,
  palette: {
    ...futebaDarkTheme.palette,
    background: {
      default: '#000000',
      paper: '#0A0A0A',
    },
    divider: '#1F2937',
    // #2754: OLED — superfícies ultra-escuras (desviadas dos tokens canônicos
    // para evitar luz em display OLED; os tokens dark são usados no dark theme)
    surfaceDim: '#000000',
    surfaceBright: '#1A1A1A',
    surfaceContainerLowest: '#000000',
    surfaceContainerLow: '#0A0A0A',
    surfaceContainer: '#101010',
    surfaceContainerHigh: '#171717',
    surfaceContainerHighest: '#1F1F1F',
  },
  // #2705: OLED shadows use tint-based elevation (subtle light) to work on near-black
  components: {
    ...futebaDarkTheme.components,
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.3)}, 0 4px 16px ${alpha(theme.palette.common.black, 0.25)}`,
          backgroundImage: `linear-gradient(${alpha(theme.palette.common.white, 0.05)}, ${alpha(theme.palette.common.white, 0)})`,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderRadius: theme.radii.lg,
          border: `1px solid ${alpha(theme.palette.divider, 0.18)}`,
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.3)}, 0 4px 16px ${alpha(theme.palette.common.black, 0.2)}`,
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: import('@mui/material/styles').Theme }) => ({
          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.4)}, 0 4px 12px ${alpha(theme.palette.common.black, 0.3)}`,
        }),
      },
    },
  },
});

// Re-exporta tokens de animação para que importadores de theme/index.ts
// não precisem importar de theme/motion.ts separadamente.
export { motionTokens, motionDuration, motionEasing, motion } from './motion';
