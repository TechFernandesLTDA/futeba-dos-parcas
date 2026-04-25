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
  Alert,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  ExitToApp as LeaveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useGroupDetail } from '../../hooks/useGroups';
import { softDeleteGroup } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GroupRole } from '../../types/group';
import { PlayerAvatar, ShimmerLoading } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('GroupSettingsScreen');

// Configuração visual dos papéis
const ROLE_CONFIG: Record<GroupRole, { label: string; color: string }> = {
  OWNER: { label: 'Dono', color: '#F59E0B' },
  ADMIN: { label: 'Admin', color: '#2979FF' },
  MEMBER: { label: 'Membro', color: '#78716C' },
};

export const GroupSettingsScreen: React.FC = () => {
  useDocumentTitle('Configurações do Grupo');
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { firebaseUser, user } = useAuth();
  const { showSuccess, showError } = useToast();

  const { group, members, loading, error } = useGroupDetail(groupId || null);

  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const uid = firebaseUser?.uid || user?.id;
  const myMember = members.find((m) => m.userId === uid);
  const isOwner = myMember?.role === 'OWNER';

  // Sair do grupo: remover membro e subcoleção do usuário
  const handleLeaveGroup = async () => {
    if (!groupId || !uid) return;
    setActionLoading(true);

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'groups', groupId, 'members', uid));
      batch.delete(doc(db, 'users', uid, 'groups', groupId));
      await batch.commit();

      logger.info('Usuário saiu do grupo', { groupId, uid });
      showSuccess('Você saiu do grupo.');
      setLeaveDialogOpen(false);
      navigate('/groups');
    } catch (err) {
      logger.error('Erro ao sair do grupo:', err);
      showError('Erro ao sair do grupo. Tente novamente.');
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
      showSuccess('Grupo excluído com sucesso.');
      setDeleteDialogOpen(false);
      setTimeout(() => navigate('/groups'), 500);
    } catch (err) {
      logger.error('Erro ao excluir grupo:', err);
      showError((err as Error)?.message || 'Erro ao excluir grupo. Tente novamente.');
    } finally {
      setActionLoading(false);
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
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Cabeçalho */}
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
            Configurações
          </Typography>
        </Box>
      </Box>

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
                  aria-label="Editar informações do grupo"
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
                    {group.memberCount || members.length} membros
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
            <List disablePadding aria-label="Lista de membros do grupo">
              {members.map((member, index) => (
                <React.Fragment key={member.userId}>
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
                          <Typography variant="subtitle2" fontWeight={500}>
                            {member.userName}
                          </Typography>
                          <Chip
                            label={ROLE_CONFIG[member.role]?.label || 'Membro'}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: alpha(ROLE_CONFIG[member.role]?.color || '#78716C', 0.1),
                              color: ROLE_CONFIG[member.role]?.color || '#78716C',
                            }}
                          />
                        </Box>
                      }
                      secondary={`${member.totalGames || 0} jogos`}
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
                  aria-label="Sair do grupo"
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
                  aria-label="Excluir grupo"
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
    </Box>
  );
};
