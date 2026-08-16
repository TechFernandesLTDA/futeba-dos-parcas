import React from 'react';
import { Avatar, Tooltip } from '@mui/material';
import { useTeams } from '../../contexts/TeamsContext';

interface TeamBadgeProps {
  teamId?: string | null;
  size?: number;
}

// Perf #perf: memoizado — renderizado dentro de cada item de lista (ranking,
// jogadores, liga). Props são primitivas (teamId/size), então o memo efetivamente
// pula re-renders quando o item pai memoizado não re-renderiza.
export const TeamBadge: React.FC<TeamBadgeProps> = React.memo(({ teamId, size = 24 }) => {
  const { teamsById } = useTeams();

  if (!teamId) return null;

  const team = teamsById.get(teamId);
  if (!team) return null;

  const badge = team.badgeUrl ? (
    <Avatar
      src={team.badgeUrl}
      alt={team.name}
      slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
      sx={{
        width: size,
        height: size,
        '& img': { objectFit: 'contain' },
      }}
    />
  ) : (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        bgcolor: 'primary.light',
        color: 'primary.contrastText',
      }}
    >
      {team.shortName || team.name.substring(0, 2).toUpperCase()}
    </Avatar>
  );

  return (
    <Tooltip title={team.name} arrow>
      {badge}
    </Tooltip>
  );
});
