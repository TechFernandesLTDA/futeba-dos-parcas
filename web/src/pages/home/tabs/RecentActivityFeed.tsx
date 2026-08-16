import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Skeleton,
  Button,
  alpha,
} from '@mui/material';
import {
  Notifications,
  SportsSoccer,
  EmojiEvents,
  TrendingUp,
  Star,
  GroupAdd,
  CalendarMonth,
} from '@mui/icons-material';
import { getLevelColor } from '../../../types/user';
import { useAuth } from '../../../contexts/AuthContext';
import { iconSizes } from '../../../theme/iconSizes';
import { useGamificationColors } from '../../../hooks/useGamificationColors';
import { useTheme } from '@mui/material/styles';
import {
  GAMIFICATION_CELEBRATION_DURATION_MS,
  GamificationCelebration,
} from '../../../components/gamification/GamificationCelebration';
import {
  getRewardActivityKind,
  type RewardActivityKind,
} from '../../../components/gamification/GamificationCelebration.utils';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export interface Activity {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  createdAt?: Date;
  actorName?: string;
  actorPhoto?: string;
  referenceType?: string;
  referenceId?: string;
  groupId?: string;
  senderId?: string;
}

function getActivityIcon(type: string, gColors: { gold: string }, levelColor: string) {
  const upper = type.toUpperCase();
  if (upper.includes('GOAL') || upper === 'GOAL_SCORED') {
    return <SportsSoccer color="success" />;
  }
  if (upper.includes('MVP') || upper === 'MVP_WON' || upper === 'MVP_RECEIVED' || upper === 'MVP_VOTE') {
    return <EmojiEvents sx={{ color: gColors.gold }} />;
  }
  if (upper === 'LEVEL_UP') {
    return <TrendingUp sx={{ color: levelColor }} />;
  }
  if (upper === 'BADGE_UNLOCKED' || upper === 'ACHIEVEMENT') {
    return <Star sx={{ color: gColors.gold }} />;
  }
  if (upper === 'GROUP_INVITE' || upper === 'GROUP_INVITE_ACCEPTED' || upper === 'MEMBER_JOINED' || upper === 'GROUP_JOINED' || upper === 'JOIN_GROUP') {
    return <GroupAdd color="primary" />;
  }
  if (upper === 'GAME_SCHEDULED' || upper === 'GAME_CREATED' || upper === 'GAME_CONFIRMED' || upper === 'GAME_UPDATED' || upper === 'GAME_REMINDER' || upper === 'GAME_WIN' || upper.includes('GAME')) {
    return <CalendarMonth />;
  }
  return <Notifications />;
}

function getActivityColor(type: string, gColors: { gold: string }, levelColor: string) {
  const upper = type.toUpperCase();
  if (upper.includes('MVP') || upper === 'MVP_WON' || upper === 'MVP_RECEIVED') return gColors.gold;
  if (upper === 'LEVEL_UP') return levelColor;
  if (upper === 'BADGE_UNLOCKED' || upper === 'ACHIEVEMENT') return gColors.gold;
  return undefined;
}

function getActivityNavTarget(activity: Activity): string | null {
  if (activity.referenceType === 'game' && activity.referenceId) return `/game/${activity.referenceId}`;
  if (activity.referenceType === 'group' || (activity.groupId && !activity.referenceId)) {
    return `/group/${activity.referenceId || activity.groupId}`;
  }
  if (activity.referenceType === 'badge') return '/badges';
  if (activity.referenceType === 'level') return '/level-journey';
  if (activity.senderId && !activity.referenceId && !activity.groupId) return `/profile/${activity.senderId}`;
  return null;
}

interface RecentActivityFeedProps {
  activities: Activity[];
  loading: boolean;
}

