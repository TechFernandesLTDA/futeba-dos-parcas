import React, { useState, useMemo } from 'react';
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
  useMediaQuery,
  alpha,
  Skeleton,
  Alert,
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
  AdminPanelSettings,
  Stadium,
  BugReport,
  Dashboard,
} from '@mui/icons-material';
import { getLevelColor } from '../../../types/user';
import { getLevelBadgeImage, getLevelBadgeDescription } from '../../../utils/levelBadge';
import { getLevelForXp, getXpProgress, getLevelEntry } from '../../../types/gamification';
import { gamificationColors } from '../../../theme';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../contexts/ToastContext';
import { createLogger } from '../../../utils/logger';
import { TeamBadge } from '../../../components/team/TeamBadge';

const logger = createLogger('ProfileTab');

export function ProfileTab() {
  const { user, firebaseUser, logout, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showError } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Calcular progresso usando LevelTable (fonte única de verdade)
  const currentXp = user?.experiencePoints || 0;
  const currentLevel = getLevelForXp(currentXp);
  const levelProgress = getXpProgress(currentXp) * 100;
  const currentEntry = getLevelEntry(currentLevel);
  const nextEntry = currentLevel < 20 ? getLevelEntry(currentLevel + 1) : null;
  const xpInLevel = currentXp - currentEntry.xpRequired;
  const xpNeededForNext = nextEntry ? nextEntry.xpRequired - currentEntry.xpRequired : 0;
  const levelColor = getLevelColor(currentLevel, theme);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      logger.error('Erro ao sair:', error);
      showError('Erro ao sair. Tente novamente.');
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Memoizado: recriado apenas quando navigate muda (estável por sessão)
  const menuItems = useMemo(() => [
    { icon: <Timeline />, label: 'Rumo ao Estrelato', onClick: () => navigate('/level-journey') },
    { icon: <MilitaryTech />, label: 'Badges', onClick: () => navigate('/badges') },
    { icon: <TrendingUp />, label: 'Estatísticas', onClick: () => navigate('/statistics') },
    { icon: <Settings />, label: 'Configurações', onClick: () => navigate('/settings') },
  ], [navigate]);

  // Itens condicionais por role
  const isAdmin = user?.role === 'ADMIN';
  const isFieldOwner = user?.role === 'FIELD_OWNER';

  // Memoizado: recriado apenas quando role do usuário muda
  const adminMenuItems = useMemo<Array<{ icon: React.ReactNode; label: string; onClick: () => void }>>(() => {
    const items: Array<{ icon: React.ReactNode; label: string; onClick: () => void }> = [];
    if (isAdmin || isFieldOwner) {
      items.push({
        icon: <Stadium />,
        label: 'Gerenciar Quadras',
        onClick: () => navigate('/locations'),
      });
    }
    if (isFieldOwner) {
      items.push({
        icon: <Dashboard />,
        label: 'Painel do Dono',
        onClick: () => navigate('/owner/dashboard'),
      });
    }
    if (isAdmin) {
      items.push({
        icon: <AdminPanelSettings />,
        label: 'Gerenciar Usuários',
        onClick: () => navigate('/admin/users'),
      });
      items.push({
        icon: <EmojiEvents />,
        label: 'Configurações da Liga',
        onClick: () => navigate('/settings/gamification'),
      });
      items.push({
        icon: <BugReport />,
        label: 'Ferramentas de Dev',
        onClick: () => navigate('/dev'),
      });
    }
    return items;
  }, [isAdmin, isFieldOwner, navigate]);

  // Memoizado: recriado apenas quando ratings do usuário ou tema mudam
  const positionRatings = useMemo(() => [
    { icon: <SportsSoccer fontSize="small" />, label: 'Atacante', value: user?.strikerRating || 0, color: theme.palette.error.main },
    { icon: <DirectionsRun fontSize="small" />, label: 'Meia', value: user?.midRating || 0, color: theme.palette.warning.main },
    { icon: <Shield fontSize="small" />, label: 'Zagueiro', value: user?.defenderRating || 0, color: theme.palette.info.main },
    { icon: <SportsKabaddi fontSize="small" />, label: 'Goleiro', value: user?.gkRating || 0, color: theme.palette.success.main },
  ], [user?.strikerRating, user?.midRating, user?.defenderRating, user?.gkRating, theme.palette]);

  if (loading) {
    return (
      <Box sx={{ pb: 8 }}>
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            pt: 2,
            pb: 6,
            px: 2,
            textAlign: 'center',
          }}
        >
          <Skeleton variant="circular" width={100} height={100} sx={{ mx: 'auto', bgcolor: alpha(theme.palette.common.white, 0.2) }} />
          <Skeleton variant="text" width={200} height={40} sx={{ mx: 'auto', mt: 2, bgcolor: alpha(theme.palette.common.white, 0.2) }} />
          <Skeleton variant="text" width={150} height={24} sx={{ mx: 'auto', mt: 0.5, bgcolor: alpha(theme.palette.common.white, 0.2) }} />
        </Box>
        <Box sx={{ px: 2, mt: -3, display: 'flex', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={90} sx={{ flex: 1, borderRadius: 3 }} />
          ))}
        </Box>
        <Box sx={{ px: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
        </Box>
        <Box sx={{ px: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 3 }} />
        </Box>
        <Box sx={{ px: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 3 }} />
        </Box>
      </Box>
    );
  }

  if (!firebaseUser && !loading) {
    return (
      <Box sx={{ pb: 8, px: 2, pt: 4, textAlign: 'center' }}>
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
        >
          Faça login para acessar seu perfil
        </Alert>
        <Button variant="contained" onClick={() => navigate('/login')} sx={{ borderRadius: 3 }}>
          Ir para o login
        </Button>
      </Box>
    );
  }

  if (firebaseUser && !user && !loading) {
    return (
      <Box sx={{ pb: 8, px: 2, pt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refreshUser()}>
              Tentar novamente
            </Button>
          }
        >
          Erro ao carregar perfil
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 8 }}>
      {/* Profile Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          pt: 2,
          pb: 6,
          px: 2,
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            src={user?.photoUrl}
            slotProps={{ img: { loading: 'lazy' } }}
            sx={{
              width: 100,
              height: 100,
              bgcolor: 'background.paper',
              color: 'primary.main',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              border: '4px solid',
              borderColor: 'background.paper',
              boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.2)}`,
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
              loading="lazy"
              alt={getLevelBadgeDescription(currentLevel, currentEntry.name)}
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: 'primary.contrastText' }}>
            {user?.name || 'Jogador'}
          </Typography>
          <TeamBadge teamId={user?.favoriteTeam} size={28} />
        </Box>

        {user?.nickname && (
          <Typography variant="body2" sx={{ color: 'primary.contrastText', opacity: 0.9 }}>
            "{user.nickname}"
          </Typography>
        )}

        <Typography variant="body2" sx={{ color: 'primary.contrastText', opacity: 0.8, mt: 0.5 }}>
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, textAlign: 'right' }}>
              Escala: 0 a 5
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Menu Items */}
      <Box sx={{ px: 2, mt: 2 }}>
        <Card sx={{ borderRadius: 3 }}>
          <List disablePadding aria-label="Menu do perfil">
            {menuItems.map((item, index) => (
              <React.Fragment key={item.label}>
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

      {/* Seção Administração — só ADMIN/FIELD_OWNER */}
      {adminMenuItems.length > 0 && (
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', pl: 1, fontWeight: 600 }}
          >
            Administração
          </Typography>
          <Card sx={{ borderRadius: 3, mt: 0.5 }}>
            <List disablePadding aria-label="Menu de administração">
              {adminMenuItems.map((item, index) => (
                <React.Fragment key={`admin-${index}`}>
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
                    <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                    <ChevronRight color="action" />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        </Box>
      )}

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
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
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
