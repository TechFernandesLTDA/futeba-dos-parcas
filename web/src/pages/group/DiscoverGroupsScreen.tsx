import React, { useMemo, useState } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Group as GroupIcon,
  Public as PublicIcon,
  Refresh as RefreshIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  SportsSoccer as SoccerIcon,
  EmojiPeople as AgeIcon,
} from '@mui/icons-material';
import { useOfficialGroups, useJoinOfficialGroup, useIsInOfficialGroup } from '../../hooks/useOfficialGroups';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { OfficialGroup, OfficialGroupCategory, OFFICIAL_GROUP_CATEGORY_LABELS } from '../../types/group';
import { useTranslation } from 'react-i18next';

const CATEGORY_ICONS: Record<OfficialGroupCategory, React.ReactElement> = {
  REGIAO: <LocationIcon />,
  DIA_SEMANA: <CalendarIcon />,
  TIPO_CAMPO: <SoccerIcon />,
  FAIXA_ETARIA: <AgeIcon />,
};

export const DiscoverGroupsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.discoverGroups'));
  const goBack = useNavigateBack('/?tab=2');
  const {
    data: officialGroups = [],
    isLoading: officialLoading,
    error: officialError,
    refetch: refetchOfficial,
  } = useOfficialGroups();
  const joinOfficial = useJoinOfficialGroup();

  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState(0);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return officialGroups;
    const q = searchQuery.toLowerCase().trim();
    return officialGroups.filter(
      (g: OfficialGroup) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q),
    );
  }, [officialGroups, searchQuery]);

  const filteredByTab = useMemo(() => {
    if (tab === 0) return filtered;
    const catKeys: OfficialGroupCategory[] = ['REGIAO', 'DIA_SEMANA', 'TIPO_CAMPO', 'FAIXA_ETARIA'];
    const selectedCategory = catKeys[tab - 1];
    return filtered.filter((g: OfficialGroup) => g.category === selectedCategory);
  }, [filtered, tab]);

  const handleJoin = async (group: OfficialGroup) => {
    setJoiningId(group.id);
    try {
      await joinOfficial.mutateAsync(group);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={goBack} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          Descobrir Grupos
        </Typography>
        <IconButton onClick={() => refetchOfficial()} aria-label="Atualizar">
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Alert severity="info" icon={<PublicIcon />} sx={{ mb: 2 }}>
        Grupos oficiais abertos! Entre com 1 clique e já comece a competir com a galera.
      </Alert>

      <TextField
        fullWidth
        placeholder="Buscar por nome ou descrição"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
        inputProps={{ maxLength: 200 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab label="Todos" />
        {(['REGIAO', 'DIA_SEMANA', 'TIPO_CAMPO', 'FAIXA_ETARIA'] as OfficialGroupCategory[]).map((cat) => (
          <Tab key={cat} label={OFFICIAL_GROUP_CATEGORY_LABELS[cat]} />
        ))}
      </Tabs>

      {officialLoading && (
        <Stack spacing={2} aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="circular" width={56} height={56} />
                  <Box flex={1} minWidth={0}>
                    <Skeleton variant="text" width="60%" height={28} />
                    <Skeleton variant="text" width="90%" />
                    <Stack direction="row" spacing={1} mt={1}>
                      <Skeleton variant="rounded" width={80} height={24} />
                      <Skeleton variant="rounded" width={100} height={24} />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {!officialLoading && officialError && (
        <ErrorState
          message={officialError instanceof Error ? officialError.message : 'Erro ao carregar grupos.'}
          onRetry={() => refetchOfficial()}
        />
      )}

      {!officialLoading && !officialError && filteredByTab.length === 0 && (
        <EmptyState
          icon={<GroupIcon />}
          title={searchQuery ? 'Nenhum grupo encontrado' : 'Nenhum grupo oficial disponível'}
        />
      )}

      {!officialLoading && !officialError && filteredByTab.length > 0 && (
        <Stack spacing={2}>
          {filteredByTab.map((group: OfficialGroup) => (
            <OfficialGroupCard
              key={group.id}
              group={group}
              onJoin={handleJoin}
              joiningId={joiningId}
            />
          ))}
        </Stack>
      )}
    </Container>
  );
};

function OfficialGroupCard({
  group,
  onJoin,
  joiningId,
}: {
  group: OfficialGroup;
  onJoin: (g: OfficialGroup) => void;
  joiningId: string | null;
}) {
  const { data: isMember, isLoading: memberLoading } = useIsInOfficialGroup(group.id);
  const isJoining = joiningId === group.id;
  const loading = memberLoading || isJoining;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
            {CATEGORY_ICONS[group.category] ?? <GroupIcon />}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="h6" noWrap fontWeight="bold">
              {group.name}
            </Typography>
            {group.description && (
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
                {group.description}
              </Typography>
            )}
            <Stack direction="row" spacing={1} mt={1} alignItems="center">
              <Chip
                label={OFFICIAL_GROUP_CATEGORY_LABELS[group.category]}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`${group.memberCount ?? 0} membro${group.memberCount === 1 ? '' : 's'}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
          <Stack direction="column" spacing={1} alignItems="center">
            {isMember ? (
              <Chip label="Membro" color="success" size="small" />
            ) : (
              <Button
                variant="contained"
                size="small"
                disabled={loading}
                onClick={() => onJoin(group)}
                sx={{ minWidth: 80 }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Entrar'}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
