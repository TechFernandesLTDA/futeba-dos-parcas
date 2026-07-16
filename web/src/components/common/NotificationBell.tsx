import React from 'react';
import { Badge, IconButton, keyframes } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  NOTIFICATION_PULSE_CYCLES,
  shouldAnimateNotificationBell,
} from './notificationBellMotion';

interface NotificationBellProps {
  unreadCount: number;
}

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

export const NotificationBell: React.FC<NotificationBellProps> = ({ unreadCount }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  const ariaLabel = unreadCount > 0
    ? t('nav.notificationsAria', { count: unreadCount })
    : t('nav.notifications');

  return (
    <IconButton
      onClick={() => navigate('/notifications')}
      aria-label={ariaLabel}
      sx={{
        // #3767: três ciclos chamam atenção sem manter movimento perpétuo.
        animation: shouldAnimateNotificationBell(unreadCount, reducedMotion)
          ? `${pulse} 2s ease-in-out ${NOTIFICATION_PULSE_CYCLES}`
          : undefined,
      }}
    >
      <Badge
        badgeContent={unreadCount}
        color="error"
        invisible={unreadCount === 0}
        max={99}
      >
        <NotificationsIcon />
      </Badge>
    </IconButton>
  );
};
