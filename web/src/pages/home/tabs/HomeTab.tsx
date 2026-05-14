import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Skeleton,
  LinearProgress,
  Grid,
  Link,
  Button,
  ButtonBase,
  useTheme,
  alpha,
} from '@mui/material';
import {
  SportsSoccer,
  SportsScore,
  CalendarMonth,
  LocationOn,
  People,
  Notifications,
  TrendingUp,
  EmojiEvents,
  LocalFireDepartment,
  Star,
  GroupAdd,
} from '@mui/icons-material';
import { gamificationColors } from '../../../theme';
import { useGames } from '../../../hooks/useGames';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { snakeToCamel } from '../../../utils/firestoreHelpers';
import { formatGameDateLong, formatTimeAgo as formatTimeAgoUtil } from '../../../utils/dateFormatters';
import { getLevelForXp, getXpProgress, getLevelEntry, getXpRemaining } from '../../../types/gamification';
import { getLevelColor } from '../../../types/user';
import { useToast } from '../../../contexts/ToastContext';
import { createLogger } from '../../../utils/logger';
import { TeamBadge } from '../../../components/team/TeamBadge';
import PlayerCard from '../../../components/player/PlayerCard';

const logger = createLogger('HomeTab');

interface Activity {
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

export function HomeTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  // Próximo jogo real do Firestore
  const { games: upcomingGames, loading: gamesLoading } = useGames({
    status: 'SCHEDULED',
    limitCount: 1,
  });
  const nextGame = upcomingGames[0] || null;

  // Atividades recentes do Firestore
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const { showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [isPlayerCardOpen, setIsPlayerCardOpen] = useState(false);

  // Dados de nível usando LevelTable
  const currentXp = user?.experiencePoints || 0;
  const currentLevel = getLevelForXp(currentXp);
  const levelEntry = getLevelEntry(currentLevel);
  const progress = getXpProgress(currentXp);
  const xpRemaining = getXpRemaining(currentXp);
  const levelColor = getLevelColor(currentLevel);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setActivitiesLoading(false);
      return;
    }

