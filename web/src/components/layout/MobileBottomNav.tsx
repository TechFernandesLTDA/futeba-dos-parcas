import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useScrollTrigger,
  Slide,
  Box,
} from '@mui/material';
import { md3TypeScale } from '../../theme';
import { pageSpacing } from '../../theme/pageTokens';
import { iconSizes } from '../../theme/iconSizes';
import { getNavigationGlassStyles } from '../../theme/navigationGlass';
import { NAV_ITEMS, getActiveNavIndexForItems } from '../../config/navItems';
import { useToast } from '../../contexts/ToastContext';
import { usePrefetchOnHover } from '../../hooks/useResourcePreloading';

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.showInBottomNav);
const BOTTOM_NAV_ICONS = BOTTOM_NAV_ITEMS.map((item) => (
  React.cloneElement(item.icon, { 'aria-hidden': true, sx: { fontSize: iconSizes.lg } })
));

export function MobileBottomNav({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { showError } = useToast();
  const { onFocus: prefetchOnFocus } = usePrefetchOnHover();

  // #2175 (bug 1): threshold 50 + histerese padrão evita flicker (esconder a
  // cada 1px de scroll). Antes: disableHysteresis + threshold 0.
  const trigger = useScrollTrigger({
    threshold: 50,
  });

  const activeValue = React.useMemo(() => {
    // #3726: itens "more" resolvem para parentItemId na bottom nav (umbrella).
    // Ex.: /settings → Perfil (idx 4) no mobile, mas Settings próprio no desktop.
    return getActiveNavIndexForItems(location.pathname, location.search, BOTTOM_NAV_ITEMS);
  }, [location.pathname, location.search]);

  return (
    <>
      {children}
      <Slide appear={false} direction="up" in={!trigger}>
        <Paper
          sx={(theme) => ({
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            pb: 'env(safe-area-inset-bottom, 0px)',
            pl: 'env(safe-area-inset-left, 0px)',
            pr: 'env(safe-area-inset-right, 0px)',
            zIndex: 1100,
            display: { xs: 'flex', md: 'none' },
            justifyContent: 'center',
            ...getNavigationGlassStyles(theme, 'mobile'),
            borderTop: '1px solid',
            borderColor: 'divider',
            boxShadow: theme.shadowsCustom?.navBottom ?? theme.shadowsCustom?.nav,
          })}
          elevation={0}
        >
          <BottomNavigation
            data-testid="mobile-bottom-navigation"
            value={activeValue}
            onChange={(_e, newValue: number) => {
              // #2175 (bug 2): navegação com error handling — feedback ao
              // usuário se navigate lançar (ex.: rota inválida).
              try {
                navigate(BOTTOM_NAV_ITEMS[newValue].path);
              } catch {
                showError(t('common.navigationError'));
              }
            }}
            showLabels
            sx={{
              width: '100%',
              // O Paper externo é a superfície de vidro. O filho precisa ser
              // transparente para não encobrir blur/opacidade, inclusive em xs.
              backgroundColor: 'transparent',
              // #2203: em tablets (sm, até 900px) 480px centraliza os ícones e
              // desperdiça as laterais. Distribui melhor com 600px no sm.
              maxWidth: { xs: 480, sm: 600 },
              height: pageSpacing.bottomBarHeight,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 44,
                minHeight: 44,
                padding: '6px 0',
              },
              '& .MuiBottomNavigationAction-label': {
                ...md3TypeScale.labelMedium,
                '&.Mui-selected': md3TypeScale.labelMedium,
              },
            }}
          >
            {BOTTOM_NAV_ITEMS.map((item, idx) => (
              <BottomNavigationAction
                key={item.labelKey}
                label={t(item.labelKey)}
                icon={BOTTOM_NAV_ICONS[idx]}
                data-prefetch-route={item.path}
                onFocus={prefetchOnFocus}
                aria-label={t(item.labelKey)}
                aria-current={activeValue === idx ? 'page' : undefined}
                sx={{
                  '&.Mui-selected': {
                    color: 'primary.main',
                    bgcolor: 'action.selected',
                    borderRadius: 2,
                    '& .MuiBottomNavigationAction-label': {
                      fontWeight: 600,
                    },
                  },
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      </Slide>
      <Box sx={{ display: { xs: 'block', md: 'none' }, height: `calc(${pageSpacing.bottomBarHeight}px + env(safe-area-inset-bottom, 0px))` }} />
    </>
  );
}

export default MobileBottomNav;
