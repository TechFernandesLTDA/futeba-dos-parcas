import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import { GameConfirmation } from '../../types/game';
import { PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';

interface GoalkeepersTabProps {
  goalkeepers: GameConfirmation[];
}

const GoalkeepersTab: React.FC<GoalkeepersTabProps> = ({ goalkeepers }) => {
  if (goalkeepers.length === 0) {
    return (
      <EmptyState
        title="Nenhum goleiro"
        description="Nenhum goleiro confirmado ainda"
      />
    );
  }

  return (
    <List disablePadding>
      {goalkeepers.map((player) => (
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

export default GoalkeepersTab;
