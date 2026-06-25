import React from 'react';
import {
  Dialog,
  DialogContent,
  useMediaQuery,
  useTheme,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { SearchPanel } from './SearchPanel';
import { useTranslation } from 'react-i18next';

interface CommandPaletteProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Command Palette global — acessível via Cmd+K (Mac) / Ctrl+K (Win/Linux).
 *
 * - Desktop (md+): Dialog centralizado 640px, altura 60vh, posicionado no topo da viewport
 * - Mobile (<md): fullscreen
 * - ESC fecha (nativo MUI Dialog)
 * - Click backdrop fecha (nativo MUI Dialog)
 * - Focus trap automático (nativo MUI Dialog)
 * - ↑↓ e Enter gerenciados pelo SearchPanel interno
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth={false}
      aria-label={t('a11y.globalSearchCommands')}
      aria-modal="true"
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 640,
          maxWidth: isMobile ? '100%' : 640,
          height: isMobile ? '100%' : '60vh',
          maxHeight: isMobile ? '100%' : '60vh',
          m: isMobile ? 0 : 4,
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // Previne rubber-band scroll no body em iOS Safari quando fullScreen
          overscrollBehavior: 'contain',
        },
      }}
      sx={{
        // Posiciona o Dialog no topo (estilo Spotlight/Linear) em desktop
        '& .MuiDialog-container': {
          alignItems: { xs: 'flex-start', md: 'flex-start' },
          pt: { xs: 0, md: '10vh' },
        },
      }}
    >
      {/* Header com label e botão fechar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          pt: 1.5,
          pb: 0,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: 1, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {t('commandPalette.globalSearch')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            component="kbd"
            aria-hidden="true"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.default',
              fontFamily: 'inherit',
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            Esc
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label={t('a11y.closeSearch')}
            edge="end"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* SearchPanel ocupa todo espaço restante */}
      <DialogContent
        sx={{
          p: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          '&.MuiDialogContent-root': { pt: 0 },
        }}
      >
        <SearchPanel onClose={onClose} autoFocus={open} />
      </DialogContent>
    </Dialog>
  );
};
