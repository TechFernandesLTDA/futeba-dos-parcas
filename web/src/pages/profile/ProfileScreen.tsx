import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Button,
  useTheme,
  alpha,
  Grid,
  Paper,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  MilitaryTech as MilitaryTechIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  BarChart as StatsIcon,
  WorkspacePremium as BadgeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { usePlayerDetail } from '../../hooks/usePlayers';
import { PlayerAvatar } from '../../components/common/GameCard';
import { DIVISION_CONFIG } from '../../types/gamification';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const ProfileScreen: React.FC = () => {
  useDocumentTitle('Perfil');
  const navigate = useNavigate();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();

  const isOwnProfile = !userId || userId === currentUser?.id;
  const targetUserId = userId || currentUser?.id;

  const { player: profile, loading, error } = usePlayerDetail(targetUserId);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {/* Header skeleton */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" width={100} height={32} />
        </Box>

        {/* Profile card skeleton */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Skeleton variant="circular" width={80} height={80} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={36} />
                <Skeleton variant="text" width="30%" height={24} />
              </Box>
            </Box>
            <Grid container spacing={2}>
              {[0, 1, 2].map((i) => (
                <Grid key={i} xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Skeleton variant="text" width="50%" height={32} sx={{ mx: 'auto' }} />
                    <Skeleton variant="text" width="60%" height={16} sx={{ mx: 'auto' }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Stats card skeleton */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1.5 }} />
            <Grid container spacing={2}>
              {[0, 1, 2, 3].map((i) => (
                <Grid key={i} xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="50%" height={20} />
                      <Skeleton variant="text" width="30%" height={28} />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Options list skeleton */}
        <Card>
          <Box sx={{ p: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="text" width={`${60 - i * 10}%`} height={24} />
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          }
        >
          Erro ao carregar perfil: {error}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Perfil não encontrado
          </Typography>
        </Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  const divisionConfig = DIVISION_CONFIG[profile.division as keyof typeof DIVISION_CONFIG] || DIVISION_CONFIG.BRONZE;

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1, flex: 1 }}>
            Perfil
          </Typography>
          {isOwnProfile && (
            <IconButton onClick={() => navigate('/profile/edit')} aria-label="Editar perfil">
              <EditIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <PlayerAvatar
                name={profile.name}
                photoUrl={profile.photoUrl}
                size={80}
                level={profile.level}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={700}>
                  {profile.name}
                </Typography>
                <Chip
                  label={divisionConfig.label}
                  size="small"
                  sx={{
                    bgcolor: alpha(divisionConfig.color, 0.1),
                    color: divisionConfig.color,
                    mt: 0.5,
                  }}
                />
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid xs={4}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {profile.level}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Nível
                  </Typography>
                </Paper>
              </Grid>
              <Grid xs={4}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={700} color="secondary">
                    {profile.xp}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    XP Total
                  </Typography>
                </Paper>
              </Grid>
              <Grid xs={4}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={700} color="warning.main">
                    {profile.mvpCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    MVPs
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Estatísticas
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SoccerIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Jogos
                    </Typography>
                    <Typography variant="h6">{profile.gamesPlayed}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrophyIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Vitórias
                    </Typography>
                    <Typography variant="h6">{profile.wins}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SoccerIcon color="success" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Gols
                    </Typography>
                    <Typography variant="h6">{profile.goals}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingIcon color="info" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Assists
                    </Typography>
                    <Typography variant="h6">{profile.assists}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {isOwnProfile && (
          <Card>
            <List disablePadding aria-label="Opções do perfil">
              <ListItem button onClick={() => navigate('/statistics')}>
                <ListItemIcon>
                  <StatsIcon />
                </ListItemIcon>
                <ListItemText primary="Estatísticas Detalhadas" />
              </ListItem>
              <Divider />
              <ListItem button onClick={() => navigate('/badges')}>
                <ListItemIcon>
                  <BadgeIcon />
                </ListItemIcon>
                <ListItemText primary="Conquistas" />
              </ListItem>
              <Divider />
              <ListItem button onClick={() => navigate('/level-journey')}>
                <ListItemIcon>
                  <MilitaryTechIcon />
                </ListItemIcon>
                <ListItemText primary="Jornada de Níveis" />
              </ListItem>
              <Divider />
              <ListItem button onClick={() => navigate('/settings')}>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Configurações" />
              </ListItem>
            </List>
          </Card>
        )}
      </Container>
    </Box>
  );
};
