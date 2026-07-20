import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import type { GameConfirmation } from '../../types/game';
import { PlayerAvatar } from '../../components/common/GameCard';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { confirmPlayerAsManager } from '../../services/cloudFunctions';
import { useQueryClient } from '@tanstack/react-query';

interface PendingPlayersSectionProps {
  gameId: string;
  pendingPlayers: GameConfirmation[];
}

export const PendingPlayersSection: React.FC<PendingPlayersSectionProps> = ({ gameId, pendingPlayers }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (pendingPlayers.length === 0) return null;

  const handleConfirm = async (userId: string, userName: string) => {
    setConfirmingId(userId);
    try {
      await confirmPlayerAsManager({ gameId, userId });
      showSuccess(t('games.detail.playerConfirmedByManager', { name: userName }));
      await queryClient.invalidateQueries({ queryKey: ['gameDetail', gameId] });
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Alert severity="info" sx={{ mb: 1, py: 0.5 }} icon={<HourglassEmptyIcon />}>
        <Typography variant="body2" fontWeight={700}>
          {t('games.detail.pendingPlayers', { count: pendingPlayers.length })}
        </Typography>
      </Alert>
      <List disablePadding dense>
        {pendingPlayers.map((player) => (
          <ListItem
            key={player.id}
            divider
            sx={{
              px: { xs: 0.5, sm: 2 },
              py: 1,
              alignItems: { xs: 'stretch', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                width: { xs: '100%', sm: 'auto' },
                flex: 1,
              }}
            >
              <ListItemAvatar sx={{ minWidth: 44 }}>
                <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} size={36} />
              </ListItemAvatar>
              <ListItemText
                sx={{ minWidth: 0, my: 0 }}
                primary={(
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                      {player.userName}
                    </Typography>
                    {player.position === 'GOALKEEPER' && (
                      <Chip label="GK" size="small" color="primary" sx={{ height: 18, flexShrink: 0 }} />
                    )}
                  </Box>
                )}
              />
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={confirmingId === player.userId ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
              onClick={() => handleConfirm(player.userId, player.userName)}
              disabled={confirmingId !== null}
              sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
            >
              {t('common.confirm')}
            </Button>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
