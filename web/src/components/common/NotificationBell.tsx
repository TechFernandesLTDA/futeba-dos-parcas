import React from 'react';
import { Badge, IconButton, keyframes } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../../hooks/useReducedMotion';

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
        animation: unreadCount > 0 && !reducedMotion ? `${pulse} 2s ease-in-out infinite` : undefined,
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
