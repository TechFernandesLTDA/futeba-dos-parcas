import React from 'react';
import { Box, Typography, Button, SxProps, Theme } from '@mui/material';
import {
  SportsSoccer as GamesIcon,
  People as GroupsIcon,
  EmojiEvents as TrophyIcon,
  NotificationsNone as NotificationsIcon,
  SearchOff as SearchIcon,
  PersonOff as NoPlayersIcon,
  ShieldOutlined as NoBadgesIcon,
  EditCalendar as NoScheduleIcon,
  MapOutlined as MapIcon,
  StarBorder as StarIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  actionVariant?: 'contained' | 'outlined' | 'text';
  animate?: boolean;
  sx?: SxProps<Theme>;
}

const EmptyStateBase = React.memo(function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  actionVariant = 'contained',
  animate = true,
  sx,
}: EmptyStateProps) {
  return (
    <Box
      sx={[{
        textAlign: 'center',
        py: 8,
        px: 2,
        ...(animate && {
          animation: 'emptyFadeIn 0.3s ease-out',
          '@keyframes emptyFadeIn': {
            from: { opacity: 0, transform: 'translateY(8px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }),
      }, ...(Array.isArray(sx) ? sx : [sx])]}
      role="status"
      aria-label={title}
    >
      <Box sx={{
        mb: 2,
        width: 80,
        height: 80,
        borderRadius: '50%',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        '& > *': { fontSize: 40, color: 'text.disabled' },
      }}>
        {icon}
      </Box>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2, maxWidth: 320, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button
          variant={actionVariant}
          startIcon={actionIcon}
          onClick={onAction}
          sx={{ mt: 1 }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
});

// Contextual empty state variants
interface ContextualEmptyProps {
  onAction?: () => void;
  actionLabel?: string;
  description?: string;
  sx?: SxProps<Theme>;
}

type ContextualVariant = React.NamedExoticComponent<ContextualEmptyProps>;

interface EmptyStateType extends React.NamedExoticComponent<EmptyStateProps> {
  Games: ContextualVariant;
  Groups: ContextualVariant;
  Players: ContextualVariant;
  Notifications: ContextualVariant;
  Search: ContextualVariant;
  Ranking: ContextualVariant;
  Badges: ContextualVariant;
  League: ContextualVariant;
  Schedules: ContextualVariant;
  Locations: ContextualVariant;
  Challenges: ContextualVariant;
}

const defaultProps = {
  Games: { icon: GamesIcon, titleKey: 'empty.games' },
  Groups: { icon: GroupsIcon, titleKey: 'empty.groups' },
  Players: { icon: NoPlayersIcon, titleKey: 'empty.players' },
  Notifications: { icon: NotificationsIcon, titleKey: 'empty.notifications' },
  Search: { icon: SearchIcon, titleKey: 'empty.search' },
  Ranking: { icon: TrophyIcon, titleKey: 'empty.ranking' },
  Badges: { icon: NoBadgesIcon, titleKey: 'empty.badges' },
  League: { icon: TrophyIcon, titleKey: 'empty.league' },
  Schedules: { icon: NoScheduleIcon, titleKey: 'empty.schedules' },
  Locations: { icon: MapIcon, titleKey: 'empty.locations' },
  Challenges: { icon: StarIcon, titleKey: 'empty.challenges' },
} as const;

function createEmptyVariant(
  key: keyof typeof defaultProps,
  defaultDescriptionKey: string,
  defaultActionLabelKey: string,
): ContextualVariant {
  const { icon: Icon, titleKey } = defaultProps[key];
  const Component = React.memo(function VariantEmpty({
    onAction,
    actionLabel,
    description,
    sx,
  }: ContextualEmptyProps) {
    const { t } = useTranslation();
    return (
      <EmptyStateBase
        icon={<Icon />}
        title={t(titleKey)}
        description={description || t(defaultDescriptionKey)}
        actionLabel={actionLabel || t(defaultActionLabelKey)}
        onAction={onAction}
        sx={sx}
      />
    );
  });
  Component.displayName = `EmptyState.${key}`;
  return Component;
}

export const EmptyState = EmptyStateBase as EmptyStateType;

EmptyState.Games = createEmptyVariant('Games', 'empty.gamesDesc', 'empty.createGame');
EmptyState.Groups = createEmptyVariant('Groups', 'empty.groupsDesc', 'empty.discoverGroups');
EmptyState.Players = createEmptyVariant('Players', 'empty.playersDesc', 'empty.invitePlayers');
EmptyState.Notifications = createEmptyVariant('Notifications', 'empty.notificationsDesc', 'empty.viewGames');
EmptyState.Search = createEmptyVariant('Search', 'empty.searchDesc', 'empty.clearSearch');
EmptyState.Ranking = createEmptyVariant('Ranking', 'empty.rankingDesc', 'empty.viewGames');
EmptyState.Badges = createEmptyVariant('Badges', 'empty.badgesDesc', 'empty.viewStats');
EmptyState.League = createEmptyVariant('League', 'empty.leagueDesc', 'empty.viewGames');
EmptyState.Schedules = createEmptyVariant('Schedules', 'empty.schedulesDesc', 'empty.createSchedule');
EmptyState.Locations = createEmptyVariant('Locations', 'empty.locationsDesc', 'empty.addLocation');
EmptyState.Challenges = createEmptyVariant('Challenges', 'empty.challengesDesc', 'empty.viewGames');

export default EmptyState;
