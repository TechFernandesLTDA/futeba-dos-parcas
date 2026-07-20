import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { Game } from '../../types/game';
import type { UseGameRidesResult } from '../../hooks/useGameRides';
import { GameRidesPanel } from './GameRidesPanel';

interface GameRidesDialogProps {
  open: boolean;
  onClose: () => void;
  game: Game;
  canUse: boolean;
  ridesApi: UseGameRidesResult;
}

export const GameRidesDialog: React.FC<GameRidesDialogProps> = ({ open, onClose, game, canUse, ridesApi }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="subtitle1" fontWeight={700} component="span">
          {t('gameRides.title')}
        </Typography>
        <IconButton onClick={onClose} aria-label={t('common.close')} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <GameRidesPanel game={game} canUse={canUse} ridesApi={ridesApi} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
