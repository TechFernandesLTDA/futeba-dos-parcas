import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Button,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Send as SendIcon,
  PermMedia as MediaIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useToast } from '../../contexts/ToastContext';

const MAX_TEXT_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 30;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

interface WallPostComposerProps {
  initialText?: string;
  sending: boolean;
  onSubmit: (text: string, mediaFile?: File) => Promise<void>;
  onCancel?: () => void;
}

export const WallPostComposer: React.FC<WallPostComposerProps> = ({
  initialText = '',
  sending,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { showError } = useToast();
  const theme = useTheme();
  const [text, setText] = useState(initialText);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [mediaPreviewFailed, setMediaPreviewFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanText = text.trim();
  const textRequired = cleanText.length === 0;

  React.useEffect(() => {
    if (mediaFile?.type !== 'video/mp4') return undefined;
    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError(t('groupWall.invalidMediaType'));
      event.target.value = '';
      return;
    }
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
    if (file.size >= (isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES)) {
      showError(t(isVideo ? 'groupWall.videoTooLarge' : 'groupWall.imageTooLarge'));
      event.target.value = '';
      return;
    }
    setMediaFile(file);
    setMediaDuration(null);
    setMediaPreviewFailed(false);
    if (isVideo) {
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaDuration(null);
    setMediaPreviewFailed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    const cleanText = text.trim();
    if (cleanText.length > MAX_TEXT_LENGTH) return;
    if (cleanText.length === 0 && !mediaFile) {
      showError(t('groupWall.textRequired'));
      return;
    }
    if (mediaFile?.type === 'video/mp4' && mediaDuration !== null && mediaDuration > MAX_VIDEO_DURATION_SECONDS) {
      showError(t('groupWall.videoTooLong', { max: MAX_VIDEO_DURATION_SECONDS }));
      return;
    }
    try {
      await onSubmit(cleanText, mediaFile ?? undefined);
      setText('');
      handleRemoveMedia();
    } catch {
      // The mutation owns the error toast. Keep the draft so the user can retry.
    }
  };

  const isValid = cleanText.length <= MAX_TEXT_LENGTH &&
    (cleanText.length > 0 || Boolean(mediaFile)) &&
    !(mediaFile?.type === 'video/mp4' && mediaDuration !== null && mediaDuration > MAX_VIDEO_DURATION_SECONDS);

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
      }}
    >
      <TextField
        fullWidth
        multiline
        minRows={2}
        maxRows={5}
        placeholder={t('groupWall.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (isValid && !sending) void handleSubmit();
          }
        }}
        inputProps={{ maxLength: MAX_TEXT_LENGTH }}
        disabled={sending}
        aria-label={t('groupWall.placeholder')}
        helperText={textRequired && mediaFile ? t('groupWall.mediaCaptionOptional') : ' '}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {text.length}/{MAX_TEXT_LENGTH}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onCancel && (
            <Button onClick={onCancel} disabled={sending} size="small">
              {t('common.cancel')}
            </Button>
          )}
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label={t('groupWall.addMedia')}
            color={mediaFile ? 'primary' : 'default'}
          >
            <MediaIcon />
          </IconButton>
          <IconButton
            onClick={() => void handleSubmit()}
            disabled={!isValid || sending}
            aria-label={t('groupWall.send')}
            color="primary"
          >
            {sending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Box>
      </Box>

      {mediaPreview && mediaFile?.type === 'video/mp4' && (
        <Box sx={{ position: 'relative', mt: 2 }}>
          <Box
            component="video"
            src={mediaPreview}
            controls
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event: React.SyntheticEvent<HTMLVideoElement>) => {
              const duration = event.currentTarget.duration;
              setMediaDuration(Number.isFinite(duration) ? duration : null);
            }}
            onError={() => setMediaPreviewFailed(true)}
            aria-label={t('groupWall.videoPreview')}
            sx={{
              display: 'block',
              width: '100%',
              maxHeight: 240,
              borderRadius: 1,
              bgcolor: theme.palette.common.black,
            }}
          />
          {mediaPreviewFailed && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('groupWall.videoPreviewUnavailable')}
            </Typography>
          )}
          {mediaDuration !== null && mediaDuration > MAX_VIDEO_DURATION_SECONDS && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {t('groupWall.videoTooLong', { max: MAX_VIDEO_DURATION_SECONDS })}
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={handleRemoveMedia}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: theme.palette.background.paper,
              boxShadow: theme.shadows[1],
            }}
            aria-label={t('groupWall.removeMedia')}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {mediaPreview && mediaFile?.type.startsWith('image/') && (
        <Box sx={{ position: 'relative', mt: 2, display: 'inline-block' }}>
          <Box
            component="img"
            src={mediaPreview}
            alt={t('groupWall.imagePreview')}
            sx={{
              height: 120,
              width: 'auto',
              borderRadius: 1,
              objectFit: 'cover',
            }}
          />
          <IconButton
            size="small"
            onClick={handleRemoveMedia}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: theme.palette.background.paper,
              boxShadow: theme.shadows[1],
            }}
            aria-label={t('groupWall.removeMedia')}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleMediaSelect}
        style={{ display: 'none' }}
        aria-hidden
      />
    </Box>
  );
};
