import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { GameConfirmation } from '../../types/game';
import { PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';

interface WaitlistTabProps {
  waitlist: GameConfirmation[];
}

const WaitlistTab: React.FC<WaitlistTabProps> = ({ waitlist }) => {
  const { t } = useTranslation();
  if (waitlist.length === 0) {
    return (
      <EmptyState
        icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
        title={t('empty.noWaitlist')}
        description={t('empty.noWaitlistDesc')}
      />
    );
  }

  return (
    <List disablePadding>
      {waitlist.map((player) => (
        <ListItem key={player.id}>
          <ListItemAvatar>
            <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} />
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {player.userName}
                <TeamBadge teamId={player.favoriteTeam} size={18} />
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

export default WaitlistTab;
