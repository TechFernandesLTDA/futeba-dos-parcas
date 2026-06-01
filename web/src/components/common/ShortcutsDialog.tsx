import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  descriptionKey: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const ctrlKey = isMac ? '\u2318' : 'Ctrl';

const shortcuts: Shortcut[] = [
  { keys: [ctrlKey, 'K'], descriptionKey: 'shortcuts.globalSearch' },
  { keys: [ctrlKey, 'N'], descriptionKey: 'shortcuts.createGame' },
  { keys: [ctrlKey, '\u21E7', 'N'], descriptionKey: 'shortcuts.createGroup' },
  { keys: [ctrlKey, ','], descriptionKey: 'shortcuts.settings' },
  { keys: ['?'], descriptionKey: 'shortcuts.showShortcuts' },
  { keys: ['Esc'], descriptionKey: 'shortcuts.closeOrBack' },
];

export const ShortcutsDialog = React.memo(function ShortcutsDialog({
  open,
  onClose,
}: ShortcutsDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="shortcuts-dialog-title"
    >
      <DialogTitle
        id="shortcuts-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {t('shortcuts.title')}
        <Button onClick={onClose} startIcon={<CloseIcon />} size="small" aria-label={t('a11y.close')}>
          {t('common.close')}
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('shortcuts.tip')}
        </Typography>
        <Table size="small">
          <TableBody>
            {shortcuts.map((shortcut) => (
              <TableRow key={shortcut.descriptionKey} hover>
                <TableCell sx={{ border: 'none', width: '40%' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {shortcut.keys.map((key, i) => (
                      <Chip
                        key={i}
                        label={key}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          minWidth: 28,
                          height: 24,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell sx={{ border: 'none' }}>
                  <Typography variant="body2">{t(shortcut.descriptionKey)}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
});

export default ShortcutsDialog;
