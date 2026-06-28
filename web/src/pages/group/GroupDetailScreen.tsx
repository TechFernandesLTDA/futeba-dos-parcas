import Grid from '@mui/material/Unstable_Grid2';
import { PageContainer } from '../../components/common/PageContainer';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  CircularProgress,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  AvatarGroup,
  Stack,
  Tab,
  Tabs,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  SportsSoccer as SoccerIcon,
  AttachMoney as MoneyIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  EmojiEvents as TrophyIcon,
  Poll as PollIcon,
  People as PeopleIcon,
  EventRepeat as SchedulesIcon,
  MilitaryTech as ChallengesIcon,
  PhotoLibrary as PhotoLibraryIcon,
} from '@mui/icons-material';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { AppBreadcrumbs, FixedBottomBar } from '../../components/layout';
import { useQueryClient } from '@tanstack/react-query';
import { useGroupDetail, useInvitePlayers } from '../../hooks/useGroups';
import { GroupPoll, useCreateGroupPoll, useGroupPolls, useVoteGroupPoll } from '../../hooks/useGroupPolls';
import { useMyJoinRequest } from '../../hooks/useJoinRequests';
import { useGames } from '../../hooks/useGames';
import { softDeleteGroup } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { GroupRole } from '../../types/group';
import { PlayerAvatar, ShimmerLoading } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorScreen } from '../../components/common/ErrorScreen';
import { TeamBadge } from '../../components/team/TeamBadge';
import { GameCard } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { iconSizes } from '../../theme/iconSizes';
import { db } from '../../services/firebase';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

const PollsPanel: React.FC<{ groupId: string; canCreate: boolean }> = ({ groupId, canCreate }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { polls, loading, error, refetch } = useGroupPolls(groupId);
  const createPoll = useCreateGroupPoll(groupId);
  const votePoll = useVoteGroupPoll(groupId);
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('Domingo de manhã\nQuarta à noite');

  return (
    <CardContent>
      <Stack spacing={2}>
        {canCreate && (
          <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>{t('groupPolls.createTitle')}</Typography>
              <TextField label={t('groupPolls.question')} value={question} onChange={(event) => setQuestion(event.target.value)} fullWidth size="small" inputProps={{ maxLength: 120 }} sx={{ mb: 1.5 }} />
              <TextField label={t('groupPolls.options')} value={optionsText} onChange={(event) => setOptionsText(event.target.value)} fullWidth multiline minRows={3} helperText={t('groupPolls.optionsHelp')} />
              <Button
                variant="contained"
                startIcon={createPoll.isPending ? <CircularProgress size={16} color="inherit" /> : <PollIcon />}
                onClick={() => createPoll.mutate({ question, options: optionsText.split('\n') }, {
                  onSuccess: () => {
                    setQuestion('');
                    setOptionsText('Domingo de manhã\nQuarta à noite');
                  },
                })}
                disabled={createPoll.isPending}
                sx={{ mt: 2 }}
              >
                {createPoll.isPending ? t('common.saving') : t('groupPolls.create')}
              </Button>
            </CardContent>
          </Card>
        )}
        {loading && <ShimmerLoading count={2} type="card" />}
        {error && <Alert severity="error" action={<Button onClick={() => refetch()}>{t('common.retry')}</Button>}>{error}</Alert>}
        {!loading && !error && polls.length === 0 && (
          <EmptyState icon={<PollIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />} title={t('groupPolls.emptyTitle')} description={t('groupPolls.emptyDesc')} />
        )}
        {!loading && !error && polls.map((poll) => (
          <PollCard key={poll.id} poll={poll} voting={votePoll.isPending} onVote={(optionId) => votePoll.mutate({ pollId: poll.id, optionId })} />
        ))}
      </Stack>
    </CardContent>
  );
};

