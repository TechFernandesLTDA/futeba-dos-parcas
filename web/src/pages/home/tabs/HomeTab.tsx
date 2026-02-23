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
  ListItemText,
} from '@mui/material';
import {
  SportsSoccer,
  CalendarMonth,
  LocationOn,
  People,
  Notifications,
  TrendingUp,
  EmojiEvents,
} from '@mui/icons-material';
import { gamificationColors } from '../../../theme';

export function HomeTab() {
  const { user } = useAuth();

  // Mock data for now
  const nextGame = {
    title: 'Pelada do Sábado',
    date: 'Sábado, 15:00',
    location: 'Campo do Parque',
    players: 10,
    maxPlayers: 14,
  };

  const recentActivity = [
    { type: 'goal', text: 'Você fez 2 gols', time: 'Há 2 dias' },
    { type: 'mvp', text: 'Você foi MVP!', time: 'Há 3 dias' },
    { type: 'level', text: 'Subiu para nível 12!', time: 'Há 5 dias' },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'goal':
        return <SportsSoccer color="success" />;
      case 'mvp':
        return <EmojiEvents sx={{ color: gamificationColors.gold }} />;
      case 'level':
        return <TrendingUp color="primary" />;
      default:
        return <Notifications />;
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Olá, {user?.name?.split(' ')[0] || 'Jogador'}! 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pronto para a pelada?
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Card
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, #00C853 0%, #00852A 100%)`,
          color: 'white',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '1.5rem',
              }}
            >
              {user?.level || 1}
            </Avatar>
            <Box sx={{ ml: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Nível {user?.level || 1}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {user?.experiencePoints || 0} XP
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {user?.totalGames || 0}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Jogos
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {user?.totalGoals || 0}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Gols
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {user?.mvpCount || 0}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                MVPs
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Next Game */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
        Próximo Jogo
      </Typography>
      <Card sx={{ mb: 3 }}>
        <CardActionArea>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {nextGame.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  <CalendarMonth fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {nextGame.date}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <LocationOn fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {nextGame.location}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Chip
                  icon={<People />}
                  label={`${nextGame.players}/${nextGame.maxPlayers}`}
                  color="primary"
                  size="small"
                />
              </Box>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>

      {/* Recent Activity */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
        Atividade Recente
      </Typography>
      <Card>
        <List disablePadding>
          {recentActivity.map((activity, index) => (
            <ListItem
              key={index}
              divider={index < recentActivity.length - 1}
              secondaryAction={
                <Typography variant="caption" color="text.secondary">
                  {activity.time}
                </Typography>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'action.hover' }}>
                  {getActivityIcon(activity.type)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={activity.text} />
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
}
