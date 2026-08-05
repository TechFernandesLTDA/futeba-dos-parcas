import { useState, useEffect, useRef } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Stack,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatIcon from '@mui/icons-material/Chat';
import { useTranslation } from 'react-i18next';
import { useGameChat, useSendGameMessage, useDeleteGameMessage } from '../../hooks/useGameChat';
import { EmptyState } from '../../components/common/EmptyState';

interface GameChatPanelProps {
  gameId: string;
  isConfirmedPlayer: boolean;
  isOwner: boolean;
  canManage: boolean;
  isArchived?: boolean;
}

const MAX_TEXT_LENGTH = 500;

export const GameChatPanel: React.FC<GameChatPanelProps> = ({
  gameId,
  isConfirmedPlayer,
  isOwner,
  canManage,
  isArchived = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { messages, loading, error, hasMore, loadingMore, loadMore, currentUserId } = useGameChat(gameId);
  const { send, sending } = useSendGameMessage(gameId);
  const { remove, deleting } = useDeleteGameMessage(gameId);
  const [draft, setDraft] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const canWrite = (isConfirmedPlayer || isOwner || canManage) && !isArchived;
  const visibleMessages = messages.filter((m) => m.deletedAt === null);

  const scrollToBottom = () => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = listContainerRef.current;
    if (!el) return;
    const threshold = 80;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollToBottom();
    }
  }, [visibleMessages.length]);

  const handleSend = async () => {
    if (draft.trim().length === 0) return;
    try {
      wasAtBottomRef.current = true;
      await send(draft);
      setDraft('');
    } catch {
      // erro já tratado no hook (showError)
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await remove(messageId);
    } catch {
      // erro já tratado no hook
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <ChatIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('gameChat.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('gameChat.description')}</Typography>
          </Box>
          {isArchived && <Chip size="small" color="default" label={t('gameChat.archived')} />}
        </Stack>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && visibleMessages.length === 0 && (
          <EmptyState
            icon={<ChatIcon sx={{ fontSize: 48 }} />}
            title={t('gameChat.emptyTitle')}
            description={t('gameChat.emptyDesc')}
          />
        )}

        {!loading && !error && visibleMessages.length > 0 && (
          <Box
            ref={listContainerRef}
            onScroll={handleScroll}
            sx={{
              mt: 2,
              maxHeight: isMobile ? 320 : 420,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <Button size="small" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <CircularProgress size={18} /> : t('gameChat.loadMore')}
                </Button>
              </Box>
            )}
            <Stack spacing={1} sx={{ px: 0.5 }}>
              {visibleMessages.map((message) => {
                const isOwn = message.senderId === currentUserId;
                const canDelete = canManage || isOwn;
                return (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                    canDelete={canDelete}
                    onDelete={() => handleDelete(message.id)}
                    deleting={deleting}
                  />
                );
              })}
            </Stack>
            <div ref={listEndRef} />
          </Box>
        )}

        {canWrite && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('gameChat.placeholder')}
              fullWidth
              multiline
              maxRows={4}
              inputProps={{ maxLength: MAX_TEXT_LENGTH }}
              helperText={t('common.charCount', { current: draft.length, max: MAX_TEXT_LENGTH })}
              disabled={sending}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={sending || draft.trim().length === 0}
              aria-label={t('gameChat.send')}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25 }}
            >
              {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </IconButton>
          </Box>
        )}

        {!canWrite && !isArchived && !loading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('gameChat.mustConfirm')}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

interface ChatBubbleProps {
  message: {
    id: string;
    senderId: string | null;
    senderName: string;
    senderPhotoUrl: string | null;
    text: string;
    createdAt?: Date;
  };
  isOwn: boolean;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn, canDelete, onDelete, deleting }) => {
  const { t } = useTranslation();
  const time = message.createdAt
    ? message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
    >
      {!isOwn && (
        <Avatar
          src={message.senderPhotoUrl ?? undefined}
          alt={message.senderName}
          sx={{ width: 32, height: 32, mt: 0.25 }}
        >
          {message.senderName.charAt(0).toUpperCase()}
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: { xs: '78%', sm: '68%' },
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: isOwn ? 'primary.main' : 'action.hover',
          color: isOwn ? 'primary.contrastText' : 'text.primary',
        }}
      >
        {!isOwn && (
          <Typography variant="caption" fontWeight={700} component="div" sx={{ mb: 0.25 }}>
            {message.senderName}
          </Typography>
        )}
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.text}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.25 }}>
          {time && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {time}
            </Typography>
          )}
          {canDelete && (
            <IconButton
              size="small"
              onClick={onDelete}
              disabled={deleting}
              aria-label={t('gameChat.delete')}
              sx={{
                opacity: 0.5,
                color: isOwn ? 'inherit' : 'text.secondary',
                '&:hover': { opacity: 1 },
              }}
            >
              {deleting ? <CircularProgress size={12} color="inherit" /> : <DeleteOutlineIcon fontSize="small" />}
            </IconButton>
          )}
        </Stack>
      </Box>
    </Stack>
  );
};
