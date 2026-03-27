import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
  alpha,
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
  Shield,
  DirectionsRun,
  SportsKabaddi,
  ChevronRight,
} from '@mui/icons-material';
import { getLevelColor } from '../../../types/user';
import { getLevelBadgeImage, getLevelBadgeDescription } from '../../../utils/levelBadge';
import { getLevelForXp, getXpProgress, getXpRemaining, getLevelEntry } from '../../../types/gamification';
import { gamificationColors } from '../../../theme';
import { useNavigate } from 'react-router-dom';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ProfileTab');

export function ProfileTab() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Calcular progresso usando LevelTable (fonte única de verdade)
  const currentXp = user?.experiencePoints || 0;
  const currentLevel = getLevelForXp(currentXp);
  const levelProgress = getXpProgress(currentXp) * 100;
  const xpRemaining = getXpRemaining(currentXp);
  const currentEntry = getLevelEntry(currentLevel);
  const nextEntry = currentLevel < 20 ? getLevelEntry(currentLevel + 1) : null;
  const xpInLevel = currentXp - currentEntry.xpRequired;
  const xpNeededForNext = nextEntry ? nextEntry.xpRequired - currentEntry.xpRequired : 0;
  const levelColor = getLevelColor(currentLevel);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      logger.error('Erro ao sair:', error);
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
    { icon: <Timeline />, label: 'Rumo ao Estrelato', onClick: () => navigate('/level-journey') },
    { icon: <MilitaryTech />, label: 'Badges', onClick: () => navigate('/badges') },
    { icon: <TrendingUp />, label: 'Estatísticas', onClick: () => navigate('/statistics') },
    { icon: <Settings />, label: 'Configurações', onClick: () => navigate('/settings') },
  ];

  // Ratings de posição
  const positionRatings = [
    { icon: <SportsSoccer fontSize="small" />, label: 'Atacante', value: user?.strikerRating || 0, color: theme.palette.error.main },
    { icon: <DirectionsRun fontSize="small" />, label: 'Meia', value: user?.midRating || 0, color: theme.palette.warning.main },
    { icon: <Shield fontSize="small" />, label: 'Zagueiro', value: user?.defenderRating || 0, color: theme.palette.info.main },
    { icon: <SportsKabaddi fontSize="small" />, label: 'Goleiro', value: user?.gkRating || 0, color: theme.palette.success.main },
  ];

  return (
    <Box sx={{ pb: 8 }}>
      {/* Profile Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
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
              bottom: -6,
              right: -6,
              width: 42,
              height: 42,
              filter: `drop-shadow(0 2px 6px ${levelColor}80)`,
            }}
          >
            <Box
              component="img"
              src={getLevelBadgeImage(currentLevel)}
              alt={getLevelBadgeDescription(currentLevel, currentEntry.name)}
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
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
        <Card
          sx={{ mt: 3, mx: 'auto', maxWidth: 300, borderRadius: 3, cursor: 'pointer' }}
          onClick={() => navigate('/level-journey')}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Nível {currentLevel}
              </Typography>
              <Typography variant="caption" fontWeight={600} color={levelColor}>
                {currentEntry.name}
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
                  background: `linear-gradient(90deg, ${levelColor}, ${alpha(levelColor, 0.7)})`,
                },
              }}
            />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {Math.max(0, xpInLevel)} / {xpNeededForNext} XP
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ px: 2, mt: -3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Card sx={{ flex: 1, borderRadius: 3 }}>
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

          <Card sx={{ flex: 1, borderRadius: 3 }}>
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

          <Card sx={{ flex: 1, borderRadius: 3 }}>
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
              borderRadius: 3,
              background: `linear-gradient(135deg, ${gamificationColors.streak}20, ${gamificationColors.streak}10)`,
              border: `1px solid ${gamificationColors.streak}40`,
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <LocalFireDepartment sx={{ fontSize: 32, color: gamificationColors.streak }} />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {user?.currentStreak || 0} jogos seguidos!
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Recorde: {user?.bestStreak || 0} jogos
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Ratings por Posição - como Android */}
      <Box sx={{ px: 2, mt: 2 }}>
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Habilidades por Posição
            </Typography>
            {positionRatings.map((pos, index) => (
              <Box key={pos.label} sx={{ mb: index < positionRatings.length - 1 ? 1.5 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: pos.color }}>{pos.icon}</Box>
                    <Typography variant="body2">{pos.label}</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={600} color={pos.color}>
                    {pos.value.toFixed(1)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(pos.value / 5) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(pos.color, 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      bgcolor: pos.color,
                    },
                  }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>

      {/* Menu Items */}
      <Box sx={{ px: 2, mt: 2 }}>
        <Card sx={{ borderRadius: 3 }}>
          <List disablePadding aria-label="Menu do perfil">
            {menuItems.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <Divider />}
                <ListItem
                  component="button"
                  onClick={item.onClick}
                  aria-label={item.label}
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
                  <ChevronRight color="action" />
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
          onClick={() => navigate('/profile/edit')}
          sx={{ borderRadius: 3 }}
        >
          Editar Perfil
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Logout />}
          fullWidth
          onClick={() => setLogoutDialogOpen(true)}
          sx={{ borderRadius: 3 }}
        >
          Sair
        </Button>
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        aria-labelledby="logout-dialog-title"
      >
        <DialogTitle id="logout-dialog-title">Sair da conta?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você será desconectado e precisará fazer login novamente para acessar o app.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleLogout} color="error" variant="contained">
            Sair
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
