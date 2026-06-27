import { PageContainer } from '../../components/common/PageContainer';
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
  IconButton,
  InputAdornment,
  LinearProgress,
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
  Wc as GenderIcon,
} from '@mui/icons-material';
import { useOfficialGroups, useJoinOfficialGroup, useIsInOfficialGroup } from '../../hooks/useOfficialGroups';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { OfficialGroup, OfficialGroupCategory, OFFICIAL_GROUP_CATEGORY_LABELS } from '../../types/group';
import { useTranslation } from 'react-i18next';
import {
  rankOfficialGroupsForMatchmaking,
  type GroupMatchSuggestion,
  type GroupMatchmakingLabels,
} from '../../utils/groupMatchmaking';

const CATEGORY_ICONS: Record<OfficialGroupCategory, React.ReactElement> = {
  REGIAO: <LocationIcon />,
  DIA_SEMANA: <CalendarIcon />,
  TIPO_CAMPO: <SoccerIcon />,
  FAIXA_ETARIA: <AgeIcon />,
  GENERO: <GenderIcon />,
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
  const [regionQuery, setRegionQuery] = useState('');
  const [scheduleQuery, setScheduleQuery] = useState('');
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

  const suggestions = useMemo(
    () => {
      const labels: GroupMatchmakingLabels = {
        officialSuggestion: t('groups.matchmaking.officialSuggestion'),
        regionMatch: t('groups.matchmaking.regionMatch'),
        scheduleMatch: t('groups.matchmaking.scheduleMatch'),
        regionCategory: t('groups.matchmaking.regionCategory'),
        scheduleCategory: t('groups.matchmaking.scheduleCategory'),
        activeCommunity: t('groups.matchmaking.activeCommunity'),
      };

      return rankOfficialGroupsForMatchmaking(
        filtered,
        { region: regionQuery, schedule: scheduleQuery },
        labels
      );
    },
    [filtered, regionQuery, scheduleQuery, t]
  );

  const filteredByTab = useMemo(() => {
    if (tab === 0) return suggestions;
    const catKeys: OfficialGroupCategory[] = ['REGIAO', 'DIA_SEMANA', 'TIPO_CAMPO', 'FAIXA_ETARIA', 'GENERO'];
    const selectedCategory = catKeys[tab - 1];
    return suggestions.filter((suggestion) => suggestion.group.category === selectedCategory);
  }, [suggestions, tab]);

  const handleJoin = async (group: OfficialGroup) => {
    setJoiningId(group.id);
    try {
      await joinOfficial.mutateAsync(group);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <PageContainer maxWidth="list">
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={goBack} aria-label={t('a11y.back')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          Descobrir Grupos
        </Typography>
        <IconButton onClick={() => refetchOfficial()} aria-label={t('a11y.refresh')}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Alert severity="info" icon={<PublicIcon />} sx={{ mb: 2 }}>
        {t('groups.matchmaking.hero')}
      </Alert>

      <TextField
        fullWidth
        placeholder={t('placeholder.searchNameOrDescription')}
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

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {t('groups.matchmaking.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('groups.matchmaking.subtitle')}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label={t('groups.matchmaking.regionLabel')}
                placeholder={t('groups.matchmaking.regionPlaceholder')}
                value={regionQuery}
                onChange={(e) => setRegionQuery(e.target.value)}
                inputProps={{ maxLength: 120 }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('groups.matchmaking.scheduleLabel')}
                placeholder={t('groups.matchmaking.schedulePlaceholder')}
                value={scheduleQuery}
                onChange={(e) => setScheduleQuery(e.target.value)}
                inputProps={{ maxLength: 120 }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab label="Todos" />
        {(['REGIAO', 'DIA_SEMANA', 'TIPO_CAMPO', 'FAIXA_ETARIA', 'GENERO'] as OfficialGroupCategory[]).map((cat) => (
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
          {filteredByTab.map((suggestion) => (
            <OfficialGroupCard
              key={suggestion.group.id}
              suggestion={suggestion}
              onJoin={handleJoin}
              joiningId={joiningId}
            />
          ))}
        </Stack>
      )}
    </PageContainer>
  );
};

function OfficialGroupCard({
  suggestion,
  onJoin,
  joiningId,
}: {
  suggestion: GroupMatchSuggestion;
  onJoin: (g: OfficialGroup) => void;
  joiningId: string | null;
}) {
  const group = suggestion.group;
  const { data: isMember, isLoading: memberLoading } = useIsInOfficialGroup(group.id);
  const { t } = useTranslation();
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
                label={t('groups.matchmaking.score', { score: suggestion.score })}
                size="small"
                color={suggestion.score >= 75 ? 'success' : 'default'}
              />
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
            <LinearProgress
              variant="determinate"
              value={suggestion.score}
              color={suggestion.score >= 75 ? 'success' : 'primary'}
              sx={{ mt: 1, maxWidth: 280, borderRadius: 999 }}
            />
            {suggestion.reasons.length > 0 && (
              <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" useFlexGap>
                {suggestion.reasons.map((reason) => (
                  <Chip key={reason} label={reason} size="small" variant="outlined" />
                ))}
              </Stack>
            )}
          </Box>
          <Stack direction="column" spacing={1} alignItems="center">
            {isMember ? (
              <Chip label={t('groups.matchmaking.member')} color="success" size="small" />
            ) : (
              <Button
                variant="contained"
                size="small"
                disabled={loading}
                onClick={() => onJoin(group)}
                sx={{ minWidth: 80 }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : t('groups.matchmaking.joinGuided')}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
