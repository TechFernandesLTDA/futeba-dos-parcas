import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import {
  ChatBubbleOutline as ChatIcon,
  Inbox as InboxIcon,
  Replay as RetryIcon,
} from '@mui/icons-material';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getDirectChatPeer, useDirectChats } from '../../hooks/useDirectMessages';

function formatChatTime(date?: Date) {
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const DirectMessagesScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { chats, loading, error, currentUserId } = useDirectChats();
  useDocumentTitle(t('directMessages.title'));

  return (
    <PageContainer maxWidth="focused">
      <Stack spacing={2} sx={{ py: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('directMessages.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('directMessages.subtitle')}
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RetryIcon />} onClick={() => window.location.reload()}>
                {t('common.retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading && <LoadingState shimmerCount={5} itemType="CARD" />}

        {!loading && !error && chats.length === 0 && (
          <EmptyState
            icon={<InboxIcon />}
            title={t('directMessages.emptyTitle')}
            description={t('directMessages.emptyDescription')}
            actionLabel={t('directMessages.findPlayers')}
            onAction={() => navigate('/players/nearby')}
          />
        )}

        {!loading && !error && chats.length > 0 && (
          <Stack spacing={1}>
            {chats.map((chat) => {
              const peer = getDirectChatPeer(chat, currentUserId);
              const unread = currentUserId ? chat.unreadCount[currentUserId] ?? 0 : 0;
              return (
                <Card key={chat.id}>
                  <CardActionArea onClick={() => navigate(`/messages/${chat.id}`)}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Badge color="primary" badgeContent={unread} invisible={unread === 0} max={99}>
                          <Avatar src={peer.photoUrl ?? undefined} alt={peer.name}>
                            {peer.name.charAt(0)}
                          </Avatar>
                        </Badge>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="baseline">
                            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>
                              {peer.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                              {formatChatTime(chat.lastMessageAt)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {chat.lastMessage || t('directMessages.noMessagesYet')}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        )}

        {!loading && !error && chats.length > 0 && (
          <Button startIcon={<ChatIcon />} variant="outlined" onClick={() => navigate('/players/nearby')}>
            {t('directMessages.findPlayers')}
          </Button>
        )}
      </Stack>
    </PageContainer>
  );
};
