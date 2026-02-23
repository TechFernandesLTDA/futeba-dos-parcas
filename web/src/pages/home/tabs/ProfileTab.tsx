import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import {
  EmojiEvents,
  MilitaryTech,
  LocalFireDepartment,
  Settings,
  Edit,
  Logout,
  SportsSoccer,
  TrendingUp,
  Timeline,
  Star,
} from '@mui/icons-material';
import { getLevelTitle, getLevelColor } from '../../../types/user';
import { gamificationColors } from '../../../theme';
import { useNavigate } from 'react-router-dom';

export function ProfileTab() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const levelProgress = ((user?.experiencePoints || 0) % 200) / 200 * 100;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const menuItems = [
    { icon: <Timeline />, label: 'Jornada de Níveis', onClick: () => {} },
    { icon: <MilitaryTech />, label: 'Badges', onClick: () => {} },
    { icon: <TrendingUp />, label: 'Estatísticas', onClick: () => {} },
    { icon: <Settings />, label: 'Configurações', onClick: () => {} },
  ];

  return (
    <Box sx={{ pb: 8 }}>
      {/* Profile Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, #00C853 0%, #2979FF 100%)`,
          pt: 4,
          pb: 6,
          px: 2,
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            sx={{
              width: 100,
              height: 100,
              bgcolor: 'white',
              color: 'primary.main',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              border: '4px solid white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            {user?.name ? getInitials(user.name) : '?'}
          </Avatar>
          
          {/* Level Badge */}
          <Box
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: getLevelColor(user?.level || 1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <Typography variant="body2" fontWeight="bold" color="white">
              {user?.level || 1}
            </Typography>
          </Box>
        </Box>

        <Typography variant="h5" fontWeight="bold" color="white" sx={{ mt: 2 }}>
          {user?.name || 'Jogador'}
        </Typography>
        
        {user?.nickname && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
            "{user.nickname}"
          </Typography>
        )}

        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
          {user?.email}
        </Typography>

        {/* Level Card */}
        <Card sx={{ mt: 3, mx: 'auto', maxWidth: 300 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Nível {user?.level || 1}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getLevelTitle(user?.level || 1)}
              </Typography>
            </Box>
            
            <LinearProgress
              variant="determinate"
              value={levelProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: `linear-gradient(90deg, #00C853, #4ADE80)`,
                },
              }}
            />
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {(user?.experiencePoints || 0) % 200} / 200 XP
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ px: 2, mt: -3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SportsSoccer sx={{ color: 'primary.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold">
                {user?.totalGames || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Jogos
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <EmojiEvents sx={{ color: gamificationColors.gold, mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold">
                {user?.totalGoals || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gols
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Star sx={{ color: gamificationColors.mvp, mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold">
                {user?.mvpCount || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                MVPs
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Streak Card */}
      {(user?.currentStreak || 0) > 0 && (
        <Box sx={{ px: 2, mt: 2 }}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${gamificationColors.streak}20, ${gamificationColors.streak}10)`,
              border: `1px solid ${gamificationColors.streak}40`,
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <LocalFireDepartment sx={{ fontSize: 32, color: gamificationColors.streak }} />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {user?.currentStreak || 0} dias seguidos!
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Recorde: {user?.bestStreak || 0} dias
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Menu Items */}
      <Box sx={{ px: 2, mt: 2 }}>
        <Card>
          <List disablePadding>
            {menuItems.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <Divider />}
                <ListItem
                  component="button"
                  onClick={item.onClick}
                  sx={{
                    border: 0,
                    bgcolor: 'transparent',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Card>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ px: 2, mt: 2, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<Edit />}
          fullWidth
          onClick={() => {}}
        >
          Editar Perfil
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Logout />}
          fullWidth
          onClick={handleLogout}
        >
          Sair
        </Button>
      </Box>
    </Box>
  );
}
