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
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useToast } from '../../contexts/ToastContext';

const MAX_TEXT_LENGTH = 500;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface WallPostComposerProps {
  initialText?: string;
  sending: boolean;
  onSubmit: (text: string, imageFile?: File) => void;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanText = text.trim();
  const textRequired = cleanText.length === 0;

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError(t('groupWall.invalidImageType'));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      showError(t('groupWall.imageTooLarge'));
      event.target.value = '';
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    const cleanText = text.trim();
    if (cleanText.length > MAX_TEXT_LENGTH) return;
    if (cleanText.length === 0) {
      showError(t('groupWall.textRequired'));
      return;
    }
    onSubmit(cleanText, imageFile ?? undefined);
    setText('');
    handleRemoveImage();
  };

  const isValid = cleanText.length <= MAX_TEXT_LENGTH && cleanText.length > 0;

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
            if (isValid && !sending) handleSubmit();
          }
        }}
        inputProps={{ maxLength: MAX_TEXT_LENGTH }}
        disabled={sending}
        aria-label={t('groupWall.placeholder')}
        error={textRequired && !!imageFile}
        helperText={textRequired && !!imageFile ? t('groupWall.textRequired') : ' '}
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
            aria-label={t('groupWall.addPhoto')}
            color={imageFile ? 'primary' : 'default'}
          >
            <ImageIcon />
          </IconButton>
          <IconButton
            onClick={handleSubmit}
            disabled={!isValid || sending}
            aria-label={t('groupWall.send')}
            color="primary"
          >
            {sending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Box>
      </Box>

      {imagePreview && (
        <Box sx={{ position: 'relative', mt: 2, display: 'inline-block' }}>
          <Box
            component="img"
            src={imagePreview}
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
            onClick={handleRemoveImage}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: theme.palette.background.paper,
              boxShadow: theme.shadows[1],
            }}
            aria-label={t('groupWall.removePhoto')}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleImageSelect}
        style={{ display: 'none' }}
        aria-hidden
      />
    </Box>
  );
};
