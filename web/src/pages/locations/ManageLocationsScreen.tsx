import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  useTheme,
  Fab,
  Button,
  Grid,
  Rating,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Add as AddIcon,
  LocationOn as LocationIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { Location } from '../../types/location';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const ManageLocationsScreen: React.FC = () => {
  useDocumentTitle('Gerenciar Locais');
  const navigate = useNavigate();
  const theme = useTheme();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const locRef = collection(db, 'locations');
    const q = query(locRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locData = snapshot.docs.map((doc) => ({
        ...snakeToCamel<Location>(doc.data()),
        id: doc.id,
      }));
      setLocations(locData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ pb: 8 }}>
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
            Locais
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/location/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            Adicionar Local
          </Button>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar locais..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar locais"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : filteredLocations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? 'Nenhum local encontrado' : 'Nenhum local cadastrado'}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Adicione locais para organizar seus jogos!
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filteredLocations.map((location) => (
              <Grid xs={12} key={location.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.01)' },
                  }}
                  onClick={() => navigate(`/location/${location.id}`)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {location.photoUrl ? (
                        <Box
                          component="img"
                          src={location.photoUrl}
                          alt={location.name}
                          sx={{ width: 80, height: 80, borderRadius: 1, objectFit: 'cover' }}
                        />
                      ) : (
                        <Avatar
                          variant="rounded"
                          sx={{ width: 80, height: 80, bgcolor: theme.palette.primary.main }}
                        >
                          <SoccerIcon />
                        </Avatar>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {location.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {location.address}, {location.city}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Rating value={location.averageRating || 0} size="small" readOnly />
                          <Typography variant="caption" color="text.secondary">
                            ({location.reviewCount || 0})
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          {location.fieldType && (
                            <Chip label={location.fieldType} size="small" />
                          )}
                          <Chip label={`${location.playersPerTeam || 11}v${location.playersPerTeam || 11}`} size="small" />
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Fab
        color="primary"
        sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/location/create')}
        aria-label="Adicionar local"
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
