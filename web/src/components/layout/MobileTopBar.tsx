import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import { ArrowBack as ArrowBackIcon, NavigateNext } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotificationBell } from '../common/NotificationBell';
import { AppLogo } from '../common/AppLogo';
import type { BreadcrumbItem } from './AppBreadcrumbs';

interface MobileTopBarProps {
  /** Número de notificações não lidas para exibir no badge do sino */
  unreadCount: number;
  /** Título opcional; se omitido, exibe o nome do app */
  title?: string;
  /**
   * #2193: exibe botão de voltar (telas secundárias). Quando true, o logo dá
   * lugar a uma seta de voltar e o sino é ocultado para reduzir ruído.
   */
  showBack?: boolean;
  /** Callback do botão de voltar (#2193). */
  onBack?: () => void;
  /**
   * #2217: trilha de navegação compacta (breadcrumb) renderizada abaixo da
   * toolbar em telas secundárias, dando orientação espacial no mobile.
   */
  breadcrumbs?: BreadcrumbItem[];
}

/**
 * Topbar canônica para telas mobile (xs/sm).
 *
 * Âncora única: AppBar sticky no topo.
 * - Rotas raiz: logo + nome + sino.
 * - Rotas secundárias (#2193): botão voltar + título; sino oculto.
 * - #2217: breadcrumb compacto scrollable abaixo da toolbar em rotas
 *   secundárias (orientação espacial, paridade com o desktop).
 *
 * Visível apenas em viewport mobile (oculta em md+, onde a sidebar lateral já
 * fornece navegação e o AppBreadcrumbs cuida da hierarquia).
 */
export function MobileTopBar({ unreadCount, title, showBack, onBack, breadcrumbs }: MobileTopBarProps) {
  const { t } = useTranslation();

  // Título da tela secundária: usa o último item do breadcrumb se não houver
  // título explícito (ex.: "Jogo", "Grupo", "Editar").
  const screenTitle =
    title ?? (showBack && breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1].label
      : undefined);

  const showCrumbs = showBack && !!breadcrumbs && breadcrumbs.length > 1;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        display: { xs: 'flex', md: 'none' },
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
        // Respeita safe-area iOS (notch/dynamic island)
        pt: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <Toolbar variant="dense">
        {showBack ? (
          <IconButton
            edge="start"
            onClick={onBack}
            aria-label={t('common.back')}
            sx={{ mr: 1, color: 'text.primary' }}
          >
            <ArrowBackIcon />
          </IconButton>
        ) : (
          // Logo padronizada — brand asset (não ícone Material genérico)
          <AppLogo size="small" shape="circle" sx={{ width: 28, height: 28, mr: 1 }} />
        )}
        <Typography
          variant="h6"
          fontWeight={700}
          color="primary.main"
          noWrap
          sx={{ flex: 1 }}
        >
          {screenTitle ?? t('common.appName')}
        </Typography>
        {/* Sino apenas nas rotas raiz; oculto em telas secundárias para reduzir ruído */}
        {!showBack && <NotificationBell unreadCount={unreadCount} />}
      </Toolbar>

      {showCrumbs && (
        <Box
          aria-label={t('a11y.breadcrumb')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 2,
            pb: 0.75,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            // Esconde a barra de rolagem mantendo o scroll funcional
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {breadcrumbs!.map((item, idx) => {
            const isLast = idx === breadcrumbs!.length - 1;
            return (
              <Box key={`${item.label}-${idx}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                {idx > 0 && (
                  <NavigateNext fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
                )}
                {isLast || !item.to ? (
                  <Typography
                    variant="caption"
                    color={isLast ? 'text.primary' : 'text.secondary'}
                    sx={{ fontWeight: isLast ? 600 : 400 }}
                  >
                    {item.label}
                  </Typography>
                ) : (
                  <Typography
                    component={RouterLink}
                    to={item.to}
                    variant="caption"
                    color="text.secondary"
                    sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {item.label}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </AppBar>
  );
}
