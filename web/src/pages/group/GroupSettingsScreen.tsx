import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  Alert,
  Stack,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  ExitToApp as LeaveIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useGroupDetail } from '../../hooks/useGroups';
import { usePendingJoinRequests } from '../../hooks/useJoinRequests';
import { softDeleteGroup } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GroupRole } from '../../types/group';
import { PlayerAvatar, ShimmerLoading } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { pluralizeCount } from '../../utils/pluralize';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';

const logger = createLogger('GroupSettingsScreen');

// Fix #414: ROLE_CONFIG extraído para constants/group.ts (single source of truth)
import { ROLE_CONFIG, getRoleColor } from '../../constants/group';
import { useTranslation } from 'react-i18next';

export const GroupSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.groupSettings'));
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { firebaseUser, user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const { group, members, loading, error } = useGroupDetail(groupId || null);

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [memberMenuAnchor, setMemberMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedMember, setSelectedMember] = useState<(typeof members)[0] | null>(null);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [kickLoading, setKickLoading] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);

  const uid = firebaseUser?.uid || user?.id;
  const myMember = members.find((m) => m.userId === uid);
  const isOwner = myMember?.role === 'OWNER';
  const isAdminOrOwner = isOwner || myMember?.role === 'ADMIN';
  // Carregar pending requests so para owner/admin (rules so permitem ler)
  const {
    requests: pendingRequests,
    loading: pendingLoading,
    approve,
    reject,
  } = usePendingJoinRequests(isAdminOrOwner ? groupId : undefined);
  const [pendingActioningId, setPendingActioningId] = useState<string | null>(null);

  // Sair do grupo: marcar membro como INACTIVE e remover subcoleção do usuário
  const handleLeaveGroup = async () => {
    if (!groupId || !uid) return;

    if (isOwner) {
      showError(t('feedback.groups.ownerCannotLeave'));
      return;
    }

    setActionLoading(true);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'groups', groupId, 'members', uid), { status: 'INACTIVE' });
      batch.delete(doc(db, 'users', uid, 'groups', groupId));
      await batch.commit();

      logger.info('Usuário saiu do grupo', { groupId, uid });
      showSuccess(t('feedback.groups.leaveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['groups', uid] });
      setLeaveDialogOpen(false);
      navigate('/?tab=2');
    } catch (err) {
      logger.error('Erro ao sair do grupo:', err);
      showError(t('feedback.groups.leaveError'));
    } finally {
      setActionLoading(false);
    }
  };

  // Excluir grupo via cloud function (soft delete)
  const handleDeleteGroup = async () => {
    if (!groupId) return;
    setActionLoading(true);

    try {
      await softDeleteGroup({ groupId });
      logger.info('Grupo excluído com sucesso', { groupId });
      showSuccess(t('feedback.groups.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['groups', uid] });
      setDeleteDialogOpen(false);
      navigate('/?tab=2');
    } catch (err) {
      logger.error('Erro ao excluir grupo:', err);
      showError((err as Error)?.message || t('group.settings.deleteGroupErrorFallback'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteMember = async (memberId: string) => {
    if (!groupId) return;
    if (!isOwner) {
      showError(t('feedback.groups.onlyOwnerPromote'));
      return;
    }
    setMemberMenuAnchor(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'groups', groupId, 'members', memberId), { role: 'ADMIN' as GroupRole });
      batch.update(doc(db, 'users', memberId, 'groups', groupId), { role: 'ADMIN' });
      await batch.commit();
      showSuccess(t('feedback.groups.promoteSuccess'));
    } catch (err) {
      logger.error('Erro ao promover membro:', err);
      showError(t('feedback.groups.promoteError'));
    }
  };

  const handleDemoteMember = async (memberId: string) => {
    if (!groupId) return;
    if (!isOwner) {
      showError(t('feedback.groups.onlyOwnerDemote'));
      return;
    }
    setMemberMenuAnchor(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'groups', groupId, 'members', memberId), { role: 'MEMBER' as GroupRole });
      batch.update(doc(db, 'users', memberId, 'groups', groupId), { role: 'MEMBER' });
      await batch.commit();
      showSuccess(t('feedback.groups.demoteSuccess'));
    } catch (err) {
      logger.error('Erro ao rebaixar membro:', err);
      showError(t('feedback.groups.demoteError'));
    }
  };

  const handleKickMember = async () => {
    if (!groupId || !selectedMember) return;
    setKickLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'groups', groupId, 'members', selectedMember.userId), { status: 'REMOVED' });
      batch.delete(doc(db, 'users', selectedMember.userId, 'groups', groupId));
      await batch.commit();
      showSuccess(t('group.settings.memberRemoved', { name: selectedMember.userName }));
      setKickDialogOpen(false);
      setSelectedMember(null);
    } catch (err) {
      logger.error('Erro ao remover membro:', err);
      showError(t('feedback.groups.removeMemberError2'));
    } finally {
      setKickLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!groupId || !selectedMember || !uid) return;
    setTransferLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'groups', groupId), {
        owner_id: selectedMember.userId,
        owner_name: selectedMember.userName,
      });
      batch.update(doc(db, 'groups', groupId, 'members', uid), { role: 'ADMIN' as GroupRole });
      batch.update(doc(db, 'users', uid, 'groups', groupId), { role: 'ADMIN' });
      batch.update(doc(db, 'groups', groupId, 'members', selectedMember.userId), { role: 'OWNER' as GroupRole });
      batch.update(doc(db, 'users', selectedMember.userId, 'groups', groupId), { role: 'OWNER', group_name: group!.name });
      await batch.commit();
      showSuccess(t('group.settings.ownershipTransferred', { name: selectedMember.userName }));
      setTransferDialogOpen(false);
      setSelectedMember(null);
    } catch (err) {
      logger.error('Erro ao transferir propriedade:', err);
      showError(t('feedback.groups.transferOwnershipError'));
    } finally {
      setTransferLoading(false);
    }
  };

  // Estado de carregamento
  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ShimmerLoading count={3} type="card" />
      </Container>
    );
  }

  // Estado de erro
  if (error || !group) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Alert severity="error">{error || 'Grupo não encontrado'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(`/group/${groupId}`)} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title="Configurações"
        onBack={() => navigate(`/group/${groupId}`)}
      />

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {/* Informações do grupo (resumo) */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Informações do Grupo
              </Typography>
              {(isOwner || myMember?.role === 'ADMIN') && (
                <IconButton
                  size="small"
                  onClick={() => navigate(`/group/${groupId}/edit`)}
                  aria-label={t('a11y.editGroupInfo')}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={group.photoUrl}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'primary.main',
                  fontSize: '1.5rem',
                }}
              >
                {group.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {group.name}
                </Typography>
                {group.description && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {group.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <GroupIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {pluralizeCount(group.memberCount || members.length, 'membro', 'membros')}
                  </Typography>
                  {group.isPublic ? (
                    <Chip label="Público" size="small" variant="outlined" />
                  ) : (
                    <Chip label="Privado" size="small" color="default" />
                  )}
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Solicitacoes pendentes (issue #517 Phase 2) */}
        {isAdminOrOwner && (
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Solicitações pendentes ({pendingRequests.length})
              </Typography>
              {pendingLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {!pendingLoading && pendingRequests.length === 0 && (
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 1 }}>
                  Nenhuma solicitação pendente
                </Typography>
              )}
              {!pendingLoading && pendingRequests.length > 0 && (
                <List disablePadding>
                  {pendingRequests.map((req, idx) => {
                    const isLast = idx === pendingRequests.length - 1;
                    const acting = pendingActioningId === req.userId;
                    return (
                      <React.Fragment key={req.userId}>
                        <ListItem
                          disableGutters
                          secondaryAction={
                            <Stack direction="row" spacing={1}>
                              <IconButton
                                color="primary"
                                size="small"
                                disabled={acting}
                                onClick={async () => {
                                  setPendingActioningId(req.userId);
                                  await approve(req.userId);
                                  setPendingActioningId(null);
                                }}
                                aria-label={`Aprovar pedido de ${req.userName}`}
                              >
                                {acting ? <CircularProgress size={20} /> : <CheckIcon />}
                              </IconButton>
                              <IconButton
                                color="error"
                                size="small"
                                disabled={acting}
                                onClick={async () => {
                                  setPendingActioningId(req.userId);
                                  await reject(req.userId);
                                  setPendingActioningId(null);
                                }}
                                aria-label={`Recusar pedido de ${req.userName}`}
                              >
                                <CloseIcon />
                              </IconButton>
                            </Stack>
                          }
                        >
                          <ListItemAvatar>
                            <PlayerAvatar name={req.userName} photoUrl={req.userPhoto || undefined} />
                          </ListItemAvatar>
                          <ListItemText
                            primary={req.userName}
                            secondary={req.requestedAt ? `Pediu em ${req.requestedAt.toLocaleDateString('pt-BR')}` : null}
                          />
                        </ListItem>
                        {!isLast && <Divider variant="inset" component="li" />}
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        )}

        {/* Membros */}
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Membros ({members.length})
            </Typography>
          </CardContent>
          {members.length === 0 ? (
            <CardContent>
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center' }}>
                Nenhum membro encontrado
              </Typography>
            </CardContent>
          ) : (
            <List disablePadding aria-label={t('a11y.groupMembersList')}>
              {members.map((member, index) => (
                <React.Fragment key={member.userId}>
                  <ListItem
                    sx={{ py: 1.5 }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label={`Ações para ${member.userName}`}
                        onClick={(e) => {
                          setSelectedMember(member);
                          setMemberMenuAnchor(e.currentTarget);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    }
                  >
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
                          <Typography variant="subtitle2" fontWeight={500}>
                            {member.userName}
                          </Typography>
                          <Chip
                            label={ROLE_CONFIG[member.role]?.label || 'Membro'}
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
                      secondary={pluralizeCount(member.totalGames || 0, 'jogo', 'jogos')}
                    />
                  </ListItem>
                  {index < members.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Card>

        {/* Ações */}
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Ações
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Sair do grupo (não exibir para o dono) */}
              {!isOwner && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<LeaveIcon />}
                  fullWidth
                  onClick={() => setLeaveDialogOpen(true)}
                  aria-label={t('a11y.leaveGroup')}
                >
                  Sair do Grupo
                </Button>
              )}

              {/* Excluir grupo (apenas dono) */}
              {isOwner && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  fullWidth
                  onClick={() => setDeleteDialogOpen(true)}
                  aria-label={t('a11y.deleteGroup')}
                >
                  Excluir Grupo
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Container>

      {/* Dialog de confirmação: Sair do grupo */}
      <Dialog
        open={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="leave-group-dialog-title"
      >
        <DialogTitle id="leave-group-dialog-title">Sair do Grupo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja sair do grupo &quot;{group.name}&quot;?
            Você precisará de um novo convite para voltar.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveDialogOpen(false)} disabled={actionLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleLeaveGroup}
            color="warning"
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
          >
            {actionLoading ? 'Saindo...' : 'Sair'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmação: Excluir grupo */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="delete-group-dialog-title"
      >
        <DialogTitle id="delete-group-dialog-title">Excluir Grupo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja excluir o grupo &quot;{group.name}&quot;?
            Esta ação pode ser revertida por um administrador.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteGroup}
            color="error"
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
          >
            {actionLoading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={memberMenuAnchor}
        open={Boolean(memberMenuAnchor)}
        onClose={() => setMemberMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {selectedMember && isOwner && selectedMember.role === 'MEMBER' && (
          <MenuItem onClick={() => handlePromoteMember(selectedMember.userId)}>
            Promover a Admin
          </MenuItem>
        )}
        {selectedMember && isOwner && selectedMember.role === 'ADMIN' && (
          <MenuItem onClick={() => handleDemoteMember(selectedMember.userId)}>
            Rebaixar a Membro
          </MenuItem>
        )}
        {selectedMember && selectedMember.userId !== uid && (isOwner || myMember?.role === 'ADMIN') && (
          <MenuItem
            onClick={() => {
              setMemberMenuAnchor(null);
              setKickDialogOpen(true);
            }}
            sx={{ color: 'error.main' }}
          >
            Remover do Grupo
          </MenuItem>
        )}
        {selectedMember && isOwner && selectedMember.userId !== uid && (
          <MenuItem
            onClick={() => {
              setMemberMenuAnchor(null);
              setTransferDialogOpen(true);
            }}
          >
            Transferir Propriedade
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={kickDialogOpen}
        onClose={() => setKickDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="kick-member-dialog-title"
      >
        <DialogTitle id="kick-member-dialog-title">Remover Membro</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja remover {selectedMember?.userName} do grupo &quot;{group.name}&quot;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKickDialogOpen(false)} disabled={kickLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleKickMember}
            color="error"
            variant="contained"
            disabled={kickLoading}
            startIcon={kickLoading ? <CircularProgress size={16} /> : undefined}
          >
            {kickLoading ? 'Removendo...' : 'Remover'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="transfer-ownership-dialog-title"
      >
        <DialogTitle id="transfer-ownership-dialog-title">Transferir Propriedade</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja transferir a propriedade do grupo &quot;{group.name}&quot; para {selectedMember?.userName}?
            Você se tornará Admin do grupo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)} disabled={transferLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransferOwnership}
            color="warning"
            variant="contained"
            disabled={transferLoading}
            startIcon={transferLoading ? <CircularProgress size={16} /> : undefined}
          >
            {transferLoading ? 'Transferindo...' : 'Transferir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
