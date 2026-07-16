import { alpha, type Theme } from '@mui/material/styles';

/**
 * Tokens das superfícies translúcidas de navegação.
 *
 * O mobile usa um raio menor para limitar o custo de composição em aparelhos
 * menos potentes. Desktop/rail pode usar uma difusão maior sem alterar a
 * legibilidade. A decisão de manter o blur em light, dark e OLED é única aqui.
 */
export const navigationGlassTokens = {
  mobile: {
    blurPx: 12,
    surfaceOpacity: 0.72,
  },
  desktop: {
    blurPx: 16,
    surfaceOpacity: 0.8,
  },
} as const;

export type NavigationGlassSurface = keyof typeof navigationGlassTokens;

export function getNavigationGlassStyles(theme: Theme, surface: NavigationGlassSurface) {
  const token = navigationGlassTokens[surface];
  const filter = `blur(${token.blurPx}px)`;
  const unsupportedQuery = `@supports not ((backdrop-filter: ${filter}) or (-webkit-backdrop-filter: ${filter}))`;

  return {
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    backgroundColor: alpha(theme.palette.background.paper, token.surfaceOpacity),
    [unsupportedQuery]: {
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      backgroundColor: theme.palette.background.paper,
    },
    '@media (prefers-reduced-transparency: reduce)': {
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      backgroundColor: theme.palette.background.paper,
    },
  } as const;
}
