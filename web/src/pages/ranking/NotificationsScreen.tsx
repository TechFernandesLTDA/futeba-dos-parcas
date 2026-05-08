import React, { useState, useEffect } from 'react';
import { gamificationColors } from '../../theme';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Avatar,
  List,
  IconButton,
  Badge,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Notifications as NotificationIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const NotificationsScreen: React.FC = () => {
  useDocumentTitle('Notificações');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications(user?.id);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'GAME_SUMMON':
        return <SoccerIcon color="primary" />;
      case 'GAME_CONFIRMED':
        return <CheckIcon color="success" />;
      case 'GAME_CANCELLED':
        return <CloseIcon color="error" />;
      case 'ACHIEVEMENT':
        return <TrophyIcon sx={{ color: gamificationColors.gold }} />;
      case 'LEVEL_UP':
        return <TrendingIcon color="success" />;
      default:
        return <NotificationIcon />;
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, ml: 1 }}>
            Notificações
          </Typography>
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ mr: 1 }} />
          )}
          {unreadCount > 0 && (
            <IconButton onClick={markAllAsRead} aria-label="Marcar todas como lidas" sx={{ padding: '10px' }}>
              <CheckIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} sx={{ mb: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Skeleton variant="circular" width={48} height={48} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        ) : notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <NotificationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhuma notificação
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Lista de notificações">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                sx={{
                  mb: 1,
                  bgcolor: notification.read ? 'background.paper' : alpha(theme.palette.primary.main, 0.05),
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {getTypeIcon(notification.type)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {notification.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {getTimeAgo(notification.createdAt)}
                      </Typography>
                    </Box>
                    {!notification.read && (
                      <IconButton onClick={() => markAsRead(notification.id)} aria-label="Marcar como lida" sx={{ padding: '10px' }}>
                        <CheckIcon fontSize="small" color="success" />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
};
