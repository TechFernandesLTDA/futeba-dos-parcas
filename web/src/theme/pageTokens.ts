import type { Breakpoint } from '@mui/material/styles';

export const pageSpacing = {
  containerMaxWidth: {
    focused: 'xs' as const,     // fluxos centrados (auth/onboarding/welcome) — NAO alargar
    form: 'md' as const,        // formularios
    list: 'xl' as const,        // listas devem aproveitar desktop sem virar "mobile esticado"
    detail: 'xl' as const,      // telas de detalhe tambem ganham respiro horizontal no desktop
    dashboard: 'xl' as const,   // dashboards
  },
  pagePadding: {
    xs: 1.5,
    sm: 2,
    md: 2.5,
    lg: 3,
  } satisfies Partial<Record<Breakpoint, number>>,
  pagePaddingBottom: {
    xs: 8,
    sm: 5,
    md: 3,
  } satisfies Partial<Record<Breakpoint, number>>,
  sectionSpacing: 2,
  sectionSpacingLarge: 3,
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

export const componentMaxWidth = {
  stateMessage: 320,
  bottomBar: 600,
} as const;

export const fixedBottomBarTokens = {
  /** Altura estimada da FixedBottomBar (p:2 + botão 44px) + respir0 */
  height: 80,
  heightWithSafeArea: 'calc(80px + env(safe-area-inset-bottom, 0px))',
} as const;
