import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
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
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Grid,
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
} from '@mui/icons-material';
import { AppBreadcrumbs } from '../../components/layout';
import { useGroupDetail, useInvitePlayers } from '../../hooks/useGroups';
import { useMyJoinRequest } from '../../hooks/useJoinRequests';
import { useGames } from '../../hooks/useGames';
import { softDeleteGroup } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { pluralizeCount } from '../../utils/pluralize';
import { GroupRole } from '../../types/group';
import { PlayerAvatar, EmptyState, ShimmerLoading } from '../../components/common/GameCard';
import { GameCard } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

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
import { ROLE_CONFIG } from '../../constants/group';

export const GroupDetailScreen: React.FC = () => {
  useDocumentTitle('Detalhes do Grupo');
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  // Breakpoints para layout responsivo
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));

  const { group, members, loading, error } = useGroupDetail(groupId || null);
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
      showError('Gere um convite primeiro');
      return;
    }
    const link = `${window.location.origin}/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Link copiado!');
    } catch (err) {
      showError('Erro ao copiar link');
    }
  };

  const handleShare = async () => {
    if (!inviteCode) {
      showError('Gere um convite primeiro');
      return;
    }
    const link = `${window.location.origin}/join/${inviteCode}`;
    if (navigator.share) {
      await navigator.share({
        title: `Convite: ${group?.name}`,
        text: `Venha jogar com a gente no grupo ${group?.name}!`,
        url: link,
      });
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
      showSuccess('Grupo excluído com sucesso');
      setTimeout(() => navigate('/?tab=2'), 1000);
    } catch (err) {
      showError((err as Error)?.message || 'Erro ao excluir grupo');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ShimmerLoading count={3} type="card" />
      </Container>
    );
  }

  if (error || !group) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Alert severity="error">{error || 'Grupo não encontrado'}</Alert>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/?tab=2')}>
            Voltar
          </Button>
          {error && (
            <Button variant="contained" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
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
          <IconButton onClick={() => navigate('/?tab=2')} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ flex: 1, ml: 1 }} noWrap>
            {group.name}
          </Typography>
          {isAdmin && (
            <IconButton onClick={() => navigate(`/group/${groupId}/edit`)} aria-label="Editar grupo">
              <EditIcon />
            </IconButton>
          )}
          <IconButton onClick={() => navigate(`/group/${groupId}/settings`)} aria-label="Configurações do grupo">
            <SettingsIcon />
          </IconButton>
          {isOwner && (
            <IconButton onClick={() => setDeleteDialogOpen(true)} color="error" aria-label="Excluir grupo">
              <DeleteIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <AppBreadcrumbs
        items={[
          { label: 'Grupos', to: '/?tab=2' },
          { label: group.name },
        ]}
      />

      {/* Painel de informações do grupo — reutilizado em xs/sm (inline) e lg (sidebar) */}
      {(() => {
        const infoPanel = (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar
                  src={group.photoUrl}
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'primary.main',
                    fontSize: '2rem',
                  }}
                >
                  {group.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {group.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <GroupIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {group.memberCount ?? 0} membros
                    </Typography>
                    {group.isPublic && (
                      <Chip label="Público" size="small" variant="outlined" />
                    )}
                  </Box>
                </Box>
              </Box>

              {group.description && (
                <Typography variant="body2" color="text.secondary">
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
                      {joinSubmitting ? 'Enviando…' : 'Pedir entrada'}
                    </Button>
                  )}
                  {joinRequest?.status === 'PENDING' && (
                    <Stack spacing={1}>
                      <Alert severity="info" icon={false}>
                        Aguardando aprovação do organizador
                      </Alert>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={cancelRequest}
                        disabled={joinSubmitting}
                      >
                        {joinSubmitting ? 'Cancelando…' : 'Cancelar pedido'}
                      </Button>
                    </Stack>
                  )}
                  {joinRequest?.status === 'REJECTED' && (
                    <Alert severity="warning" icon={false}>
                      Seu pedido foi recusado
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
              aria-label="Seções do grupo"
              sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
            >
              <Tab label="Membros" />
              <Tab label="Jogos" />
              <Tab label="Caixa" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0 }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setInviteDialogOpen(true);
                    handleGenerateInvite();
                  }}
                >
                  Convidar
                </Button>
              </Box>

              {members.length === 0 ? (
                <EmptyState
                  icon={<PersonIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
                  title="Nenhum membro"
                  description="O grupo ainda não tem membros. Convide amigos pra começar!"
                  action={{
                    label: 'Convidar',
                    onClick: () => setInviteDialogOpen(true),
                  }}
                />
              ) : (
                <List disablePadding aria-label="Membros do grupo">
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
                  Novo Jogo
                </Button>
              </Box>

              {gamesLoading ? (
                <ShimmerLoading count={2} type="card" />
              ) : games.length === 0 ? (
                <EmptyState
                  icon={<SoccerIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
                  title="Nenhum jogo"
                  description="O grupo ainda não tem jogos agendados"
                  action={{
                    label: 'Criar Jogo',
                    onClick: () => navigate(`/game/create?groupId=${groupId}`),
                  }}
                />
              ) : (
                <Box sx={{ p: 2 }}>
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
                    Saldo Atual
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
                  Ver Detalhes
                </Button>
              </CardContent>
            </TabPanel>
          </Card>
        );

        // lg+: split-pane com sidebar de informações
        if (isLg) {
          return (
            <Container maxWidth="xl" sx={{ py: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} lg={4}>
                  {infoPanel}
                </Grid>
                <Grid item xs={12} lg={8}>
                  {mainContent}
                </Grid>
              </Grid>
            </Container>
          );
        }

        // md: container mais largo, layout linear
        if (isMd) {
          return (
            <Container maxWidth="md" sx={{ py: 2 }}>
              {infoPanel}
              {mainContent}
            </Container>
          );
        }

        // xs/sm: comportamento original (sem mudança)
        return (
          <Container maxWidth="sm" sx={{ py: 2 }}>
            {infoPanel}
            {mainContent}
          </Container>
        );
      })()}

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: { xs: 0, sm: '50%' },
          right: { xs: 0, sm: 'auto' },
          transform: { sm: 'translateX(-50%)' },
          width: { xs: '100%', sm: 480 },
          maxWidth: 480,
          bgcolor: 'background.paper',
          borderTop: `1px solid ${theme.palette.divider}`,
          p: 2,
          zIndex: 10,
        }}
      >
        <Container maxWidth="sm">
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => navigate(`/game/create?groupId=${groupId}`)}
          >
            Criar Jogo
          </Button>
        </Container>
      </Box>

      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="invite-dialog-title">
        <DialogTitle id="invite-dialog-title">Convidar Jogadores</DialogTitle>
        <DialogContent>
          {inviteLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <Skeleton variant="rectangular" width="100%" height={100} />
            </Box>
          ) : (
            <Box sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Compartilhe o link abaixo para convidar jogadores
              </Alert>

              <TextField
                label="Código do Convite"
                value={inviteCode}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton onClick={handleCopyInvite} edge="end" aria-label="Copiar código do convite">
                      <CopyIcon />
                    </IconButton>
                  ),
                }}
              />

              <TextField
                label="Link de Convite"
                value={`${window.location.origin}/join/${inviteCode}`}
                fullWidth
                sx={{ mt: 2 }}
                InputProps={{
                  readOnly: true,
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Fechar</Button>
          <Button
            variant="contained"
            startIcon={<ShareIcon />}
            onClick={handleShare}
          >
            Compartilhar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="delete-group-dialog-title">
        <DialogTitle id="delete-group-dialog-title">Excluir Grupo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja excluir o grupo "{group?.name}"? Esta ação pode ser revertida por um administrador.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteGroup} color="error" variant="contained" disabled={deleteLoading}>
            {deleteLoading ? 'Excluindo...' : 'Excluir'}
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
  member: { userId: string; userName: string; userPhotoUrl?: string; level?: number; role: GroupRole; totalGames: number };
  showDivider: boolean;
}) {
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
              <Chip
                label={ROLE_CONFIG[member.role].label}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: alpha(ROLE_CONFIG[member.role].color, 0.1),
                  color: ROLE_CONFIG[member.role].color,
                }}
              />
            </Box>
          }
          secondary={pluralizeCount(member.totalGames, 'jogo', 'jogos')}
        />
      </ListItem>
      {showDivider && <Divider />}
    </React.Fragment>
  );
});
