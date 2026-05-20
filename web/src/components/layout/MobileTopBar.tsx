import { AppBar, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { NotificationBell } from '../common/NotificationBell';
import { AppLogo } from '../common/AppLogo';

interface MobileTopBarProps {
  /** Número de notificações não lidas para exibir no badge do sino */
  unreadCount: number;
  /** Título opcional; se omitido, exibe o nome do app */
  title?: string;
}

/**
 * Topbar canônica para telas mobile (xs/sm).
 *
 * Âncora única: AppBar sticky no topo, lado direito para o sino.
 * Visível apenas em viewport mobile (oculta em md+, onde a sidebar
 * lateral já fornece navegação e acesso às notificações).
 *
 * Uso: renderizado pelo MobileShell em App.tsx para todas as rotas
 * não-Home. HomeScreen tem seu próprio AppBar que compõe o sino
 * diretamente (mesma estrutura visual).
 */
export function MobileTopBar({ unreadCount, title }: MobileTopBarProps) {
  const { t } = useTranslation();

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
        {/* Logo padronizada — brand asset (não ícone Material genérico) */}
        <AppLogo size="small" shape="circle" sx={{ width: 28, height: 28, mr: 1 }} />
        <Typography
          variant="h6"
          fontWeight={700}
          color="primary.main"
          sx={{ flex: 1 }}
        >
          {title ?? t('common.appName')}
        </Typography>
        {/* NotificationBell já é um IconButton internamente — não aninhar dentro de outro */}
        <NotificationBell unreadCount={unreadCount} />
      </Toolbar>
    </AppBar>
  );
}
