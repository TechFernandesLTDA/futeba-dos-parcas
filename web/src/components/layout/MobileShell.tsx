import { useRef, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadNotificationSummary } from '../../contexts/UnreadNotificationContext';
import { useAutoBreadcrumbs } from '../../hooks/useAutoBreadcrumbs';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { motion } from '../../theme/motion';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileTopBar } from './MobileTopBar';

export function MobileShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { unreadCount } = useUnreadNotificationSummary();
  const location = useLocation();
  const breadcrumbs = useAutoBreadcrumbs();
  const isSecondary = location.pathname !== '/' && location.pathname !== '';
  const goBack = useNavigateBack();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();

  useSwipeBack({ targetRef: shellRef, disabled: !isSecondary });

  const shellSettleTransition = reducedMotion
    ? 'none'
    : `${motion('transform', 'short', 'standard')}, ${motion('opacity', 'short', 'standard')}`;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100dvh',
        bgcolor: { xs: 'background.default', sm: 'divider' },
      }}
    >
      <Box
        ref={shellRef}
        id="mobile-shell"
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 600, md: 900, lg: 1440, xl: 1920 },
          minHeight: '100dvh',
          bgcolor: 'background.default',
          boxShadow: (theme) => ({
            xs: 'none',
            sm: `0 0 40px ${alpha(
              theme.palette.common.black,
              theme.palette.mode === 'dark' ? 0.4 : 0.12,
            )}`,
          }),
          position: 'relative',
          transform: { xs: 'none', sm: 'translateZ(0)' },
          opacity: 1,
          transition: shellSettleTransition,
          willChange: 'auto',
        }}
      >
        {user && (
          <MobileTopBar
            unreadCount={unreadCount}
            showBack={isSecondary}
            onBack={goBack}
            breadcrumbs={breadcrumbs}
          />
        )}
        {user ? <MobileBottomNav>{children}</MobileBottomNav> : children}
      </Box>
    </Box>
  );
}
