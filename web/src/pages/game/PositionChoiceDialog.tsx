import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

type Position = 'GOALKEEPER' | 'FIELD';

interface PositionChoiceDialogProps {
  open: boolean;
  fullScreen: boolean;
  loading: boolean;
  expectedPayment: number;
  totalCost: number;
  playersFull: boolean;
  goalkeepersFull: boolean;
  onClose: () => void;
  onConfirm: (position: Position) => Promise<void>;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function PositionChoiceDialog({
  open,
  fullScreen,
  loading,
  expectedPayment,
  totalCost,
  playersFull,
  goalkeepersFull,
  onClose,
  onConfirm,
}: PositionChoiceDialogProps) {
  const { t } = useTranslation();
  const [submittingPosition, setSubmittingPosition] = useState<Position | null>(null);
  const submittingRef = useRef(false);
  const busy = loading || submittingPosition !== null;

  const handleClose = () => {
    if (!busy) onClose();
  };

  const handleConfirm = async (position: Position) => {
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmittingPosition(position);
    try {
      await onConfirm(position);
    } finally {
      submittingRef.current = false;
      setSubmittingPosition(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="position-dialog-title"
    >
      <DialogTitle id="position-dialog-title">{t('games.detail.choosePosition')}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={700}>
            {t('games.detail.confirmationPrice', {
              value: currencyFormatter.format(expectedPayment),
            })}
          </Typography>
          {totalCost > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t('games.detail.totalCostDescription', {
                value: currencyFormatter.format(totalCost),
              })}
            </Typography>
          )}
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, pt: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => handleConfirm('FIELD')}
            disabled={busy || playersFull}
            startIcon={submittingPosition === 'FIELD' ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t('games.detail.fieldPlayer')}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => handleConfirm('GOALKEEPER')}
            disabled={busy || playersFull || goalkeepersFull}
            startIcon={submittingPosition === 'GOALKEEPER' ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t('profile.goalkeeper')}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
