/**
 * Pop-up automático "Novidades" — exibido uma vez após o usuário atualizar o
 * web app. Espelha `WhatsNewBottomSheet.kt` do Android.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #22.
 */

import React, { useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ReleaseNote } from '../../types/releaseNotes';
import { ReleaseNoteContent, ReleaseTypeBadge } from './ReleaseNoteContent';
import { trackEvent } from '../../utils/analytics';

interface WhatsNewDialogProps {
  note: ReleaseNote;
  open: boolean;
  onClose: () => void;
}

export const WhatsNewDialog: React.FC<WhatsNewDialogProps> = ({ note, open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Analytics: registra a exibição do pop-up uma vez por abertura.
  useEffect(() => {
    if (open) {
      trackEvent('whats_new_popup_shown', { version: note.version, platform: note.platform });
    }
  }, [open, note.version, note.platform]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      aria-labelledby="whats-new-dialog-title"
    >
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="overline" color="text.secondary">
              {t('whatsNew.popupEyebrow', { version: note.version })}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ReleaseTypeBadge type={note.type} />
              <IconButton
                size="small"
                onClick={onClose}
                aria-label={t('common.close')}
                edge="end"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {note.headline && (
            <Typography id="whats-new-dialog-title" variant="h6" component="h2">
              {note.headline}
            </Typography>
          )}

          <Box>
            <ReleaseNoteContent note={note} showHeadline={false} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="contained" fullWidth onClick={onClose} sx={{ minHeight: 48 }}>
          {t('whatsNew.popupDismiss')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
