import { iconSizes } from '../../theme/iconSizes';

export const appSidebarLayoutTokens = {
  railPaddingX: 1,
  logoSize: iconSizes.sidebar,
} as const;

export const appSidebarStyles = {
  railNavigationButton: {
    flexDirection: 'column',
    py: 1.25,
    borderRadius: 2,
    '&.Mui-selected': {
      bgcolor: 'action.selected',
      '& .MuiListItemIcon-root': { color: 'primary.main' },
    },
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
} as const;
