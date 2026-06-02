import React from 'react';
import {
  Box,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import { GameConfirmation, PAYMENT_STATUS_CONFIG } from '../../types/game';
import { PlayerAvatar, StatusChip, EmptyState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useTranslation } from 'react-i18next';

interface ConfirmedPlayersTabProps {
  players: GameConfirmation[];
}

const ConfirmedPlayersTab: React.FC<ConfirmedPlayersTabProps> = ({ players }) => {
  const { t } = useTranslation();
  if (players.length === 0) {
    return (
      <EmptyState
        icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
        title="Nenhum jogador confirmado"
        description="Seja o primeiro a confirmar presença!"
      />
    );
  }

  return (
    <List disablePadding aria-label={t('a11y.confirmedPlayers')}>
      {players.map((player, index) => (
        <ListItem
          key={player.id}
          divider={index < players.length - 1}
          secondaryAction={
            <StatusChip status={player.paymentStatus} config={PAYMENT_STATUS_CONFIG} />
          }
        >
          <ListItemAvatar>
            <PlayerAvatar
              name={player.userName}
              photoUrl={player.userPhoto}
              size={44}
            />
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">{player.userName}</Typography>
                <TeamBadge teamId={player.favoriteTeam} size={18} />
                {player.position === 'GOALKEEPER' && (
                  <Chip label="GK" size="small" color="primary" sx={{ height: 18 }} />
                )}
              </Box>
            }
            secondary={`#${player.confirmationOrder ?? (index + 1)}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default ConfirmedPlayersTab;
