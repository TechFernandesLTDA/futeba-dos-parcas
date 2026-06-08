import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  TextField,
  InputAdornment,
  Grid,
  Skeleton,
  Button,
  IconButton,
  useTheme,
  useMediaQuery,
  Stack,
  Chip,
  alpha,
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
  Explore,
  Groups as GroupsIcon,
  ArrowForward,
} from '@mui/icons-material';
import { useGroups } from '../../../hooks/useGroups';
import { iconSizes } from '../../../theme/iconSizes';
import { pageSpacing } from '../../../theme/pageTokens';
import { PullToRefresh } from '../../../components/common/PullToRefresh';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDateShort } from '../../../utils/dateFormatters';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import { ScreenFab } from '../../../components/layout';

export function GroupsTab() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { groups, loading, error, refetch } = useGroups();

  const handleRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  const filteredGroups = useMemo(() => {
    if (!debouncedSearch) return groups;

    const query = debouncedSearch.toLowerCase();
    return groups.filter(
      group =>
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
    );
  }, [groups, debouncedSearch]);

  const myGroupsCount = groups?.length || 0;
  const hasGroups = !loading && myGroupsCount > 0;

  return (
    <>
    <PageContainer maxWidth="list">
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
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight={600}>
              {t('groups.title')}
            </Typography>
            {hasGroups && (
              <Chip
                label={`${myGroupsCount}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Explore />}
              onClick={() => navigate('/groups/discover')}
            >
              Descobrir Grupos
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/group/create')}
            >
              {t('groups.createGroup')}
            </Button>
          </Stack>
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

        {/* Seção: Meus Grupos */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupsIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" color="primary.main" fontWeight={600}>
              Meus Grupos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {loading ? '...' : `${filteredGroups.length} grupo${filteredGroups.length !== 1 ? 's' : ''}`}
            </Typography>
          </Stack>
          <Button
            size="small"
            variant="text"
            startIcon={<Explore />}
            onClick={() => navigate('/groups/discover')}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, fontWeight: 600 }}
          >
            Descobrir
          </Button>
        </Stack>
      </Box>

      {/* Lista de grupos */}
      <PullToRefresh onRefresh={handleRefresh}>
      <Box sx={{ px: pageSpacing.pagePadding }}>
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => refetch()}
            retryLabel={t('groups.retry')}
          />
        ) : loading ? (
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
          // #2268: usa o componente EmptyState padrão (ícone circular + fade-in)
          searchQuery ? (
            <EmptyState
              icon={<People />}
              title={t('groups.noResultsSearch')}
              description={t('groups.tryDifferentSearch')}
              actionLabel={t('groups.clearSearch')}
              actionVariant="outlined"
              onAction={() => setSearchQuery('')}
            />
          ) : (
            <EmptyState
              icon={<People />}
              title={t('groups.noResults')}
              description={t('groups.createOrJoin')}
              actionLabel={t('groups.createGroup')}
              actionIcon={<Add />}
              onAction={() => navigate('/group/create')}
              secondaryActionLabel="Descobrir Grupos"
              secondaryActionIcon={<Explore />}
              onSecondaryAction={() => navigate('/groups/discover')}
            />
          )
        ) : (
          <Grid container spacing={2}>
          {filteredGroups.map((group) => {
            const isOwner = group.role === 'OWNER';

            return (
              <Grid item xs={12} md={6} lg={4} xl={3} key={group.id}>
              <Card sx={{ ...(isMd ? { height: '100%' } : { mb: 2 }), ...(isOwner ? { borderLeft: `4px solid ${theme.palette.warning.main}` } : {}) }}>
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
                          {/* #2213: ícone transmite estado (público/privado) — usar role="img"
                              para expor o aria-label a leitores de tela (SvgIcon sem role não
                              é anunciado de forma confiável). */}
                          {group.type === 'PUBLIC' ? (
                            <Public fontSize="small" color="action" role="img" aria-label={t('groups.publicGroupLabel')} />
                          ) : (
                            <Lock fontSize="small" color="action" role="img" aria-label={t('groups.privateGroupLabel')} />
                          )}
                        </Box>

                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                          {isOwner && (
                            <Chip
                              icon={<Star sx={{ fontSize: iconSizes.xs }} />}
                              label={t('groups.owner')}
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.75rem', px: 0.75 }, '& .MuiChip-icon': { ml: 0.5 } }}
                            />
                          )}
                          {group.type === 'PUBLIC' && (
                            <Chip
                              icon={<Public sx={{ fontSize: iconSizes.xs }} />}
                              label="Aberto"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.75rem', px: 0.75 }, '& .MuiChip-icon': { ml: 0.5 } }}
                            />
                          )}
                        </Stack>
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
                        <Typography variant="body2" color="primary.main" fontWeight="medium" noWrap>
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

        {/* Descobrir Grupos — CTA quando tem poucos grupos ou sempre visível */}
        {hasGroups && !searchQuery && (
          <Card
            sx={{
              mt: 2,
              border: (theme) => `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
            }}
          >
            <CardActionArea onClick={() => navigate('/groups/discover')}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Explore sx={{ color: 'primary.main' }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Descobrir mais grupos
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Encontre grupos oficiais por região, dia da semana ou tipo de campo. Entre com 1 clique!
                    </Typography>
                  </Box>
                  <ArrowForward color="action" sx={{ flexShrink: 0 }} />
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      </Box>
      </PullToRefresh>

      {/* #2178: ScreenFab padronizado (xs/sm only) */}
      <ScreenFab
        icon={<Add />}
        aria-label={t('groups.createNewGroup')}
        onClick={() => navigate('/group/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          bottom: { xs: pageSpacing.bottomBarHeight + 16, sm: pageSpacing.bottomBarHeight + 16, md: 24 },
          right: { xs: 16, md: 24 },
        }}
      />
    </PageContainer>
    </>
  );
}
