import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
  alpha,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { doc, getDoc, getDocs, query, collection, where, documentId, writeBatch, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { PlayerCard } from '../../components/player/PlayerCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('PlayersScreen');

interface GroupMember {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  favoriteTeam?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt?: Date;
}

export const PlayersScreen: React.FC = () => {
  useDocumentTitle('Jogadores');
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { showError } = useToast();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !user) return;

    let cancelled = false;

    const fetchMembers = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (cancelled) return;
        if (groupDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const groupData = snakeToCamel(groupDoc.data()) as Record<string, any>;
          const memberIds = groupData.members || [];
          const ownerId = groupData.ownerId;
          const admins = groupData.admins || [];

          if (ownerId === user.id) {
            setCurrentUserRole('OWNER');
          } else if (admins.includes(user.id)) {
            setCurrentUserRole('ADMIN');
          } else {
            setCurrentUserRole('MEMBER');
          }

          // Batch fetch de usuários em chunks de 10 (whereIn limit) — evita N+1 getDoc
          const userDataMap = new Map<string, { raw: Record<string, unknown>; camel: Record<string, unknown> }>();
          const memberChunks: string[][] = [];
          for (let i = 0; i < memberIds.length; i += 10) {
            memberChunks.push(memberIds.slice(i, i + 10));
          }
          const chunkResults = await Promise.allSettled(
            memberChunks.map((chunk: string[]) =>
              getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
            )
          );
          if (cancelled) return;
          for (const result of chunkResults) {
            if (result.status === 'rejected') continue;
            for (const userDoc of result.value.docs) {
              const raw = userDoc.data();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              userDataMap.set(userDoc.id, { raw, camel: snakeToCamel(raw) as Record<string, any> });
            }
          }

          const membersData: (GroupMember | null)[] = memberIds.map((uid: string) => {
            const entry = userDataMap.get(uid);
            if (!entry) return null;
            const { raw, camel: d } = entry;
            let role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER';
            if (uid === ownerId) role = 'OWNER';
            else if (admins.includes(uid)) role = 'ADMIN';

            return {
              id: uid,
              name: (d.name as string) || 'Jogador',
              email: (d.email as string) || '',
              photoUrl: d.photoUrl as string | undefined,
              favoriteTeam: ((d.favorite_team || d.favoriteTeam) as string | undefined),
              role,
              joinedAt: ((raw.joined_at || raw.joinedAt) as { toDate?: () => Date } | undefined)?.toDate?.(),
            };
          });

          if (!cancelled) setMembers(membersData.filter(Boolean) as GroupMember[]);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Error fetching members:', error);
          showError('Erro ao carregar membros.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMembers();

    return () => { cancelled = true; };
  }, [groupId, user]);

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId || !user || currentUserRole !== 'OWNER') return;

    setActionLoading(memberId);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'groups', groupId), {
        members: arrayRemove(memberId),
      });

      const memberRef = doc(db, 'groups', groupId, 'members', memberId);
      batch.delete(memberRef);

      const userGroupRef = doc(db, 'users', memberId, 'groups', groupId);
      batch.delete(userGroupRef);

      await batch.commit();
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setConfirmRemoveId(null);
    } catch (error) {
      logger.error('Error removing member:', error);
      showError('Erro ao remover membro.');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return theme.palette.error.main;
      case 'ADMIN':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Dono';
      case 'ADMIN':
        return 'Admin';
      default:
        return 'Membro';
    }
  };

  if (loading) {
    return <LoadingState shimmerCount={6} itemType="LIST" />;
  }

  return (
    <Box sx={{ pb: 4 }}>
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
          <IconButton onClick={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Jogadores ({members.length})
          </Typography>
          {currentUserRole !== 'MEMBER' && (
            <IconButton onClick={() => navigate(`/group/${groupId}/invite`)} aria-label="Convidar jogadores">
              <PersonAddIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {members.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum membro
            </Typography>
          </Box>
        ) : (
          <Card>
            <List disablePadding aria-label="Lista de jogadores do grupo">
              {members.map((member, index) => (
                <PlayerMemberItem
                  key={member.id}
                  member={member}
                  showDivider={index > 0}
                  isOwner={currentUserRole === 'OWNER'}
                  isActionLoading={actionLoading === member.id}
                  onRemove={setConfirmRemoveId}
                  onAvatarClick={setSelectedPlayerId}
                  getRoleColor={getRoleColor}
                  getRoleLabel={getRoleLabel}
                />
              ))}
            </List>
          </Card>
        )}
      </Container>

      {/* Card de jogador estilo figurinha */}
      <PlayerCard
        userId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />

      <Dialog open={!!confirmRemoveId} onClose={() => setConfirmRemoveId(null)} fullScreen={isMobile} fullWidth maxWidth="sm">
        <DialogTitle>Remover membro</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja remover este jogador do grupo? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemoveId(null)}>Cancelar</Button>
          <Button
            onClick={() => confirmRemoveId && handleRemoveMember(confirmRemoveId)}
            color="error"
            variant="contained"
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const PlayerMemberItem = React.memo(function PlayerMemberItem({
  member,
  showDivider,
  isOwner,
  isActionLoading,
  onRemove,
  onAvatarClick,
  getRoleColor,
  getRoleLabel,
}: {
  member: GroupMember;
  showDivider: boolean;
  isOwner: boolean;
  isActionLoading: boolean;
  onRemove: (id: string) => void;
  onAvatarClick: (id: string) => void;
  getRoleColor: (role: string) => string;
  getRoleLabel: (role: string) => string;
}) {
  return (
    <Box>
      {showDivider && <Divider />}
      <ListItem
        sx={{ py: 1.5 }}
        secondaryAction={
          isOwner && member.role !== 'OWNER' ? (
            isActionLoading ? (
              <CircularProgress size={24} />
            ) : (
              <IconButton
                edge="end"
                onClick={() => onRemove(member.id)}
                aria-label={`Remover ${member.name} - confirmação necessária`}
              >
                <PersonRemoveIcon color="error" />
              </IconButton>
            )
          ) : null
        }
      >
        <ListItemAvatar>
          {/* Clique no avatar abre a figurinha do jogador */}
          <Box
            onClick={() => onAvatarClick(member.id)}
            sx={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Ver figurinha de ${member.name}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAvatarClick(member.id)}
          >
            <PlayerAvatar name={member.name} photoUrl={member.photoUrl} size={48} />
          </Box>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {member.name}
              <TeamBadge teamId={member.favoriteTeam} size={18} />
              {member.role !== 'MEMBER' && (
                <Chip
                  icon={member.role === 'OWNER' ? <AdminIcon /> : undefined}
                  label={getRoleLabel(member.role)}
                  size="small"
                  sx={{
                    bgcolor: alpha(getRoleColor(member.role), 0.1),
                    color: getRoleColor(member.role),
                  }}
                />
              )}
            </Box>
          }
          secondary={member.email}
        />
      </ListItem>
    </Box>
  );
});
