import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  DeleteOutline as DeleteIcon,
  ForumOutlined as ForumIcon,
  Replay as RetryIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/GameCard';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DIRECT_MESSAGE_MAX_LENGTH, DirectMessage, useDirectChat } from '../../hooks/useDirectMessages';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';

function formatMessageTime(date?: Date) {
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function MessageBubble({
  message,
  isOwn,
  onDelete,
}: {
  message: DirectMessage;
  isOwn: boolean;
  onDelete: (messageId: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const deleted = Boolean(message.deletedAt);

  return (
    <Stack direction="row" spacing={1} justifyContent={isOwn ? 'flex-end' : 'flex-start'} alignItems="flex-end">
      {!isOwn && (
        <Avatar src={message.senderPhotoUrl ?? undefined} alt={message.senderName} sx={{ width: 32, height: 32 }}>
          {message.senderName.charAt(0)}
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: { xs: '82%', sm: '70%' },
          px: 1.5,
          py: 1,
          borderRadius: 1,
          bgcolor: isOwn ? 'primary.main' : 'background.paper',
          color: isOwn ? 'primary.contrastText' : 'text.primary',
          border: '1px solid',
          borderColor: isOwn ? 'primary.main' : 'divider',
          boxShadow: theme.shadowsCustom?.card ?? theme.shadows[1],
        }}
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            color: deleted ? (isOwn ? alpha(theme.palette.primary.contrastText, 0.72) : 'text.secondary') : 'inherit',
            fontStyle: deleted ? 'italic' : 'normal',
          }}
        >
          {deleted ? t('directMessages.deletedMessage') : message.text}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: isOwn ? alpha(theme.palette.primary.contrastText, 0.72) : 'text.secondary' }}>
            {formatMessageTime(message.createdAt)}
          </Typography>
          {isOwn && !deleted && (
            <Tooltip title={t('common.delete')}>
              <IconButton
                size="small"
                onClick={() => onDelete(message.id)}
                sx={{ color: alpha(theme.palette.primary.contrastText, 0.86), p: 0.25 }}
                aria-label={t('common.delete')}
              >
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

export const ConversationScreen: React.FC = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showError } = useToast();
  const {
    peer,
    messages,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    deleteMessage,
    currentUserId,
  } = useDirectChat(chatId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useDocumentTitle(peer ? t('directMessages.conversationWith', { name: peer.name }) : t('directMessages.title'));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const handleSend = async () => {
    const cleanText = text.trim();
    if (!cleanText) return;
    setSending(true);
    try {
      await sendMessage(cleanText);
      setText('');
    } catch (err) {
      showError(err instanceof Error ? err.message : getFirestoreErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (err) {
      showError(err instanceof Error ? err.message : getFirestoreErrorMessage(err));
    }
  };

  return (
    <PageContainer maxWidth="focused" sx={{ minHeight: '100%' }}>
      <Stack spacing={2} sx={{ py: 2, minHeight: 'calc(100dvh - 96px)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton onClick={() => navigate('/messages')} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Avatar src={peer?.photoUrl ?? undefined} alt={peer?.name ?? t('directMessages.title')}>
            {(peer?.name ?? 'J').charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap>
              {peer?.name ?? t('directMessages.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('directMessages.privateConversation')}
            </Typography>
          </Box>
        </Stack>

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

        {!loading && !error && (
          <Card sx={{ flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
              {hasMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={loadingMore}
                    startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                    onClick={() => void loadMore()}
                  >
                    {t('directMessages.loadOlder')}
                  </Button>
                </Box>
              )}

              {messages.length === 0 ? (
                <EmptyState
                  icon={<ForumIcon />}
                  title={t('directMessages.emptyConversationTitle')}
                  description={t('directMessages.emptyConversationDescription')}
                  sx={{ py: 5 }}
                />
              ) : (
                <Stack spacing={1.25}>
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderId === currentUserId}
                      onDelete={handleDelete}
                    />
                  ))}
                </Stack>
              )}
              <div ref={bottomRef} />
            </Box>

            <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  size="small"
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, DIRECT_MESSAGE_MAX_LENGTH))}
                  placeholder={t('directMessages.messagePlaceholder')}
                  inputProps={{ maxLength: DIRECT_MESSAGE_MAX_LENGTH }}
                  helperText={t('directMessages.counter', { count: text.length, max: DIRECT_MESSAGE_MAX_LENGTH })}
                />
                <IconButton
                  color="primary"
                  disabled={sending || text.trim().length === 0}
                  onClick={() => void handleSend()}
                  aria-label={t('directMessages.send')}
                >
                  {sending ? <CircularProgress size={22} /> : <SendIcon />}
                </IconButton>
              </Stack>
            </Box>
          </Card>
        )}
      </Stack>
    </PageContainer>
  );
};
