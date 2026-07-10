import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  LinearProgress,
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
  uploadProgress?: number | null;
  onSubmit: (text: string, mediaFile?: File) => Promise<void>;
  onCancel?: () => void;
}

export const WallPostComposer: React.FC<WallPostComposerProps> = ({
  initialText = '',
  sending,
  uploadProgress = null,
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
  const [submitFailed, setSubmitFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitInFlightRef = useRef(false);
  const cleanText = text.trim();
  const textRequired = cleanText.length === 0;

  React.useEffect(() => {
    if (!mediaFile) return undefined;
    const objectUrl = URL.createObjectURL(mediaFile);
    setMediaPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubmitFailed(false);
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
  };

  const handleRemoveMedia = () => {
    setSubmitFailed(false);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaDuration(null);
    setMediaPreviewFailed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current || sending) return;
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
    submitInFlightRef.current = true;
    try {
      setSubmitFailed(false);
      await onSubmit(cleanText, mediaFile ?? undefined);
      setText('');
      handleRemoveMedia();
    } catch {
      // The mutation owns the error toast. Keep the draft so the user can retry.
      setSubmitFailed(true);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const isValid = cleanText.length <= MAX_TEXT_LENGTH &&
    (cleanText.length > 0 || Boolean(mediaFile)) &&
    !(mediaFile?.type === 'video/mp4' && mediaDuration !== null && mediaDuration > MAX_VIDEO_DURATION_SECONDS);
  const normalizedUploadProgress = typeof uploadProgress === 'number' && Number.isFinite(uploadProgress)
    ? Math.min(100, Math.max(0, Math.round(uploadProgress)))
    : null;
  const showUploadProgress = sending && Boolean(mediaFile) && normalizedUploadProgress !== null;

  return (
    <Box
      component="section"
      aria-label={t('groupWall.composerLabel')}
      aria-busy={sending}
      sx={{
        width: '100%',
        minWidth: 0,
      }}
    >
      {mediaPreview && mediaFile && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            width: 'fit-content',
            maxWidth: '100%',
            mb: 1,
            py: 0.75,
            pr: 1.5,
            pl: 0.75,
            borderLeft: `3px solid ${theme.palette.primary.main}`,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
          }}
        >
          <Box sx={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
            {mediaFile.type === 'video/mp4' ? (
              <Box
                component="video"
                src={mediaPreview}
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
                  height: '100%',
                  borderRadius: 1,
                  objectFit: 'cover',
                  bgcolor: 'common.black',
                }}
              />
            ) : (
              <Box
                component="img"
                src={mediaPreview}
                alt={t('groupWall.imagePreview')}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  borderRadius: 1,
                  objectFit: 'cover',
                }}
              />
            )}
            <IconButton
              size="small"
              onClick={handleRemoveMedia}
              disabled={sending}
              sx={{
                position: 'absolute',
                top: -7,
                right: -7,
                width: 26,
                height: 26,
                bgcolor: 'background.paper',
                boxShadow: 1,
                '&:hover': { bgcolor: 'background.paper' },
              }}
              aria-label={t('groupWall.removeMedia')}
            >
              <CloseIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Box>
          <Box sx={{ minWidth: 0, maxWidth: 240 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {mediaFile.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('groupWall.mediaReady')}
            </Typography>
            {mediaPreviewFailed && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('groupWall.videoPreviewUnavailable')}
              </Typography>
            )}
            {mediaDuration !== null && mediaDuration > MAX_VIDEO_DURATION_SECONDS && (
              <Typography variant="caption" color="error.main" role="alert" sx={{ display: 'block' }}>
                {t('groupWall.videoTooLong', { max: MAX_VIDEO_DURATION_SECONDS })}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.75, sm: 1 } }}>
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label={t('groupWall.addMedia')}
          color={mediaFile ? 'primary' : 'default'}
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            border: `1px solid ${mediaFile ? theme.palette.primary.main : theme.palette.divider}`,
            bgcolor: mediaFile ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
          }}
        >
          <MediaIcon fontSize="small" />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            size="small"
            placeholder={t('groupWall.placeholder')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setSubmitFailed(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (isValid && !sending) void handleSubmit();
              }
            }}
            inputProps={{ maxLength: MAX_TEXT_LENGTH }}
            InputProps={{
              sx: {
                minHeight: 44,
                alignItems: 'center',
                borderRadius: 2.5,
                bgcolor: 'background.paper',
              },
            }}
            disabled={sending}
            aria-label={t('groupWall.placeholder')}
          />
        </Box>

        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={!isValid || sending}
          aria-label={sending ? t('groupWall.sending') : t('groupWall.send')}
          sx={{
            minWidth: { xs: 44, sm: 112 },
            width: { xs: 44, sm: 'auto' },
            height: 44,
            px: { xs: 0, sm: 2 },
            borderRadius: 2.5,
            flexShrink: 0,
          }}
        >
          {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon fontSize="small" />}
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.75 }}>
            {sending ? t('groupWall.sending') : t('groupWall.send')}
          </Box>
        </Button>
      </Box>

      {showUploadProgress && (
        <Box
          role="status"
          aria-live="polite"
          aria-label={t('groupWall.uploadProgress', { percent: normalizedUploadProgress })}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 0.75,
            ml: { xs: 6.5, sm: 7 },
            mr: { xs: 0, sm: 0.5 },
          }}
        >
          <LinearProgress
            variant="determinate"
            value={normalizedUploadProgress}
            aria-hidden
            sx={{ flex: 1, height: 4, borderRadius: 999 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 34, textAlign: 'right' }}>
            {normalizedUploadProgress}%
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: onCancel ? 'space-between' : 'flex-end',
          minHeight: 24,
          mt: 0.25,
          px: 0.5,
        }}
      >
        {onCancel && (
          <Button onClick={onCancel} disabled={sending} size="small" color="inherit">
            {t('common.cancel')}
          </Button>
        )}
        <Typography
          variant="caption"
          color={text.length >= MAX_TEXT_LENGTH ? 'error.main' : 'text.secondary'}
          aria-live="polite"
        >
          {textRequired && mediaFile
            ? t('groupWall.mediaCaptionOptional')
            : `${text.length}/${MAX_TEXT_LENGTH}`}
        </Typography>
      </Box>

      {submitFailed && (
        <Typography
          role="alert"
          variant="caption"
          color="error.main"
          sx={{ display: 'block', mt: 0.25, px: 0.5 }}
        >
          {t('groupWall.draftPreserved')}
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleMediaSelect}
        hidden
        aria-hidden
      />
    </Box>
  );
};
