import type { Breakpoint } from '@mui/material/styles';

export const pageSpacing = {
  containerMaxWidth: {
    focused: 'xs' as const,     // fluxos centrados (auth/onboarding/welcome) — NAO alargar
    form: 'md' as const,        // formularios
    list: 'lg' as const,        // listas
    detail: 'lg' as const,      // telas de detalhe
    dashboard: 'xl' as const,   // dashboards
  },
  pagePadding: {
    xs: 2,
    sm: 3,
    md: 4,
  } satisfies Partial<Record<Breakpoint, number>>,
  pagePaddingBottom: {
    xs: 8,
    sm: 6,
  } satisfies Partial<Record<Breakpoint, number>>,
  sectionSpacing: 3,
  sectionSpacingLarge: 5,
  headerHeight: 56,
  bottomBarHeight: 64,
  contentMaxWidth: {
    sm: 600,
    md: 720,
    lg: 960,
    xl: 1200,
  } satisfies Partial<Record<Breakpoint, number>>,  // max-width responsivo para conteudo de texto/leitura
};

export const gridLayout = {
  cards: { xs: 12, sm: 6, md: 4, lg: 3, xl: 2 },
  cardsWide: { xs: 12, sm: 12, md: 6, lg: 4, xl: 3 },
  list: { xs: 12 },
} as const;

export type GridVariant = keyof typeof gridLayout;
