import React from 'react';
import { Badge, IconButton, keyframes } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

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

  return (
    <IconButton
      onClick={() => navigate('/notifications')}
      aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
      sx={{
        animation: unreadCount > 0 ? `${pulse} 2s ease-in-out infinite` : undefined,
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
