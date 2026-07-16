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
import { alpha } from '@mui/material/styles';
import { pageSpacing } from '../../theme/pageTokens';
import { iconSizes } from '../../theme/iconSizes';
import { NAV_ITEMS, getActiveNavIndexForItems } from '../../config/navItems';
import { useToast } from '../../contexts/ToastContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.showInBottomNav);

export const MobileBottomNav = React.memo(function MobileBottomNav({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { showError } = useToast();
  const reducedMotion = useReducedMotion();

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
      <Slide
        appear={false}
        direction="up"
        in={!trigger}
        timeout={reducedMotion ? 0 : undefined}
        mountOnEnter
        unmountOnExit
      >
        <Paper
          aria-hidden={trigger ? true : undefined}
          sx={{
            position: 'fixed',
            bottom: 0,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            pb: 'env(safe-area-inset-bottom, 0px)',
            paddingInlineStart: (theme) => theme.direction === 'rtl'
              ? 'env(safe-area-inset-right, 0px)'
              : 'env(safe-area-inset-left, 0px)',
            paddingInlineEnd: (theme) => theme.direction === 'rtl'
              ? 'env(safe-area-inset-left, 0px)'
              : 'env(safe-area-inset-right, 0px)',
            zIndex: 1100,
            display: { xs: 'flex', md: 'none' },
            justifyContent: 'center',
            pointerEvents: trigger ? 'none' : 'auto',
            backdropFilter: 'blur(12px)',
            backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.72),
            borderTop: '1px solid',
            borderColor: 'divider',
            boxShadow: (theme) => theme.shadowsCustom?.navBottom ?? theme.shadowsCustom?.nav,
            '@supports not (backdrop-filter: blur(12px))': {
              backgroundColor: 'background.paper',
            },
            '@media (prefers-reduced-transparency: reduce)': {
              backdropFilter: 'none',
              backgroundColor: 'background.paper',
            },
          }}
          elevation={0}
        >
          <BottomNavigation
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
                fontSize: '0.75rem',
                '&.Mui-selected': {
                  fontSize: '0.75rem',
                },
              },
            }}
          >
            {BOTTOM_NAV_ITEMS.map((item, idx) => (
              <BottomNavigationAction
                key={item.labelKey}
                label={t(item.labelKey)}
                icon={React.cloneElement(item.icon, { sx: { fontSize: iconSizes.lg } })}
                aria-label={t(item.labelKey)}
                aria-current={activeValue === idx ? 'page' : undefined}
                tabIndex={trigger ? -1 : undefined}
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
});

export default MobileBottomNav;
