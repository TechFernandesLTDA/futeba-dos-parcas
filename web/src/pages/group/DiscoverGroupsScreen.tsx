import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Group as GroupIcon,
  Public as PublicIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useDiscoverPublicGroups } from '../../hooks/useGroups';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Group } from '../../types/group';

/**
 * Tela de descoberta de grupos publicos (issue #517 Phase 1).
 *
 * Lista todos os grupos com is_public=true (excluindo soft-deleted).
 * Phase 1 e read-only: usuario pode ver mas nao pode pedir para entrar.
 * Phase 2 (PR futuro) adiciona "Pedir entrada" + aprovacao do owner.
 */
export const DiscoverGroupsScreen: React.FC = () => {
  useDocumentTitle('Descobrir Grupos');
  const navigate = useNavigate();
  const { groups, loading, error, refetch } = useDiscoverPublicGroups();

  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    return groups.filter(
      (g: Group) =>
        g.name?.toLowerCase().includes(q) ||
        (g as any).description?.toLowerCase().includes(q),
    );
  }, [groups, searchQuery]);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={() => navigate('/?tab=2')} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          Descobrir Grupos
        </Typography>
        <IconButton onClick={() => refetch()} aria-label="Atualizar">
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Alert severity="info" icon={<PublicIcon />} sx={{ mb: 3 }}>
        Toque em um grupo para ver detalhes e pedir para entrar.
      </Alert>

      <TextField
        fullWidth
        placeholder="Buscar por nome ou descrição"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {loading && (
        <Stack alignItems="center" spacing={2} mt={6}>
          <CircularProgress />
          <Typography color="text.secondary">Buscando grupos públicos…</Typography>
        </Stack>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Stack alignItems="center" spacing={2} mt={6}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
          <Typography variant="h6" color="text.secondary">
            {searchQuery ? 'Nenhum grupo encontrado' : 'Nenhum grupo público disponível'}
          </Typography>
        </Stack>
      )}

      {!loading && !error && filtered.length > 0 && (
        <Stack spacing={2}>
          {filtered.map((group: Group) => (
            <Card key={group.id}>
              <CardActionArea onClick={() => navigate(`/group/${group.id}`)}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={(group as any).photoUrl}
                      sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}
                    >
                      <GroupIcon />
                    </Avatar>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="h6" noWrap fontWeight="bold">
                        {group.name}
                      </Typography>
                      {(group as any).description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {(group as any).description}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1} mt={1}>
                        <Chip
                          icon={<PublicIcon />}
                          label="Público"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        {typeof (group as any).memberCount === 'number' && (
                          <Chip
                            label={`${(group as any).memberCount} membro${(group as any).memberCount === 1 ? '' : 's'}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
};
