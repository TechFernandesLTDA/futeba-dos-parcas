import type { Breakpoint } from '@mui/material/styles';

export const pageSpacing = {
  containerMaxWidth: {
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
  contentMaxWidth: 720,  // max-width para conteudo de texto/leitura
};

export const gridLayout = {
  cards: { xs: 12, sm: 6, md: 4, lg: 3 },
  cardsWide: { xs: 12, sm: 12, md: 6, lg: 4 },
  list: { xs: 12 },
} as const;

export type GridVariant = keyof typeof gridLayout;
