/**
 * Pop-up automático "Novidades" — exibido uma vez após o usuário atualizar o
 * web app. Espelha `WhatsNewBottomSheet.kt` do Android.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #22.
 *
 * #4189 (a11y): o pop-up aparece sem ação do usuário, então NÃO pode ser um
 * `Dialog` modal do MUI — o Modal marca todos os irmãos do portal (inclusive
 * `<main>`) com `aria-hidden="true"`, escondendo a página inteira de leitores
 * de tela. Aqui é um painel não-modal (`role="dialog"` + `aria-modal="false"`)
 * ancorado no rodapé: o conteúdo da página continua exposto na árvore de
 * acessibilidade, o foco vai para o painel ao abrir e Esc fecha.
 */

import React, { useEffect, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Slide,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ReleaseNote } from '../../types/releaseNotes';
import { FormattedText, ReleaseNoteContent, ReleaseTypeBadge } from './ReleaseNoteContent';
import { trackEvent } from '../../utils/analytics';

interface WhatsNewDialogProps {
  note: ReleaseNote;
  open: boolean;
  onClose: () => void;
}

export const WhatsNewDialog: React.FC<WhatsNewDialogProps> = ({ note, open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  // Analytics: registra a exibição do pop-up uma vez por abertura.
  useEffect(() => {
    if (open) {
      trackEvent('whats_new_popup_shown', { version: note.version, platform: note.platform });
    }
  }, [open, note.version, note.platform]);

  // Painel não-modal: leva o foco para ele ao abrir (leitores de tela anunciam o
  // conteúdo) e fecha com Esc em qualquer ponto da página enquanto estiver aberto.
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const labelledBy = note.headline ? 'whats-new-dialog-title' : 'whats-new-dialog-eyebrow';

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Paper
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        elevation={12}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          mx: 'auto',
          width: { xs: '100%', sm: 520 },
          maxWidth: '100%',
          maxHeight: '85dvh',
          overflowY: 'auto',
          zIndex: theme.zIndex.snackbar,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          outline: 'none',
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <Box sx={{ px: 3, pt: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography id="whats-new-dialog-eyebrow" variant="overline" color="text.secondary">
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
                <FormattedText text={note.headline} />
              </Typography>
            )}

            <Box>
              <ReleaseNoteContent note={note} showHeadline={false} />
            </Box>
          </Stack>
        </Box>
        <Box sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button variant="contained" fullWidth onClick={onClose} sx={{ minHeight: 48 }}>
            {t('whatsNew.popupDismiss')}
          </Button>
        </Box>
      </Paper>
    </Slide>
  );
};
