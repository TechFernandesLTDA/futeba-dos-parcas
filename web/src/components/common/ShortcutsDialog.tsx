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

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const ctrlKey = isMac ? '\u2318' : 'Ctrl';

const shortcuts: Shortcut[] = [
  { keys: [ctrlKey, 'K'], description: 'Busca global / a\u00E7\u00F5es r\u00E1pidas' },
  { keys: [ctrlKey, 'N'], description: 'Criar jogo' },
  { keys: [ctrlKey, '\u21E7', 'N'], description: 'Criar grupo' },
  { keys: [ctrlKey, ','], description: 'Configura\u00E7\u00F5es' },
  { keys: ['?'], description: 'Mostrar este di\u00E1logo de atalhos' },
  { keys: ['Esc'], description: 'Fechar modal ou voltar ao foco anterior' },
];

export const ShortcutsDialog = React.memo(function ShortcutsDialog({
  open,
  onClose,
}: ShortcutsDialogProps) {
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
        Atalhos de Teclado
        <Button onClick={onClose} startIcon={<CloseIcon />} size="small">
          Fechar
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Dica: pressione{' '}
          <Chip label="?" size="small" sx={{ mx: 0.5 }} />{' '}
          a qualquer momento para abrir este di\u00E1logo.
        </Typography>
        <Table size="small">
          <TableBody>
            {shortcuts.map((shortcut) => (
              <TableRow key={shortcut.description} hover>
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
                  <Typography variant="body2">{shortcut.description}</Typography>
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
