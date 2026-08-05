import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import CommentsIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import ReplyIcon from '@mui/icons-material/Reply';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/common/EmptyState';
import { ReactionBar } from '../../components/reactions/ReactionBar';
import { useToast } from '../../contexts/ToastContext';
import {
  GAME_COMMENT_MAX_LENGTH,
  GameComment,
  GameCommentContext,
  useGameComments,
} from '../../hooks/useGameComments';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { buildGameCommentThreads } from './gameCommentThreads';

interface GameCommentsPanelProps {
  gameId: string;
  canWrite: boolean;
  canManage: boolean;
  context?: GameCommentContext;
  maxLength?: number;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDesc?: string;
}

export const GameCommentsPanel: React.FC<GameCommentsPanelProps> = ({
  gameId,
  canWrite,
  canManage,
  context = 'game',
  maxLength,
  title,
  description,
  emptyTitle,
  emptyDesc,
}) => {
  const { t } = useTranslation();
  const { showError } = useToast();
  const {
    comments,
    loading,
    error,
    hasMore,
    loadingMore,
    saving,
    loadMore,
    addComment,
    editComment,
    deleteComment,
    currentUserId,
    maxLength: hookMaxLength,
  } = useGameComments(gameId, context);
  const commentMaxLength = maxLength ?? hookMaxLength ?? GAME_COMMENT_MAX_LENGTH;
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<GameComment | null>(null);

  const commentThreads = useMemo(
    () => buildGameCommentThreads(comments, context),
    [comments, context],
  );

  const handleSubmit = async () => {
    if (draft.trim().length === 0) return;
    try {
      await addComment(draft, replyTo?.id ?? null);
      setDraft('');
      setReplyTo(null);
    } catch (err) {
      showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CommentsIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {title ?? t('gameComments.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description ?? t('gameComments.description')}
            </Typography>
          </Box>
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

        {!loading && !error && commentThreads.length === 0 && (
          <EmptyState
            icon={<CommentsIcon sx={{ fontSize: 48 }} />}
            title={emptyTitle ?? t('gameComments.emptyTitle')}
            description={emptyDesc ?? t('gameComments.emptyDesc')}
          />
        )}

        {!loading && !error && commentThreads.length > 0 && (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button size="small" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <CircularProgress size={18} /> : t('gameComments.loadMore')}
                </Button>
              </Box>
            )}
            {commentThreads.map((thread) => {
              const threadId = thread.parent?.id ?? thread.replies[0]?.parentId ?? thread.replies[0]?.id;
              return thread.parent ? (
                <CommentThread
                  key={threadId}
                  gameId={gameId}
                  comment={thread.parent}
                  replies={thread.replies}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  canWrite={canWrite}
                  saving={saving}
                  onReply={() => setReplyTo(thread.parent)}
                  onEdit={editComment}
                  onDelete={deleteComment}
                />
              ) : (
                <UnavailableParentThread
                  key={threadId}
                  gameId={gameId}
                  replies={thread.replies}
                  reason={thread.parentUnavailable ?? 'missing'}
                  currentUserId={currentUserId}
                  canManage={canManage}
                  saving={saving}
                  onEdit={editComment}
                  onDelete={deleteComment}
                />
              );
            })}
          </Stack>
        )}

        {replyTo && (
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            onClose={() => setReplyTo(null)}
          >
            {t('gameComments.replyingTo', { name: replyTo.authorName })}
          </Alert>
        )}

        {canWrite ? (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={replyTo ? t('gameComments.replyPlaceholder') : t('gameComments.placeholder')}
              fullWidth
              multiline
              maxRows={4}
              inputProps={{ maxLength: commentMaxLength }}
              helperText={t('common.charCount', { current: draft.length, max: commentMaxLength })}
              disabled={saving}
            />
            <IconButton
              color="primary"
              onClick={handleSubmit}
              disabled={saving || draft.trim().length === 0}
              aria-label={t('gameComments.send')}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25 }}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </IconButton>
          </Box>
        ) : !loading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('gameComments.mustConfirm')}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

