import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  useTheme,
  alpha,
  Button,
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
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  BarChart as StatsIcon,
  WorkspacePremium as BadgeIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { PlayerAvatar } from '../../components/common/GameCard';
import { DIVISION_CONFIG } from '../../types/gamification';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ProfileScreen');

interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  level: number;
  xp: number;
  division: string;
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  streak: number;
  createdAt?: Date;
}

export const ProfileScreen: React.FC = () => {
  useDocumentTitle('Perfil');
  const navigate = useNavigate();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    const targetUserId = userId || currentUser?.id;
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          const data = snakeToCamel(userDoc.data()) as Record<string, any>;
          setProfile({
            id: targetUserId,
            name: data.name || 'Jogador',
            email: data.email || '',
            photoUrl: data.photoUrl,
            level: data.level || 1,
            xp: data.xp || 0,
            division: data.division || 'BRONZE',
            gamesPlayed: data.gamesPlayed || 0,
            wins: data.wins || 0,
            goals: data.goals || 0,
            assists: data.assists || 0,
            mvpCount: data.mvpCount || 0,
            streak: data.streak || 0,
            createdAt: data.createdAt?.toDate?.(),
          });
        }
      } catch (error) {
        logger.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, currentUser?.id]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
        <Skeleton variant="text" width="60%" sx={{ mt: 2 }} />
        <Skeleton variant="text" width="40%" />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Perfil não encontrado
        </Typography>
      </Box>
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
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
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