export function RecentActivityFeed({ activities, loading }: RecentActivityFeedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const gColors = useGamificationColors();
  const levelColor = getLevelColor(user?.level ?? 0, theme);
  const reducedMotion = useReducedMotion();
  const latestActivity = activities[0] ?? null;
  const latestActivityActorName = latestActivity?.actorName;
  const latestActivityId = latestActivity?.id ?? null;
  const latestActivityMessage = latestActivity?.message;
  const latestActivityReferenceType = latestActivity?.referenceType;
  const latestActivityTitle = latestActivity?.title;
  const latestActivityType = latestActivity?.type;
  const latestActivityIdRef = useRef<string | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const [celebration, setCelebration] = useState<{
    kind: RewardActivityKind;
    title: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!latestActivityId) {
      latestActivityIdRef.current = null;
      setCelebration(null);
      return;
    }

    const previousActivityId = latestActivityIdRef.current;
    latestActivityIdRef.current = latestActivityId;

    if (!previousActivityId || previousActivityId === latestActivityId || reducedMotion) {
      return;
    }

    const kind = getRewardActivityKind(latestActivityType ?? '', latestActivityReferenceType);
    if (!kind) return;

    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current);
    }

    setCelebration({
      kind,
      title: latestActivityTitle || t('profile.defaultActivityTitle'),
      message: latestActivityMessage || latestActivityActorName,
    });

    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebration(null);
      celebrationTimerRef.current = null;
    }, GAMIFICATION_CELEBRATION_DURATION_MS);
  }, [
    latestActivityActorName,
    latestActivityId,
    latestActivityMessage,
    latestActivityReferenceType,
    latestActivityTitle,
    latestActivityType,
    loading,
    reducedMotion,
    t,
  ]);

  useEffect(() => () => {
    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current);
    }
  }, []);

  return (
    <>
      {celebration ? (
        <GamificationCelebration
          kind={celebration.kind}
          title={celebration.title}
          message={celebration.message}
        />
      ) : null}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Notifications fontSize="small" color="primary" />
        {t('profile.recentActivity')}
      </Typography>
      <Card>
        {loading ? (
          <List disablePadding>
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItem key={i} divider={i < 2}>
                <ListItemAvatar>
                  <Skeleton variant="circular" width={40} height={40} />
                </ListItemAvatar>
                <ListItemText
                  primary={<Skeleton variant="text" width="60%" />}
                  secondary={<Skeleton variant="text" width="30%" />}
                />
              </ListItem>
            ))}
          </List>
        ) : activities.length === 0 ? (
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Notifications sx={{ fontSize: iconSizes.xxl, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {t('profile.noRecentActivity')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('profile.noRecentActivityDesc')}
              </Typography>
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/?tab=2')}
                >
                  {t('common.viewGroups')}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/?tab=1')}
                >
                  {t('games.createGame')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        ) : (
          <List disablePadding>
            {activities.map((activity, index) => {
              const navTarget = getActivityNavTarget(activity);
              const avatarColor = getActivityColor(activity.type, gColors, levelColor);
              return (
                <ListItem
                  key={activity.id}
                  disablePadding
                  divider={index < activities.length - 1}
                >
                  <ListItemButton
                    onClick={() => navTarget && navigate(navTarget)}
                    disabled={!navTarget}
                    sx={{ py: 1.5 }}
                  >
                    <ListItemAvatar>
                      {activity.actorPhoto ? (
                        <Avatar src={activity.actorPhoto} alt={activity.actorName || ''} />
                      ) : (
                        <Avatar
                          sx={{
                            bgcolor: avatarColor
                              ? alpha(avatarColor, 0.15)
                              : 'action.hover',
                          }}
                          aria-hidden="true"
                        >
                          {getActivityIcon(activity.type, gColors, levelColor)}
                        </Avatar>
                      )}
                    </ListItemAvatar>
                    <ListItemText
                      primary={activity.title || activity.actorName || t('profile.defaultActivityTitle')}
                      primaryTypographyProps={{
                        fontWeight: 500,
                        noWrap: true,
                      }}
                      secondary={
                        activity.message || activity.actorName
                          ? `${activity.actorName ? `${activity.actorName}  ·  ` : ''}${activity.message}`
                          : ''
                      }
                      secondaryTypographyProps={{
                        noWrap: true,
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1, alignSelf: 'flex-start', mt: 0.5, whiteSpace: 'nowrap' }}
                    >
                      {activity.time}
                    </Typography>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Card>
    </>
  );
}
