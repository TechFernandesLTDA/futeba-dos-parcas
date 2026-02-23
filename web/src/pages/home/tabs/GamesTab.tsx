import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Fab,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Skeleton,
} from '@mui/material';
import {
  Add,
  Search,
  CalendarMonth,
  LocationOn,
  People,
  SportsSoccer,
} from '@mui/icons-material';
import { Game, STATUS_CONFIG, FIELD_TYPE_LABELS } from '../../../types';

// Mock games data
const mockGames: Game[] = [
  {
    id: '1',
    title: 'Pelada do Sábado',
    date: new Date('2026-02-28T15:00:00'),
    time: '15:00',
    locationName: 'Campo do Parque Ibirapuera',
    status: 'SCHEDULED',
    fieldType: 'SOCIETY',
    gameType: 'Society',
    maxPlayers: 14,
    playersCount: 10,
    confirmations: [],
    dailyPrice: 25,
    groupId: '1',
    groupName: 'Pelada dos Parças',
    ownerId: '1',
    ownerName: 'João',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Racha do Domingo',
    date: new Date('2026-03-01T09:00:00'),
    time: '09:00',
    locationName: 'Ginásio Central',
    status: 'SCHEDULED',
    fieldType: 'FUTSAL',
    gameType: 'Futsal',
    maxPlayers: 12,
    playersCount: 8,
    confirmations: [],
    dailyPrice: 20,
    groupId: '2',
    groupName: 'Racha da Firma',
    ownerId: '2',
    ownerName: 'Carlos',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Jogo Ao Vivo',
    date: new Date(),
    time: '10:00',
    locationName: 'Campo da Escola',
    status: 'LIVE',
    fieldType: 'CAMPO',
    gameType: 'Campo',
    maxPlayers: 10,
    playersCount: 10,
    team1Score: 3,
    team2Score: 2,
    confirmations: [],
    dailyPrice: 15,
    groupId: '1',
    groupName: 'Pelada dos Parças',
    ownerId: '1',
    ownerName: 'João',
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    title: 'Partida Finalizada',
    date: new Date(Date.now() - 86400000),
    time: '16:00',
    locationName: 'Arena Futebol',
    status: 'FINISHED',
    fieldType: 'SOCIETY',
    gameType: 'Society',
    maxPlayers: 14,
    playersCount: 14,
    team1Score: 5,
    team2Score: 3,
    confirmations: [],
    dailyPrice: 30,
    groupId: '1',
    groupName: 'Pelada dos Parças',
    ownerId: '1',
    ownerName: 'João',
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

type FilterStatus = 'all' | 'SCHEDULED' | 'LIVE' | 'FINISHED';

export function GamesTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [loading] = useState(false);

  const filteredGames = useMemo(() => {
    let games = [...mockGames];

    // Filter by status
    if (statusFilter !== 'all') {
      games = games.filter(game => game.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      games = games.filter(
        game =>
          game.title.toLowerCase().includes(query) ||
          game.locationName.toLowerCase().includes(query) ||
          game.groupName.toLowerCase().includes(query)
      );
    }

    // Sort by date
    games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return games;
  }, [searchQuery, statusFilter]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (d.toDateString() === tomorrow.toDateString()) {
      return 'Amanhã';
    }
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <Box sx={{ pb: 8 }}>
      {/* Search Bar */}
      <Box sx={{ p: 2, pb: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar jogos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Status Filters */}
        <Tabs
          value={statusFilter}
          onChange={(_, value) => setStatusFilter(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2, minHeight: 36 }}
        >
          <Tab value="all" label="Todos" sx={{ minHeight: 36, py: 0 }} />
          <Tab value="SCHEDULED" label="Abertos" sx={{ minHeight: 36, py: 0 }} />
          <Tab value="LIVE" label="Ao Vivo" sx={{ minHeight: 36, py: 0 }} />
          <Tab value="FINISHED" label="Finalizados" sx={{ minHeight: 36, py: 0 }} />
        </Tabs>
      </Box>

      {/* Games List */}
      <Box sx={{ px: 2 }}>
        {loading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent>
                <Skeleton variant="text" width="60%" height={28} />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="80%" />
              </CardContent>
            </Card>
          ))
        ) : filteredGames.length === 0 ? (
          // Empty state
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SportsSoccer sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogo encontrado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Crie um novo jogo para começar!
            </Typography>
          </Box>
        ) : (
          filteredGames.map((game) => (
            <Card key={game.id} sx={{ mb: 2 }}>
              <CardActionArea>
                <CardContent>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ flex: 1, mr: 1 }}>
                      {game.title}
                    </Typography>
                    <Chip
                      label={STATUS_CONFIG[game.status].label}
                      size="small"
                      sx={{
                        bgcolor: STATUS_CONFIG[game.status].color + '20',
                        color: STATUS_CONFIG[game.status].color,
                        fontWeight: 600,
                      }}
                    />
                  </Box>

                  {/* Info */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarMonth fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(game.date)} às {game.time}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationOn fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {game.locationName}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Footer */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        icon={<SportsSoccer />}
                        label={FIELD_TYPE_LABELS[game.fieldType]}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        icon={<People />}
                        label={`${game.playersCount}/${game.maxPlayers}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    {/* Score for live/finished games */}
                    {(game.status === 'LIVE' || game.status === 'FINISHED') && game.team1Score !== undefined && (
                      <Typography variant="h6" fontWeight="bold">
                        {game.team1Score} - {game.team2Score}
                      </Typography>
                    )}

                    {/* Price for scheduled games */}
                    {game.status === 'SCHEDULED' && (
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        R$ {game.dailyPrice.toFixed(0)}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))
        )}
      </Box>

      {/* FAB */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}