const PollCard: React.FC<{ poll: GroupPoll; voting: boolean; onVote: (optionId: string) => void }> = ({ poll, voting, onVote }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700}>{poll.question}</Typography>
        <Typography variant="caption" color="text.secondary">{t('groupPolls.by', { name: poll.createdByName })}</Typography>
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {poll.options.map((option) => {
            const count = poll.voteCounts[option.id] ?? 0;
            const percent = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
            const selected = poll.myVote === option.id;
            return (
              <Box key={option.id}>
                <Button variant={selected ? 'contained' : 'outlined'} fullWidth onClick={() => onVote(option.id)} disabled={voting || poll.status !== 'ACTIVE'} sx={{ justifyContent: 'space-between', textTransform: 'none' }}>
                  <span>{option.text}</span>
                  <span>{percent}%</span>
                </Button>
                <LinearProgress variant="determinate" value={percent} sx={{ mt: 0.5, height: 6, borderRadius: 99, bgcolor: alpha(theme.palette.primary.main, 0.08) }} />
              </Box>
            );
          })}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>{t('groupPolls.totalVotes', { count: poll.totalVotes })}</Typography>
      </CardContent>
    </Card>
  );
};

interface GroupPhotoPreview {
  id: string;
  gameId: string;
  gameTitle: string;
  url: string;
  uploadedByName: string;
  uploadedByPhoto?: string;
  caption?: string;
  createdAt?: Date;
}

