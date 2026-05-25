import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Fab,
  TextField,
  InputAdornment,
  Grid,
  Skeleton,
  Alert,
  Button,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add,
  Search,
  People,
  Lock,
  Public,
  Star,
  Event,
  Close,
} from '@mui/icons-material';
import { useGroups } from '../../../hooks/useGroups';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDateShort } from '../../../utils/dateFormatters';

export function GroupsTab() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { groups, loading, error, refetch } = useGroups();

  const filteredGroups = useMemo(() => {
    if (!debouncedSearch) return groups;

    const query = debouncedSearch.toLowerCase();
    return groups.filter(
      group =>
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
    );
  }, [groups, debouncedSearch]);

  return (
    <Box sx={{ pb: 8, maxWidth: { xs: '100%', lg: 1200 }, mx: 'auto' }}>
      {/* Barra de busca */}
      <Box sx={{ p: 2, pb: 0 }}>
        {/* Header com título + Criar (md+) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            {t('groups.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/group/create')}
          >
            {t('groups.createGroup')}
          </Button>
        </Box>

        <TextField
          fullWidth
          size="small"
          placeholder={t('groups.search.placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('groups.search.ariaLabel')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')} edge="end" aria-label={t('groups.search.clear')} sx={{ minWidth: 44, minHeight: 44 }}>
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('groups.count', { count: filteredGroups.length })}
        </Typography>
      </Box>

      {/* Lista de grupos */}
      <Box sx={{ px: 2 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                {t('groups.retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="circular" width={56} height={56} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
                <Skeleton variant="text" width="80%" sx={{ mt: 1.5 }} />
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Skeleton variant="text" width="30%" />
                  <Skeleton variant="text" width="20%" />
                </Box>
              </CardContent>
            </Card>
          ))
        ) : filteredGroups.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <People sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? t('groups.noResultsSearch') : t('groups.noResults')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {searchQuery
                ? t('groups.tryDifferentSearch')
                : t('groups.createOrJoin')}
            </Typography>
            {searchQuery ? (
              <Button
                variant="outlined"
                onClick={() => setSearchQuery('')}
              >
                {t('groups.clearSearch')}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/group/create')}
              >
                {t('groups.createGroup')}
              </Button>
            )}
          </Box>
        ) : (
          <Grid container spacing={2}>
          {filteredGroups.map((group) => {
            const isOwner = group.role === 'OWNER';

            return (
              <Grid item xs={12} md={6} lg={4} key={group.id}>
              <Card sx={isMd ? { height: '100%' } : { mb: 2 }}>
                <CardActionArea onClick={() => navigate(`/group/${group.id}`)}>
                  <CardContent>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={group.photoUrl || undefined}
                        alt={group.name}
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: 'primary.main',
                          fontSize: '1.5rem',
                        }}
                      >
                        {group.name.charAt(0).toUpperCase()}
                      </Avatar>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold" noWrap>
                            {group.name}
                          </Typography>
                          {group.type === 'PUBLIC' ? (
                            <Public fontSize="small" color="action" aria-label={t('groups.publicGroupLabel')} />
                          ) : (
                            <Lock fontSize="small" color="action" aria-label={t('groups.privateGroupLabel')} />
                          )}
                        </Box>

                        {isOwner && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                            <Typography variant="caption" color="text.secondary">
                              {t('groups.owner')}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Descrição */}
                    {group.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {group.description}
                      </Typography>
                    )}

                    {/* Stats */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <People fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {t('groups.membersCount', { count: group.memberCount || 0 })}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('groups.gamesCount', { count: group.totalGamesPlayed || 0 })}
                      </Typography>
                    </Box>

                    {/* Próximo jogo */}
                    {group.nextGameDate && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 1.5,
                          p: 1,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        <Event fontSize="small" color="primary" />
                        <Typography variant="body2" color="primary.main" fontWeight="medium">
                          {t('groups.nextGame')}: {group.nextGameTitle || 'Jogo'} • {formatDateShort(group.nextGameDate)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
              </Grid>
            );
          })}
          </Grid>
        )}
      </Box>

      {/* FAB (xs/sm only) */}
        <Fab
          color="primary"
          aria-label={t('groups.createNewGroup')}
          onClick={() => navigate('/group/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          right: { xs: 16, sm: 'calc(50% - 240px + 16px)' },
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}
