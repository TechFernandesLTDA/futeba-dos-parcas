import Grid from '@mui/material/Unstable_Grid2';
import { PageContainer } from '../../components/common/PageContainer';
import React, { useState } from 'react';
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
  Stack,
  Tab,
  Tabs,
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
} from '@mui/icons-material';
import { AppBreadcrumbs, FixedBottomBar } from '../../components/layout';
import { useQueryClient } from '@tanstack/react-query';
import { useGroupDetail, useInvitePlayers } from '../../hooks/useGroups';
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

// Fix #414: ROLE_CONFIG extraído para constants/group.ts (single source of truth)
import { ROLE_CONFIG, getRoleColor } from '../../constants/group';

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
            <IconButton onClick={() => navigate(`/group/${groupId}/settings`)} aria-label={t('groupDetail.groupSettings')}>
              <SettingsIcon />
            </IconButton>
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
              variant="fullWidth"
              aria-label={t('groupDetail.sectionsAria')}
              sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
            >
              <Tab label={t('group.tabMembers')} />
              <Tab label={t('group.tabGames')} />
              <Tab label={t('group.tabCashbox')} />
              <Tab label={t('nav.league')} icon={<TrophyIcon />} iconPosition="start" />
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0 }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/game/create?groupId=${groupId}`)}
                >
                  {t('groupDetail.newGame')}
                </Button>
              </Box>

              {gamesLoading ? (
                <ShimmerLoading count={2} type="card" />
              ) : games.length === 0 ? (
                <EmptyState
                  icon={<SoccerIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled' }} />}
                  title={t('groupDetail.noGames')}
                  description={t('groupDetail.noGamesDesc')}
                  actionLabel={t('games.createGame')}
                  onAction={() => navigate(`/game/create?groupId=${groupId}`)}
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
                label={ROLE_CONFIG[member.role].label}
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