interface UnavailableParentThreadProps {
  gameId: string;
  replies: GameComment[];
  reason: 'deleted' | 'missing';
  currentUserId: string | null;
  canManage: boolean;
  saving: boolean;
  onEdit: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

const UnavailableParentThread: React.FC<UnavailableParentThreadProps> = ({
  gameId,
  replies,
  reason,
  currentUserId,
  canManage,
  saving,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <Alert severity="info" variant="outlined">
        {t(reason === 'deleted' ? 'gameComments.parentDeleted' : 'gameComments.parentUnavailable')}
      </Alert>
      <Stack spacing={1} sx={{ pl: { xs: 2, sm: 6 } }}>
        {replies.map((reply) => (
          <CommentItem
            key={reply.id}
            gameId={gameId}
            comment={reply}
            currentUserId={currentUserId}
            canManage={canManage}
            canWrite={false}
            saving={saving}
            onReply={() => undefined}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Stack>
    </Stack>
  );
};

interface CommentThreadProps {
  gameId: string;
  comment: GameComment;
  replies: GameComment[];
  currentUserId: string | null;
  canManage: boolean;
  canWrite: boolean;
  saving: boolean;
  onReply: () => void;
  onEdit: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

const CommentThread: React.FC<CommentThreadProps> = ({
  gameId,
  comment,
  replies,
  currentUserId,
  canManage,
  canWrite,
  saving,
  onReply,
  onEdit,
  onDelete,
}) => (
  <Stack spacing={1}>
    <CommentItem
      gameId={gameId}
      comment={comment}
      currentUserId={currentUserId}
      canManage={canManage}
      canWrite={canWrite}
      saving={saving}
      onReply={onReply}
      onEdit={onEdit}
      onDelete={onDelete}
    />
    {replies.length > 0 && (
      <Stack spacing={1} sx={{ pl: { xs: 2, sm: 6 } }}>
        {replies.map((reply) => (
          <CommentItem
            key={reply.id}
            gameId={gameId}
            comment={reply}
            currentUserId={currentUserId}
            canManage={canManage}
            canWrite={false}
            saving={saving}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Stack>
    )}
  </Stack>
);

interface CommentItemProps {
  gameId: string;
  comment: GameComment;
  currentUserId: string | null;
  canManage: boolean;
  canWrite: boolean;
  saving: boolean;
  onReply: () => void;
  onEdit: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

const CommentItem: React.FC<CommentItemProps> = ({
  gameId,
  comment,
  currentUserId,
  canManage,
  canWrite,
  saving,
  onReply,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showError } = useToast();
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.text);
  const isOwn = comment.authorId === currentUserId;
  const canEdit = isOwn;
  const canDelete = isOwn || canManage;
  const time = comment.createdAt
    ? comment.createdAt.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  const handleEdit = async () => {
    try {
      await onEdit(comment.id, editDraft);
      setEditing(false);
    } catch (err) {
      showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(comment.id);
    } catch (err) {
      showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err));
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.background.paper, 0.78),
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Avatar src={comment.authorPhotoUrl ?? undefined} alt={comment.authorName} sx={{ width: 36, height: 36 }}>
          {comment.authorName.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {comment.authorName}
            </Typography>
            {time && (
              <Typography variant="caption" color="text.secondary">
                {time}
              </Typography>
            )}
            {comment.editedAt && (
              <Typography variant="caption" color="text.secondary">
                {t('gameComments.edited')}
              </Typography>
            )}
          </Stack>

          {editing ? (
            <Stack spacing={1}>
              <TextField
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                fullWidth
                multiline
                maxRows={4}
                inputProps={{ maxLength: GAME_COMMENT_MAX_LENGTH }}
                helperText={t('common.charCount', { current: editDraft.length, max: GAME_COMMENT_MAX_LENGTH })}
                disabled={saving}
              />
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" onClick={handleEdit} disabled={saving || editDraft.trim().length === 0}>
                  {t('common.save')}
                </Button>
                <Button size="small" onClick={() => setEditing(false)} disabled={saving}>
                  {t('common.cancel')}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {comment.text}
            </Typography>
          )}

          {!editing && (
            <>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                <ReactionBar
                  targetPath={`games/${gameId}/comments/${comment.id}`}
                  reactions={comment.reactions}
                />
                {canWrite && (
                  <Tooltip title={t('gameComments.reply')}>
                    <IconButton size="small" onClick={onReply} aria-label={t('gameComments.reply')}>
                      <ReplyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip title={t('common.edit')}>
                    <IconButton size="small" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && (
                  <Tooltip title={t('common.delete')}>
                    <IconButton size="small" onClick={handleDelete} disabled={saving} aria-label={t('common.delete')}>
                      {saving ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </>
          )}
        </Box>
      </Stack>
    </Box>
  );
};
