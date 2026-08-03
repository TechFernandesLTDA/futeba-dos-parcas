import type { Theme } from '@mui/material/styles';
import { iconSizes } from '../../theme/iconSizes';
import { getNavSelectedText } from '../../theme';

export const appSidebarLayoutTokens = {
  railPaddingX: 1,
  logoSize: iconSizes.sidebar,
} as const;

export function getAppSidebarOverlayPlacement(direction: 'ltr' | 'rtl') {
  const tooltipPlacement = direction === 'rtl' ? 'left' : 'right';
  return {
    tooltipPlacement,
    menuAnchorHorizontal: tooltipPlacement,
    menuTransformHorizontal: direction === 'rtl' ? 'right' : 'left',
  } as const;
}

export const appSidebarStyles = {
  // #3918: apenas props de LAYOUT ficam na constante (serializáveis, testáveis).
  // A cor de seleção é theme-aware — ver railNavigationButtonSx abaixo.
  railNavigationButton: {
    flexDirection: 'column',
    py: 1.25,
    borderRadius: 2,
  },
  drawerSubheader: {
    typography: 'caption',
    fontWeight: 600,
    lineHeight: 1.75,
    backgroundColor: 'background.paper',
  },
  desktopSearchLabel: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  desktopShortcutsButton: {
    flexGrow: 0,
    flexShrink: 0,
  },
  shortcutIcon: {
    fontSize: iconSizes.lg,
  },
} as const;

/**
 * sx do botão de navegação do rail (md 900–1199px). Combina o layout da
 * constante (acima) + a cor de seleção theme-aware exigida pelo #3918:
 * primary.dark no light (AA 4.5:1), primary.main no dark (5.62:1).
 * Recebe `theme` porque MUI chama fn-sx com ele, e também é chamada direto
 * pelos testes com light/dark themes.
 */
export const railNavigationButtonSx = (theme: Theme) => ({
  ...appSidebarStyles.railNavigationButton,
  '&.Mui-selected': {
    bgcolor: 'action.selected',
    '& .MuiListItemIcon-root': { color: getNavSelectedText(theme) },
  },
});