    // FIX: era `users/{uid}/notifications` (subcollection inexistente — sem rule)
    // → permission denied → toast "Erro ao carregar atividades recentes".
    // Schema real: top-level `notifications` com campo `user_id`. Index composto
    // (user_id ASC, created_at DESC) já existe em firestore.indexes.json.
    // Android usa o mesmo path top-level (vide InviteRepositoryImpl.kt:34).
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('user_id', '==', uid),
      orderBy('created_at', 'desc'),
      limit(5),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const raw = doc.data();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = snakeToCamel(raw) as Record<string, any>;
          const createdAt = (raw.created_at || raw.createdAt)?.toDate?.();
          return {
            id: doc.id,
            type: d.type || 'notification',
            title: d.title || '',
            message: d.message || d.body || '',
            time: createdAt ? formatTimeAgoUtil(createdAt) : '',
            createdAt,
            actorName: d.senderName || '',
            actorPhoto: d.senderPhoto || '',
            referenceType: d.referenceType || '',
            referenceId: d.referenceId || '',
            groupId: d.groupId || '',
            senderId: d.senderId || '',
          } as Activity;
        });
        setActivities(data);
        setActivitiesLoading(false);
      },
      (err) => {
        logger.error('Error in recent activities listener:', err);
        showErrorRef.current('Erro ao carregar atividades recentes.');
        setActivitiesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  // Usa utilitários centralizados de dateFormatters

  const getActivityIcon = (type: string) => {
    const upper = type.toUpperCase();
    if (upper.includes('GOAL') || upper === 'GOAL_SCORED') {
      return <SportsSoccer color="success" />;
    }
    if (upper.includes('MVP') || upper === 'MVP_WON' || upper === 'MVP_RECEIVED' || upper === 'MVP_VOTE') {
      return <EmojiEvents sx={{ color: gamificationColors.gold }} />;
    }
    if (upper === 'LEVEL_UP') {
      return <TrendingUp sx={{ color: levelColor }} />;
    }
    if (upper === 'BADGE_UNLOCKED' || upper === 'ACHIEVEMENT') {
      return <Star sx={{ color: gamificationColors.gold }} />;
    }
    if (upper === 'GROUP_INVITE' || upper === 'GROUP_INVITE_ACCEPTED' || upper === 'MEMBER_JOINED' || upper === 'GROUP_JOINED' || upper === 'JOIN_GROUP') {
      return <GroupAdd color="primary" />;
    }
    if (upper === 'GAME_SCHEDULED' || upper === 'GAME_CREATED' || upper === 'GAME_CONFIRMED' || upper === 'GAME_UPDATED' || upper === 'GAME_REMINDER' || upper === 'GAME_WIN' || upper.includes('GAME')) {
      return <CalendarMonth />;
    }
    return <Notifications />;
  };

  const getActivityColor = (type: string) => {
    const upper = type.toUpperCase();
    if (upper.includes('MVP') || upper === 'MVP_WON' || upper === 'MVP_RECEIVED') return gamificationColors.gold;
    if (upper === 'LEVEL_UP') return levelColor;
    if (upper === 'BADGE_UNLOCKED' || upper === 'ACHIEVEMENT') return gamificationColors.gold;
    return undefined;
  };

  const getActivityNavTarget = (activity: Activity): string | null => {
    if (activity.referenceType === 'game' && activity.referenceId) return `/game/${activity.referenceId}`;
    if (activity.referenceType === 'group' || (activity.groupId && !activity.referenceId)) {
      return `/group/${activity.referenceId || activity.groupId}`;
    }
    if (activity.referenceType === 'badge') return '/badges';
    if (activity.referenceType === 'level') return '/level-journey';
    if (activity.senderId && !activity.referenceId && !activity.groupId) return `/profile/${activity.senderId}`;
    return null;
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Hub Header - Estilo ExpressiveHubHeader do Android */}
      <Card
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
          borderRadius: 3,
          overflow: 'visible',
          position: 'relative',
        }}
      >
        <CardActionArea onClick={() => navigate('/level-journey')} aria-label={`Ver jornada de nível - Nível ${currentLevel}`} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            {/* Saudação + Avatar */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={user?.photoUrl}
                  alt={user?.name || 'Usuário'}
                  onClick={(e) => { e.stopPropagation(); setIsPlayerCardOpen(true); }}
                  sx={{
                    width: 60,
                    height: 60,
                    bgcolor: alpha(theme.palette.common.white, 0.2),
          color: 'primary.contrastText',
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    border: '3px solid',
                    borderColor: 'primary.contrastText',
                    cursor: 'pointer',
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </Avatar>
                {/* Level Badge */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: levelColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid',
                    borderColor: 'background.paper',
                    boxShadow: `0 0 8px ${levelColor}80`,
                  }}
                >
                  <Typography variant="caption" fontWeight="bold" sx={{ color: 'primary.contrastText', fontSize: '0.65rem' }}>
                    {currentLevel}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ ml: 2, flex: 1, maxWidth: '100%', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold" noWrap sx={{ lineHeight: 1.2, textOverflow: 'ellipsis' }}>
                    Olá, {user?.name?.split(' ')[0] || 'Jogador'}!
                  </Typography>
                  <TeamBadge teamId={user?.favoriteTeam} size={28} />
                </Box>
                <Typography variant="body2" noWrap sx={{ opacity: 0.85, mt: 0.25, textOverflow: 'ellipsis' }}>
                  {levelEntry.name} • {currentXp.toLocaleString('pt-BR')} XP
                </Typography>
              </Box>
            </Box>

            {/* Barra de progresso de nível */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  Nível {currentLevel}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  {currentLevel < 20 ? `Nível ${currentLevel + 1}` : 'MAX'}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress * 100}
                aria-label="Progresso de nível"
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: alpha(theme.palette.common.white, 0.15),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    bgcolor: alpha(theme.palette.common.white, 0.9),
                  },
                }}
              />
              {currentLevel < 20 && (
                <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
                  Faltam {xpRemaining.toLocaleString('pt-BR')} XP para {getLevelEntry(currentLevel + 1).name}
                </Typography>
              )}
            </Box>

            {/* Stats rápidos */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {[
                { value: user?.totalGames || 0, label: 'Jogos', icon: <SportsSoccer aria-hidden="true" sx={{ fontSize: 16, opacity: 0.9 }} />, color: alpha(theme.palette.common.white, 0.15), navigateTo: '/games' },
                { value: user?.totalGoals || 0, label: 'Gols', icon: <SportsScore aria-hidden="true" sx={{ fontSize: 16, opacity: 0.9 }} />, color: alpha(theme.palette.success.light, 0.25), navigateTo: '/statistics' },
                { value: user?.mvpCount || 0, label: 'MVPs', icon: <EmojiEvents aria-hidden="true" sx={{ fontSize: 16, opacity: 0.9 }} />, color: alpha(gamificationColors.gold, 0.25), navigateTo: '/statistics' },
              ].map((stat) => (
                <ButtonBase
                  key={stat.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(stat.navigateTo);
                  }}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    bgcolor: stat.color,
                    borderRadius: 2,
                    py: 1,
                    px: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    {stat.icon}
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {stat.label}
                  </Typography>
                </ButtonBase>
              ))}
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>

      {/* Streak Widget */}
      {(user?.currentStreak || 0) > 0 && (
        <Card
          sx={{
            mb: 3,
            bgcolor: alpha(gamificationColors.streak, 0.08),
            border: `1px solid ${alpha(gamificationColors.streak, 0.3)}`,
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <LocalFireDepartment sx={{ fontSize: 32, color: gamificationColors.streak }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {user?.currentStreak} jogos seguidos!
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Recorde: {user?.bestStreak || 0} jogos
              </Typography>
            </Box>
            <Chip
              label={`+${(user?.currentStreak || 0) >= 10 ? 30 : (user?.currentStreak || 0) >= 7 ? 20 : 10} XP`}
              size="small"
              sx={{ bgcolor: alpha(gamificationColors.streak, 0.15), color: gamificationColors.streak, fontWeight: 600 }}
            />
          </CardContent>
        </Card>
      )}

      {/* Próximo Jogo + Atividade Recente */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarMonth fontSize="small" color="primary" />
              Próximo Jogo
            </Typography>
            <Link
              component="button"
              type="button"
              variant="body2"
              color="primary"
              sx={{ fontWeight: 500 }}
              onClick={() => navigate('/games')}
            >
              Ver todos
            </Link>
          </Box>
          {gamesLoading ? (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Skeleton variant="text" width="60%" height={28} />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="50%" />
              </CardContent>
            </Card>
          ) : nextGame ? (
            <Card sx={{ borderRadius: 3 }}>
              <CardActionArea onClick={() => navigate(`/game/${nextGame.id}`)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {nextGame.locationName || nextGame.groupName || 'Jogo'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                        <CalendarMonth fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {formatGameDateLong(nextGame.date)} às {nextGame.time}
                        </Typography>
                      </Box>
                      {nextGame.locationAddress && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <LocationOn fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {nextGame.locationAddress}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Chip
                      icon={<People />}
                      label={`${nextGame.playersCount}/${nextGame.maxPlayers}`}
                      color="primary"
                      size="small"
                    />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ) : (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <SportsSoccer sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Nenhum jogo agendado
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/games')}
                    sx={{ mt: 1.5 }}
                  >
                    Criar Jogo
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} lg={6}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Notifications fontSize="small" color="primary" />
            Atividade Recente
          </Typography>
          <Card sx={{ borderRadius: 3 }}>
            {activitiesLoading ? (
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
                  <Notifications sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma atividade recente
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    Participe de grupos ou crie jogos para ver atividades aqui
                  </Typography>
                  <Box sx={{ mt: 1.5, display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/groups')}
                    >
                      Ver Grupos
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/games')}
                    >
                      Criar Jogo
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            ) : (
              <List disablePadding>
                {activities.map((activity, index) => {
                  const navTarget = getActivityNavTarget(activity);
                  const avatarColor = getActivityColor(activity.type);
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
                              {getActivityIcon(activity.type)}
                            </Avatar>
                          )}
                        </ListItemAvatar>
                        <ListItemText
                          primary={activity.title || activity.actorName || 'Atividade'}
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
        </Grid>
      </Grid>
      {isPlayerCardOpen && (
        <PlayerCard userId={user?.id || null} onClose={() => setIsPlayerCardOpen(false)} />
      )}
    </Box>
  );
}
