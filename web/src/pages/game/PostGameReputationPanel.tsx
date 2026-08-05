import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Rating,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Handshake as HandshakeIcon,
  Shield as RespectIcon,
  TaskAlt as CommitmentIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { GameConfirmation } from '../../types/game';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import { usePostGameReputation } from '../../hooks/usePostGameReputation';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';

interface PostGameReputationPanelProps {
  gameId: string;
  confirmations: GameConfirmation[];
  currentUserId?: string | null;
  canWrite: boolean;
}

const DEFAULT_SCORE = 5;

export const PostGameReputationPanel: React.FC<PostGameReputationPanelProps> = ({
  gameId,
  confirmations,
  currentUserId,
  canWrite,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const {
    reviews,
    reviewsByTarget,
    loading,
    savingTargetId,
    error,
    refetch,
    saveReview,
  } = usePostGameReputation(gameId, canWrite);

  const candidates = useMemo(
    () => confirmations
      .filter((confirmation) =>
        confirmation.status === 'CONFIRMED' &&
        confirmation.userId !== currentUserId
      )
      .sort((a, b) => a.userName.localeCompare(b.userName)),
    [confirmations, currentUserId],
  );

  const [targetUserId, setTargetUserId] = useState('');
  const [punctuality, setPunctuality] = useState(DEFAULT_SCORE);
  const [respect, setRespect] = useState(DEFAULT_SCORE);
  const [commitment, setCommitment] = useState(DEFAULT_SCORE);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!targetUserId && candidates.length > 0) {
      setTargetUserId(candidates[0].userId);
    }
  }, [candidates, targetUserId]);

  useEffect(() => {
    const existing = reviewsByTarget.get(targetUserId);
    if (!existing) {
      setPunctuality(DEFAULT_SCORE);
      setRespect(DEFAULT_SCORE);
      setCommitment(DEFAULT_SCORE);
      setComment('');
      return;
    }

    setPunctuality(existing.punctuality);
    setRespect(existing.respect);
    setCommitment(existing.commitment);
    setComment(existing.comment);
  }, [reviewsByTarget, targetUserId]);

  const selectedCandidate = candidates.find((candidate) => candidate.userId === targetUserId);
  const selectedAlreadyReviewed = !!reviewsByTarget.get(targetUserId);

  if (!canWrite && reviews.length === 0) {
    return null;
  }

  const handleSave = async () => {
    try {
      await saveReview({
        targetUserId,
        punctuality,
        respect,
        commitment,
        comment,
      });
      showSuccess(t('postGameReputation.saveSuccess'));
    } catch (err) {
      showError(getFunctionsErrorMessage(err, 'submitPostGameReputation'));
    }
  };

  const RatingRow = ({
    icon,
    label,
    value,
    onChange,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    onChange: (value: number) => void;
  }) => (
    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="body2">{label}</Typography>
      </Stack>
      <Rating
        value={value}
        onChange={(_, nextValue) => onChange(nextValue || DEFAULT_SCORE)}
        disabled={!!savingTargetId}
      />
    </Stack>
  );

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
            <HandshakeIcon />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('postGameReputation.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('postGameReputation.description')}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={t('postGameReputation.sentCount', { count: reviews.length })}
          />
        </Stack>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={refetch}>{t('common.retry')}</Button>}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={<HandshakeIcon sx={{ fontSize: 48 }} />}
            title={t('postGameReputation.emptyTitle')}
            description={t('postGameReputation.emptyDescription')}
          />
        ) : (
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="post-game-reputation-player-label">
                {t('postGameReputation.playerLabel')}
              </InputLabel>
              <Select
                labelId="post-game-reputation-player-label"
                value={targetUserId}
                label={t('postGameReputation.playerLabel')}
                onChange={(event) => setTargetUserId(event.target.value)}
                disabled={!!savingTargetId}
              >
                {candidates.map((candidate) => (
                  <MenuItem key={candidate.userId} value={candidate.userId}>
                    {candidate.userName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedCandidate && (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar src={selectedCandidate.userPhoto} alt={selectedCandidate.userName}>
                    {selectedCandidate.userName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {selectedCandidate.userName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedAlreadyReviewed
                        ? t('postGameReputation.alreadyReviewed')
                        : t('postGameReputation.reviewHint')}
                    </Typography>
                  </Box>
                </Stack>

                <RatingRow
                  icon={<TimeIcon color="info" />}
                  label={t('postGameReputation.criteria.punctuality')}
                  value={punctuality}
                  onChange={setPunctuality}
                />
                <RatingRow
                  icon={<RespectIcon color="success" />}
                  label={t('postGameReputation.criteria.respect')}
                  value={respect}
                  onChange={setRespect}
                />
                <RatingRow
                  icon={<CommitmentIcon color="primary" />}
                  label={t('postGameReputation.criteria.commitment')}
                  value={commitment}
                  onChange={setCommitment}
                />

                <TextField
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  label={t('postGameReputation.commentLabel')}
                  placeholder={t('postGameReputation.commentPlaceholder')}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  inputProps={{ maxLength: 160 }}
                  helperText={t('common.charCount', { current: comment.length, max: 160 })}
                  disabled={!!savingTargetId}
                />

                <Button
                  variant="contained"
                  startIcon={savingTargetId === targetUserId ? <CircularProgress size={16} color="inherit" /> : <HandshakeIcon />}
                  onClick={handleSave}
                  disabled={!targetUserId || !!savingTargetId}
                >
                  {savingTargetId === targetUserId
                    ? t('common.saving')
                    : t(selectedAlreadyReviewed ? 'postGameReputation.update' : 'postGameReputation.save')}
                </Button>
              </Stack>
            )}

            {reviews.length > 0 && (
              <>
                <Divider />
                <List disablePadding aria-label={t('postGameReputation.sentListAria')}>
                  {reviews.map((review) => {
                    const candidate = candidates.find((item) => item.userId === review.targetUserId);
                    return (
                      <ListItem key={review.id} disableGutters>
                        <ListItemAvatar>
                          <Avatar src={candidate?.userPhoto} alt={candidate?.userName ?? ''}>
                            {(candidate?.userName ?? '?').charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={candidate?.userName ?? t('common.player')}
                          secondary={t('postGameReputation.sentSummary', { score: review.overall.toFixed(1) })}
                        />
                        <Chip size="small" color="success" label={t('postGameReputation.sent')} />
                      </ListItem>
                    );
                  })}
                </List>
              </>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
