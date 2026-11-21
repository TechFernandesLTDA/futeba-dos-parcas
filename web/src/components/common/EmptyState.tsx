import React from 'react';
import { Box, Typography, Button, SxProps, Theme } from '@mui/material';
import { iconSizes } from '../../theme/iconSizes';
import { componentMaxWidth } from '../../theme/pageTokens';
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
  // #2197: variantes adicionadas para paridade com Android (modern/EmptyState.kt)
  AccountBalanceWallet as CashboxIcon,
  PersonAddAlt as MembersIcon,
  Timeline as ActivitiesIcon,
  TrendingUp as XpLogsIcon,
  BarChart as StatisticsIcon,
  PeopleAlt as ConfirmationsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Arte, type ArteId } from '../artes/Arte';

interface EmptyStateProps {
  /** Ícone simples. Ignorado quando há `arte`. */
  icon?: React.ReactNode;
  /** Arte da pelada (shared/artes). Decorativa: o título já diz o que acontece. */
  arte?: ArteId;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  actionVariant?: 'contained' | 'outlined' | 'text';
  // #2268: ação secundária opcional (ex.: "Descobrir Grupos" ao lado de "Criar")
  secondaryActionLabel?: string;
  secondaryActionIcon?: React.ReactNode;
  onSecondaryAction?: () => void;
  animate?: boolean;
  sx?: SxProps<Theme>;
}

const EmptyStateBase = React.memo(function EmptyState({
  icon,
  arte,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  actionVariant = 'contained',
  secondaryActionLabel,
  secondaryActionIcon,
  onSecondaryAction,
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
      {arte ? (
        <Arte id={arte} larguraMaxima={200} sx={{ mb: 2.5, '@media (max-height: 520px)': { maxWidth: 120 } }} />
      ) : icon ? (
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
        '& > *': { fontSize: iconSizes.xl, color: 'text.disabled' },
      }}>
        {icon}
      </Box>
      ) : null}
      <Typography
        variant="h6"
        color={arte ? 'text.primary' : 'text.secondary'}
        sx={{ mb: 0.5, ...(arte && { fontWeight: 600 }) }}
      >
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: componentMaxWidth.stateMessage, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {actionLabel && onAction && (
            <Button variant={actionVariant} startIcon={actionIcon} onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outlined" startIcon={secondaryActionIcon} onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </Box>
      ) : null}
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
  // #2197: paridade com Android
  Cashbox: ContextualVariant;
  Members: ContextualVariant;
  Activities: ContextualVariant;
  XpLogs: ContextualVariant;
  Statistics: ContextualVariant;
  Confirmations: ContextualVariant;
}

// Cada variante tem a arte da pelada correspondente (mesmo mapa do Android e do iOS).
const defaultProps: Record<string, { icon: typeof GamesIcon; arte: ArteId; titleKey: string }> = {
  Games: { icon: GamesIcon, arte: 'prancheta_vazia', titleKey: 'empty.games' },
  Groups: { icon: GroupsIcon, arte: 'coletes_varal', titleKey: 'empty.groups' },
  Players: { icon: NoPlayersIcon, arte: 'banco_vazio', titleKey: 'empty.players' },
  Notifications: { icon: NotificationsIcon, arte: 'apito', titleKey: 'empty.notifications' },
  Search: { icon: SearchIcon, arte: 'lupa', titleKey: 'empty.search' },
  Ranking: { icon: TrophyIcon, arte: 'podio', titleKey: 'empty.ranking' },
  Badges: { icon: NoBadgesIcon, arte: 'medalha', titleKey: 'empty.badges' },
  League: { icon: TrophyIcon, arte: 'podio', titleKey: 'empty.league' },
  Schedules: { icon: NoScheduleIcon, arte: 'prancheta_vazia', titleKey: 'empty.schedules' },
  Locations: { icon: MapIcon, arte: 'mapa_campo', titleKey: 'empty.locations' },
  Challenges: { icon: StarIcon, arte: 'cones', titleKey: 'empty.challenges' },
  // #2197: paridade com Android (mesmos ícones Material por categoria)
  Cashbox: { icon: CashboxIcon, arte: 'vaquinha', titleKey: 'empty.cashbox' },
  Members: { icon: MembersIcon, arte: 'coletes_varal', titleKey: 'empty.members' },
  Activities: { icon: ActivitiesIcon, arte: 'placar_zerado', titleKey: 'empty.activities' },
  XpLogs: { icon: XpLogsIcon, arte: 'medalha', titleKey: 'empty.xpLogs' },
  Statistics: { icon: StatisticsIcon, arte: 'placar_zerado', titleKey: 'empty.statistics' },
  Confirmations: { icon: ConfirmationsIcon, arte: 'chuteiras', titleKey: 'empty.confirmations' },
};

function createEmptyVariant(
  key: keyof EmptyStateType & keyof typeof defaultProps,
  defaultDescriptionKey: string,
  defaultActionLabelKey: string,
): ContextualVariant {
  const { icon: Icon, arte, titleKey } = defaultProps[key];
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
        arte={arte}
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
// #2197: variantes de paridade com Android
EmptyState.Cashbox = createEmptyVariant('Cashbox', 'empty.cashboxDesc', 'empty.addTransaction');
EmptyState.Members = createEmptyVariant('Members', 'empty.membersDesc', 'empty.invitePlayers');
EmptyState.Activities = createEmptyVariant('Activities', 'empty.activitiesDesc', 'empty.viewGames');
EmptyState.XpLogs = createEmptyVariant('XpLogs', 'empty.xpLogsDesc', 'empty.viewGames');
EmptyState.Statistics = createEmptyVariant('Statistics', 'empty.statisticsDesc', 'empty.viewGames');
EmptyState.Confirmations = createEmptyVariant('Confirmations', 'empty.confirmationsDesc', 'empty.viewGames');

export default EmptyState;
