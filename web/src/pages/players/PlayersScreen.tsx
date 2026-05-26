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
  alpha,
  Chip,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { doc, getDoc, getDocs, query, collection, where, documentId, writeBatch, arrayRemove } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ErrorState } from '../../components/common/ErrorState';
import { PlayerCard } from '../../components/player/PlayerCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';

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
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { showError } = useToast();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  const handleRefresh = async () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!groupId || !user) return;

    let cancelled = false;

    const fetchMembers = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (cancelled) return;
        if (groupDoc.exists()) {
          const groupData = snakeToCamel(groupDoc.data()) as Record<string, unknown>;
          const memberIds = (groupData.members as string[]) || [];
          const ownerId = groupData.ownerId as string;
          const admins = (groupData.admins as string[]) || [];

          // Privacidade: apenas membros do grupo podem ver a lista de jogadores (#1028)
          const isGroupMember =
            ownerId === user.id || admins.includes(user.id) || memberIds.includes(user.id);
          if (!isGroupMember) {
            if (!cancelled) {
              setIsMember(false);
              setLoading(false);
            }
            return;
          }

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
              userDataMap.set(userDoc.id, { raw, camel: snakeToCamel(raw) as Record<string, unknown> });
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
          setError('Erro ao carregar membros.');
          showError('Erro ao carregar membros.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMembers();

    return () => { cancelled = true; };
  }, [groupId, user, showError, retryCount]);

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId || !user || currentUserRole !== 'OWNER') return;

    setActionLoading(memberId);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'groups', groupId), {
        members: arrayRemove(memberId),
      });

      const memberRef = doc(db, 'groups', groupId, 'members', memberId);
      batch.update(memberRef, { status: 'REMOVED' });

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

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title={!loading && !error && isMember ? `Jogadores (${members.length})` : 'Jogadores'}
        onBack={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}
        actions={
          !loading && !error && isMember && currentUserRole !== 'MEMBER' ? (
            <IconButton onClick={() => navigate(`/group/${groupId}/invite`)} aria-label="Convidar jogadores">
              <PersonAddIcon />
            </IconButton>
          ) : undefined
        }
      />
      {loading ? (
        <LoadingState shimmerCount={6} itemType="LIST" />
      ) : error ? (
        <PullToRefresh onRefresh={handleRefresh}>
        <Container maxWidth="sm" sx={{ py: 2 }}>
          <ErrorState
            message={error}
            onRetry={handleRetry}
          />
        </Container>
        </PullToRefresh>
      ) : !isMember ? (
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Acesso restrito
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Você precisa ser membro deste grupo para ver os jogadores.
          </Typography>
          <Button variant="outlined" onClick={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}>
            Voltar
          </Button>
        </Container>
      ) : (
        <>
          <PullToRefresh onRefresh={handleRefresh}>
          <Container maxWidth="sm" sx={{ py: 2 }}>
            {members.length === 0 ? (
              <EmptyState
                icon={<PersonIcon sx={{ fontSize: 64 }} />}
                title="Nenhum membro"
                description="O grupo ainda não tem membros."
              />
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
                      currentUserRole={currentUserRole}
                    />
                  ))}
                </List>
              </Card>
            )}
          </Container>
          </PullToRefresh>

          {/* Card de jogador estilo figurinha */}
          <PlayerCard
            userId={selectedPlayerId}
            onClose={() => setSelectedPlayerId(null)}
          />

          <ConfirmDialog
            open={!!confirmRemoveId}
            title="Remover membro"
            message="Tem certeza que deseja remover este jogador do grupo? Esta ação não pode ser desfeita."
            confirmLabel="Remover"
            loading={actionLoading === confirmRemoveId}
            onConfirm={() => confirmRemoveId && handleRemoveMember(confirmRemoveId)}
            onCancel={() => setConfirmRemoveId(null)}
          />
        </>
      )}
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
  currentUserRole,
}: {
  member: GroupMember;
  showDivider: boolean;
  isOwner: boolean;
  isActionLoading: boolean;
  onRemove: (id: string) => void;
  onAvatarClick: (id: string) => void;
  getRoleColor: (role: string) => string;
  getRoleLabel: (role: string) => string;
  currentUserRole: string | null;
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
          secondary={['OWNER', 'ADMIN'].includes(currentUserRole ?? '') ? member.email : ''}
        />
      </ListItem>
    </Box>
  );
});
