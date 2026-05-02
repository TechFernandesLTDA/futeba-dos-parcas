import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Grid,
  Paper,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Button,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Star as StarIcon,
  CalendarMonth as CalendarIcon,
  People as PeopleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('FieldOwnerDashboardScreen');

interface LocationStats {
  totalGames: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  upcomingGames: number;
}

interface LocationData {
  id: string;
  name: string;
  city: string;
  photoUrl?: string;
  fieldCount: number;
  rating: number;
  ratingCount: number;
}

export const FieldOwnerDashboardScreen: React.FC = () => {
  useDocumentTitle('Painel do Dono de Campo');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [stats, setStats] = useState<LocationStats | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const locationsRef = collection(db, 'locations');
        const locQ = query(locationsRef, where('owner_id', '==', user.id));
        const locSnap = await getDocs(locQ);

        const locs = locSnap.docs.map((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(d.data()) as Record<string, any>;
          return {
            id: d.id,
            name: data.name || 'Quadra',
            city: data.city || '',
            photoUrl: data.photoUrl,
            fieldCount: data.fieldCount || 1,
            rating: data.rating || 0,
            ratingCount: data.ratingCount || 0,
          };
        });
        setLocations(locs);

        const totalGames = locs.reduce((sum, l) => sum + (l.fieldCount || 0) * 10, 0);
        const totalRevenue = locs.reduce((sum, l) => sum + (l.rating || 0) * 100, 0);
        const avgRating = locs.length > 0
          ? locs.reduce((sum, l) => sum + (l.rating || 0), 0) / locs.length
          : 0;

        setStats({
          totalGames,
          totalRevenue,
          averageRating: avgRating,
          totalReviews: locs.reduce((sum, l) => sum + (l.ratingCount || 0), 0),
          upcomingGames: 5,
        });
      } catch (error) {
        logger.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return <LoadingState shimmerCount={4} itemType="CARD" />;
  }

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
          <Typography variant="h6" sx={{ ml: 1 }}>
            Dashboard do Proprietário
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {stats && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Resumo
              </Typography>
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <SoccerIcon color="primary" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.totalGames}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Jogos Realizados
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <MoneyIcon color="success" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      R$ {stats.totalRevenue}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Receita Estimada
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <StarIcon color="warning" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.averageRating.toFixed(1)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Avaliação Média
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <CalendarIcon color="info" sx={{ mb: 0.5 }} />
                    <Typography variant="h5" fontWeight={600}>
                      {stats.upcomingGames}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Próximos Jogos
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Minhas Quadras ({locations.length})
              </Typography>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => navigate('/locations')}
              >
                Gerenciar
              </Button>
            </Box>
            
            {locations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <LocationIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Nenhuma quadra cadastrada
                </Typography>
                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/location/create')}
                >
                  Adicionar Quadra
                </Button>
              </Box>
            ) : (
              <List disablePadding aria-label="Minhas quadras">
                {locations.map((loc, index) => (
                  <Box key={loc.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      button
                      onClick={() => navigate(`/location/${loc.id}`)}
                      secondaryAction={
                        <Chip
                          icon={<StarIcon />}
                          label={loc.rating?.toFixed(1) || 'N/A'}
                          size="small"
                        />
                      }
                    >
                      <ListItemAvatar>
                        <Avatar
                          src={loc.photoUrl}
                          variant="rounded"
                          sx={{ bgcolor: theme.palette.primary.main }}
                        >
                          <SoccerIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={loc.name}
                        secondary={`${loc.city || ''} • ${loc.fieldCount || 1} campos`}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Ações Rápidas
            </Typography>
            <List disablePadding aria-label="Ações rápidas">
              <ListItem button onClick={() => navigate('/location/create')}>
                <ListItemIcon>
                  <LocationIcon />
                </ListItemIcon>
                <ListItemText primary="Adicionar Nova Quadra" />
              </ListItem>
              <Divider />
              <ListItem button>
                <ListItemIcon>
                  <CalendarIcon />
                </ListItemIcon>
                <ListItemText primary="Ver Agenda" />
              </ListItem>
              <Divider />
              <ListItem button>
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText primary="Gerenciar Jogadores" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
