import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  SportsSoccer as SoccerIcon,
  Groups as GroupsIcon,
  Sports as SportsIcon,
} from '@mui/icons-material';
import { LoadingState } from '../../components/common/GameCard';
import { useSearch, SearchResult } from '../../hooks/useSearch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const TAB_TO_TYPE: Record<number, 'all' | 'users' | 'groups' | 'games' | 'locations'> = {
  0: 'all',
  1: 'users',
  2: 'groups',
  3: 'games',
};

export const GlobalSearchScreen: React.FC = () => {
  useDocumentTitle('Busca');
  const navigate = useNavigate();
  const theme = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);

  const searchType = useMemo(() => TAB_TO_TYPE[tabValue] ?? 'all', [tabValue]);
  const { results, loading } = useSearch(searchQuery, searchType);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'user':
        navigate(`/profile/${result.id}`);
        break;
      case 'group':
        navigate(`/group/${result.id}`);
        break;
      case 'game':
        navigate(`/game/${result.id}`);
        break;
      case 'location':
        navigate(`/location/${result.id}`);
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <PersonIcon />;
      case 'group':
        return <GroupsIcon />;
      case 'game':
        return <SoccerIcon />;
      case 'location':
        return <SportsIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'user':
        return theme.palette.primary.main;
      case 'group':
        return theme.palette.secondary.main;
      case 'game':
        return theme.palette.success.main;
      case 'location':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

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
            Buscar
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar jogadores, grupos, jogos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            autoFocus
            aria-label="Buscar jogadores, grupos ou jogos"
          />
        </Box>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth" aria-label="Filtrar resultados por tipo">
          <Tab label="Todos" />
          <Tab label="Jogadores" />
          <Tab label="Grupos" />
          <Tab label="Jogos" />
        </Tabs>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={6} itemType="LIST" />
        ) : results.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? 'Nenhum resultado encontrado' : 'Digite para buscar'}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {searchQuery ? 'Tente outros termos' : 'Busque por jogadores, grupos ou jogos'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Resultados da busca">
            {results.map((result, index) => (
              <Box key={`${result.type}-${result.id}`}>
                {index > 0 && <Divider />}
                <ListItem
                  button
                  onClick={() => handleResultClick(result)}
                  sx={{ py: 1.5 }}
                >
                  <ListItemAvatar>
                    {result.photoUrl ? (
                      <Avatar src={result.photoUrl} />
                    ) : (
                      <Avatar sx={{ bgcolor: getTypeColor(result.type) }}>
                        {getTypeIcon(result.type)}
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={result.name}
                    secondary={result.subtitle}
                  />
                  <Chip
                    label={result.type === 'user' ? 'Jogador' : result.type === 'group' ? 'Grupo' : result.type === 'game' ? 'Jogo' : 'Local'}
                    size="small"
                    sx={{
                      bgcolor: alpha(getTypeColor(result.type), 0.1),
                      color: getTypeColor(result.type),
                    }}
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
};