const GroupPhotosPanel: React.FC<{
  games: Array<{ id: string; title?: string; dateTime?: Date }>;
  loadingGames: boolean;
}> = ({ games, loadingGames }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [photos, setPhotos] = useState<GroupPhotoPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<GroupPhotoPreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPhotos = async () => {
      if (loadingGames) {
        setLoading(true);
        return;
      }

      if (games.length === 0) {
        setPhotos([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const gameLookup = new Map(games.map((game) => [game.id, game]));
        const chunks: string[][] = [];
        for (let i = 0; i < games.length; i += 10) {
          chunks.push(games.slice(i, i + 10).map((game) => game.id));
        }

        const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(
          collection(db, 'game_photos'),
          where('game_id', 'in', chunk),
          limit(60),
        ))));

        if (cancelled) return;

        const nextPhotos = snapshots.flatMap((snapshot) => snapshot.docs.map((photoDoc) => {
          const raw = photoDoc.data();
          const game = gameLookup.get(String(raw.game_id));
          return {
            id: photoDoc.id,
            gameId: String(raw.game_id),
            gameTitle: game?.title || (game?.dateTime ? game.dateTime.toLocaleDateString(navigator.language || 'pt-BR') : t('games.game')),
            url: String(raw.url || ''),
            uploadedByName: String(raw.uploaded_by_name || t('common.player')),
            uploadedByPhoto: raw.uploaded_by_photo ? String(raw.uploaded_by_photo) : undefined,
            caption: raw.caption ? String(raw.caption) : undefined,
            createdAt: raw.created_at?.toDate?.(),
          };
        }))
          .filter((photo) => photo.url)
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
          .slice(0, 60);

        setPhotos(nextPhotos);
      } catch {
        if (!cancelled) setError(t('groupPhotos.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [games, loadingGames, t]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={<PhotoLibraryIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
        title={t('groupPhotos.emptyTitle')}
        description={t('groupPhotos.emptyDesc')}
      />
    );
  }

  return (
    <>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <PhotoLibraryIcon color="primary" />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('groupPhotos.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('groupPhotos.description', { count: photos.length })}</Typography>
          </Box>
          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
            {photos.slice(0, 8).map((photo) => (
              <Avatar key={photo.id} src={photo.uploadedByPhoto}>{photo.uploadedByName.charAt(0).toUpperCase()}</Avatar>
            ))}
          </AvatarGroup>
        </Stack>
        <Grid container spacing={1.5}>
          {photos.map((photo) => (
            <Grid xs={6} sm={4} md={3} key={photo.id}>
              <Box
                onClick={() => setSelectedPhoto(photo)}
                sx={{
                  position: 'relative',
                  pt: '100%',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'action.hover',
                  boxShadow: `0 0 0 1px ${alpha(theme.palette.common.white, 0.08)} inset`,
                }}
              >
                <Box component="img" src={photo.url} alt={t('groupPhotos.photoAlt', { name: photo.uploadedByName })} loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <Box sx={{ position: 'absolute', insetInline: 0, bottom: 0, p: 1, background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.common.black, 0.74)})`, color: theme.palette.common.white }}>
                  <Typography variant="caption" fontWeight={700} noWrap>{photo.gameTitle}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>

      <Dialog open={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} maxWidth="md" fullWidth>
        {selectedPhoto && (
          <>
            <Box sx={{ bgcolor: theme.palette.common.black, display: 'flex', justifyContent: 'center' }}>
              <Box component="img" src={selectedPhoto.url} alt={t('groupPhotos.photoAlt', { name: selectedPhoto.uploadedByName })} sx={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain' }} />
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2 }}>
              <Avatar src={selectedPhoto.uploadedByPhoto}>{selectedPhoto.uploadedByName.charAt(0).toUpperCase()}</Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>{selectedPhoto.uploadedByName}</Typography>
                <Typography variant="caption" color="text.secondary">{selectedPhoto.gameTitle}</Typography>
                {selectedPhoto.caption && <Typography variant="body2" color="text.secondary">{selectedPhoto.caption}</Typography>}
              </Box>
              <Button onClick={() => setSelectedPhoto(null)}>{t('common.close')}</Button>
            </Stack>
          </>
        )}
      </Dialog>
    </>
  );
};

import { getRoleColor } from '../../constants/group';

export const GroupDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('group.detailTitle'));
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  // Breakpoints para layout responsivo
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));

  // FIX #1411: maxWidth unificado entre loading/erro/conteúdo para evitar CLS
  // (loading antes era sempre 'sm', conteúdo expandia para 'md'/'xl' → salto visual ao terminar carregamento).
  const containerMaxWidth: 'sm' | 'md' | 'xl' = isLg ? 'xl' : isMd ? 'md' : 'sm';

  const { group, groupDeleted, members, loading, error } = useGroupDetail(groupId || null);
  const { games, loading: gamesLoading } = useGames({ groupId: groupId || undefined, limitCount: 5 });
  const { games: photoGames, loading: photoGamesLoading } = useGames({ groupId: groupId || undefined, limitCount: 50 });
  const { generateInviteCode, loading: inviteLoading } = useInvitePlayers();

  const [tabValue, setTabValue] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const myMember = members.find((m) => m.userId === currentUser?.uid);
  const isOwner = myMember?.role === 'OWNER';
  const isAdmin = myMember?.role === 'ADMIN' || isOwner;
  const isMember = !!myMember;
  const canCreateGroupGame = isMember;
  // Habilita listener de join request apenas se nao-membro em grupo publico.
  const shouldTrackJoinRequest = !isMember && group?.isPublic === true;
  const {
    request: joinRequest,
    submitting: joinSubmitting,
    requestJoin,
    cancelRequest,
  } = useMyJoinRequest(shouldTrackJoinRequest ? groupId : undefined);

  const handleGenerateInvite = async () => {
    if (!groupId || !group) return;

    try {
      const code = await generateInviteCode(groupId, group.name);
      setInviteCode(code);
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  const handleCopyInvite = async () => {
    // Guard issue #514: sem codigo o link sai /join/ (sem param)
    if (!inviteCode) {
      showError(t('group.generateInviteFirst'));
      return;
    }
    const link = `${window.location.origin}/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess(t('group.linkCopied'));
    } catch {
      showError(t('group.copyLinkError'));
    }
  };

  const handleShare = async () => {
    if (!inviteCode) {
      showError(t('group.generateInviteFirst'));
      return;
    }
    const link = `${window.location.origin}/join/${inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('groupDetail.shareTitle', { name: group?.name || '' }),
          text: t('groupDetail.shareText', { name: group?.name || '' }),
          url: link,
        });
      } catch (err) {
        // #2281: ignora cancelamento da share sheet; reporta demais erros.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        showError(t('group.shareError', 'Erro ao compartilhar'));
      }
    } else {
      handleCopyInvite();
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    setDeleteLoading(true);
    try {
      await softDeleteGroup({ groupId });
      setDeleteDialogOpen(false);
      showSuccess(t('groupDetail.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['groups', currentUser?.uid || ''] });
      // #1591: navega diretamente após await sem setTimeout frágil
      navigate('/?tab=2');
    } catch (err) {
      showError(getFirestoreErrorMessage(err, t('groupDetail.deleteError')));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="detail">
        <ShimmerLoading count={3} type="card" />
      </PageContainer>
    );
  }

  if (groupDeleted) {
    return (
      <PageContainer maxWidth="detail">
        <EmptyState
          icon={<GroupIcon sx={{ fontSize: iconSizes.hero }} />}
          title={t('groupDetail.closedTitle')}
          description={t('groupDetail.closedDesc')}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/?tab=2')}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      // #2178: ErrorScreen padronizado
      <ErrorScreen
        message={error}
        onRetry={() => queryClient.invalidateQueries()}
        onBack={() => navigate('/?tab=2')}
        backLabel={t('common.back')}
        maxWidth={containerMaxWidth}
      />
    );
  }

  if (!group) {
    return (
      <PageContainer maxWidth="detail">
        <EmptyState
          icon={<GroupIcon sx={{ fontSize: iconSizes.hero }} />}
          title={t('groupDetail.notFound')}
          description={t('groupDetail.notFoundDesc')}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/?tab=2')}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      <ScreenHeader
        title={group.name}
        onBack={() => navigate('/?tab=2')}
        actions={
          <>
            {isAdmin && (
              <IconButton onClick={() => navigate(`/group/${groupId}/edit`)} aria-label={t('groups.editGroup')}>
                <EditIcon />
              </IconButton>
            )}
            {isMember && (
              <IconButton onClick={() => navigate(`/group/${groupId}/settings`)} aria-label={t('groupDetail.groupSettings')}>
                <SettingsIcon />
              </IconButton>
            )}
            {isOwner && (
              <IconButton onClick={() => setDeleteDialogOpen(true)} color="error" aria-label={t('groups.deleteGroup')}>
                <DeleteIcon />
              </IconButton>
            )}
          </>
        }
      />

      <AppBreadcrumbs
        items={[
          { label: t('nav.groups'), to: '/?tab=2' },
          { label: group.name },
        ]}
      />

      {/* Painel de informações do grupo — reutilizado em xs/sm (inline) e lg (sidebar) */}
      {(() => {
        const infoPanel = (
          <Card sx={{ mb: 2, overflow: 'hidden' }}>
            <Box
              sx={{
                height: 120,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                position: 'relative',
              }}
            >
              <Avatar
                src={group.photoUrl}
                sx={{
                  position: 'absolute',
                  bottom: -36,
                  left: 20,
                  width: 72,
                  height: 72,
                  bgcolor: 'primary.main',
                  border: `4px solid ${theme.palette.background.paper}`,
                  fontSize: '2rem',
                }}
              >
                {group.name.charAt(0).toUpperCase()}
              </Avatar>
            </Box>
            <CardContent sx={{ pt: 5.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {group.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip icon={<GroupIcon />} label={t('groups.membersCount', { count: group.memberCount ?? 0 })} size="small" />
                    <Chip icon={<SoccerIcon />} label={t('groups.gamesCount', { count: games.length })} size="small" variant="outlined" />
                    {group.isPublic && (
                      <Chip label={t('group.public')} size="small" variant="outlined" />
                    )}
                  </Box>
                </Box>
              </Box>

              {group.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {group.description}
                </Typography>
              )}

              {isMember && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.8 }}>
                    {t('groupDetail.quickActions')}
                  </Typography>
                  <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    {[
                      { label: t('group.tabMembers'), icon: <PeopleIcon />, to: `/group/${groupId}/players` },
                      { label: t('groupDetail.schedules'), icon: <SchedulesIcon />, to: `/group/${groupId}/schedules` },
                      { label: t('groupDetail.challenges'), icon: <ChallengesIcon />, to: `/group/${groupId}/challenges` },
                      ...(isAdmin ? [{ label: t('groups.invitePlayers'), icon: <ShareIcon />, to: `/group/${groupId}/invite` }] : []),
                    ].map((action) => (
                      <Grid xs={6} key={action.to}>
                        <Button
                          variant="outlined"
                          fullWidth
                          size="small"
                          startIcon={action.icon}
                          onClick={() => navigate(action.to)}
                          sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                        >
                          {action.label}
                        </Button>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {shouldTrackJoinRequest && (
                <Box sx={{ mt: 2 }}>
                  {!joinRequest && (
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={requestJoin}
                      disabled={joinSubmitting}
                    >
                      {joinSubmitting ? t('group.sending') : t('group.requestJoin')}
                    </Button>
                  )}
                  {joinRequest?.status === 'PENDING' && (
                    <Stack spacing={1}>
                      <Alert severity="info" icon={false}>
                        {t('group.awaitingApproval')}
                      </Alert>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={cancelRequest}
                        disabled={joinSubmitting}
                      >
                        {joinSubmitting ? t('group.cancelling') : t('group.cancelRequest')}
                      </Button>
                    </Stack>
                  )}
                  {joinRequest?.status === 'REJECTED' && (
                    <Alert severity="warning" icon={false}>
                      {t('group.requestRejected')}
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        );

        const mainContent = (
          <Card sx={{ mb: 2 }}>
            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              variant={isMobile ? 'scrollable' : 'fullWidth'}
              scrollButtons={isMobile ? 'auto' : false}
              allowScrollButtonsMobile
              aria-label={t('groupDetail.sectionsAria')}
              sx={{
                borderBottom: `1px solid ${theme.palette.divider}`,
                '& .MuiTab-root': {
                  minWidth: isMobile ? 112 : undefined,
                  px: isMobile ? 1.5 : undefined,
                },
              }}
            >
              <Tab label={t('group.tabMembers')} />
              <Tab label={t('group.tabGames')} />
              <Tab label={t('group.tabCashbox')} />
              <Tab label={t('nav.league')} icon={<TrophyIcon />} iconPosition="start" />
              <Tab label={t('groupPolls.tab')} icon={<PollIcon />} iconPosition="start" />
              <Tab label={t('groupPhotos.tab')} icon={<PhotoLibraryIcon />} iconPosition="start" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {isAdmin && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0 }}>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setInviteDialogOpen(true);
                    }}
                  >
                    {t('groupDetail.invite')}
                  </Button>
                </Box>
              )}

              {members.length === 0 ? (
                <EmptyState
                  icon={<PersonIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
                  title={t('groupDetail.noMembers')}
                  description={t('groupDetail.noMembersDesc')}
                  actionLabel={isAdmin ? t('groupDetail.invite') : undefined}
                  onAction={isAdmin ? () => setInviteDialogOpen(true) : undefined}
                />
              ) : (
                <List disablePadding aria-label={t('group.membersAria')}>
                  {members.map((member, index) => (
                    <GroupMemberItem
                      key={member.userId}
                      member={member}
                      showDivider={index < members.length - 1}
                    />
                  ))}
                </List>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {canCreateGroupGame && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0 }}>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => navigate(`/game/create?groupId=${groupId}`)}
                  >
                    {t('groupDetail.newGame')}
                  </Button>
                </Box>
              )}

              {gamesLoading ? (
                <ShimmerLoading count={2} type="card" />
              ) : games.length === 0 ? (
                <EmptyState
                  icon={<SoccerIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
                  title={t('groupDetail.noGames')}
                  description={t('groupDetail.noGamesDesc')}
                  actionLabel={canCreateGroupGame ? t('games.createGame') : undefined}
                  onAction={canCreateGroupGame ? () => navigate(`/game/create?groupId=${groupId}`) : undefined}
                />
              ) : (
                <Box className="stagger-fade-in" sx={{ p: 2 }}>
                  {games.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onClick={() => navigate(`/game/${game.id}`)}
                    />
                  ))}
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('groupDetail.currentBalance')}
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    color={(group.totalBalance || 0) >= 0 ? 'success.main' : 'error.main'}
                  >
                    R$ {(group.totalBalance || 0).toFixed(2)}
                  </Typography>
                </Box>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<MoneyIcon />}
                  onClick={() => navigate(`/group/${groupId}/cashbox`)}
                >
                  {t('groupDetail.viewDetails')}
                </Button>
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <TrophyIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled', mb: 2 }} />
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {t('groupDetail.groupLeague')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('groupDetail.groupLeagueDesc')}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<TrophyIcon />}
                  onClick={() => navigate(`/group/${groupId}/league`)}
                >
                  {t('groupDetail.viewStandings')}
                </Button>
              </CardContent>
            </TabPanel>

            <TabPanel value={tabValue} index={4}>
              <PollsPanel groupId={groupId!} canCreate={isAdmin} />
            </TabPanel>

            <TabPanel value={tabValue} index={5}>
              <GroupPhotosPanel games={photoGames} loadingGames={photoGamesLoading} />
            </TabPanel>
          </Card>
        );

        // lg+: split-pane com sidebar de informações
        if (isLg) {
          return (
            <PageContainer maxWidth="detail">
              <Grid container spacing={3}>
                <Grid xs={12} lg={4}>
                  {infoPanel}
                </Grid>
                <Grid xs={12} lg={8}>
                  {mainContent}
                </Grid>
              </Grid>
            </PageContainer>
          );
        }

        // md: container mais largo, layout linear
        if (isMd) {
          return (
            <PageContainer maxWidth="detail">
              {infoPanel}
              {mainContent}
            </PageContainer>
          );
        }

        // xs/sm: comportamento original (sem mudança)
        return (
          <PageContainer maxWidth="detail">
            {infoPanel}
            {mainContent}
          </PageContainer>
        );
      })()}

      {/* #1328: spacer p/ a barra fixa "Criar Jogo" nunca sobrepor o último
          conteúdo (mobile bottom-bar e barra flutuante desktop). */}
      <Box aria-hidden sx={{ height: { xs: 80, sm: 88 } }} />

      {/* #2164/#2270: barra fixa via FixedBottomBar (centralizada no conteúdo
          + safe-area), substituindo a versão hand-rolled centrada no viewport. */}
      {canCreateGroupGame && (
        <FixedBottomBar>
          <PageContainer maxWidth="detail" disablePadding>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => navigate(`/game/create?groupId=${groupId}`)}
            >
              {t('games.createGame')}
            </Button>
          </PageContainer>
        </FixedBottomBar>
      )}

      <Dialog open={inviteDialogOpen} onClose={() => { setInviteDialogOpen(false); setInviteCode(''); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="invite-dialog-title">
        <DialogTitle id="invite-dialog-title">{t('groups.invitePlayers')}</DialogTitle>
        <DialogContent>
          {inviteLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : inviteCode ? (
            <Box sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('groupDetail.shareInviteLink')}
              </Alert>

              <TextField
                label={t('groupDetail.inviteCode')}
                value={inviteCode}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton onClick={handleCopyInvite} edge="end" aria-label={t('groupDetail.copyInviteCode')}>
                      <CopyIcon />
                    </IconButton>
                  ),
                }}
              />

              <TextField
                label={t('groupDetail.inviteLink')}
                value={`${window.location.origin}/join/${inviteCode}`}
                fullWidth
                sx={{ mt: 2 }}
                InputProps={{
                  readOnly: true,
                }}
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('groupDetail.generateInvitePrompt')}
              </Typography>
              <Button
                variant="contained"
                onClick={handleGenerateInvite}
                startIcon={<AddIcon />}
              >
                {t('groupDetail.generateInvite')}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteDialogOpen(false); setInviteCode(''); }}>{t('common.close')}</Button>
          {inviteCode && (
            <Button
              variant="contained"
              startIcon={<ShareIcon />}
              onClick={handleShare}
            >
              {t('common.share')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="delete-group-dialog-title">
        <DialogTitle id="delete-group-dialog-title">{t('groups.deleteGroup')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('groupDetail.deleteConfirm', { name: group?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteGroup}
            color="error"
            variant="contained"
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
            disabled={deleteLoading}
          >
            {deleteLoading ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const GroupMemberItem = React.memo(function GroupMemberItem({
  member,
  showDivider,
}: {
  member: { userId: string; userName: string; userPhotoUrl?: string; level?: number; role: GroupRole; totalGames: number; favoriteTeam?: string };
  showDivider: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <React.Fragment>
      <ListItem sx={{ py: 1.5 }}>
        <ListItemAvatar>
          <PlayerAvatar
            name={member.userName}
            photoUrl={member.userPhotoUrl}
            size={48}
            level={member.level}
          />
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={500}>
                {member.userName}
              </Typography>
              <TeamBadge teamId={member.favoriteTeam} size={18} />
              <Chip
                label={t(`group.role.${member.role.toLowerCase()}`)}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  bgcolor: alpha(getRoleColor(theme, member.role), 0.1),
                  color: getRoleColor(theme, member.role),
                }}
              />
            </Box>
          }
          secondary={t('groups.gamesCount', { count: member.totalGames })}
        />
      </ListItem>
      {showDivider && <Divider />}
    </React.Fragment>
  );
});
