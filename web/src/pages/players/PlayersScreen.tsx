import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
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
import { doc, getDoc, getDocs, collection, writeBatch, arrayRemove } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ErrorState } from '../../components/common/ErrorState';
import { PlayerCard } from '../../components/player/PlayerCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTranslation } from 'react-i18next';

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

function isActiveMemberStatus(status?: unknown) {
  return status === undefined || status === 'ACTIVE';
}

export const PlayersScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.players'));
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
          const rawGroupData = groupDoc.data();
          const groupData = snakeToCamel(rawGroupData) as Record<string, unknown>;
          const ownerId = groupData.ownerId as string;
          const adminIds = ((rawGroupData.admin_ids as string[] | undefined) ||
            (groupData.adminIds as string[] | undefined) ||
            []) as string[];
          const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
          if (cancelled) return;

          const activeMemberDocs = membersSnap.docs.filter((memberDoc) => isActiveMemberStatus(memberDoc.data().status));
          const memberIds = Array.from(new Set([ownerId, ...activeMemberDocs.map((memberDoc) => memberDoc.id)]));
          const memberRoleById = new Map<string, string>();
          const memberJoinedAtById = new Map<string, Date | undefined>();
          const memberPublicById = new Map<string, Record<string, unknown>>();
          activeMemberDocs.forEach((memberDoc) => {
            const memberData = memberDoc.data();
            memberRoleById.set(memberDoc.id, String(memberData.role || 'MEMBER'));
            memberJoinedAtById.set(memberDoc.id, memberData.joined_at?.toDate?.() || memberData.joinedAt?.toDate?.());
            memberPublicById.set(
              memberDoc.id,
              snakeToCamel(memberData) as Record<string, unknown>,
            );
          });

          // Privacidade: apenas membros do grupo podem ver a lista de jogadores (#1028)
          const isGroupMember =
            ownerId === user.id || adminIds.includes(user.id) || memberIds.includes(user.id);
          if (!isGroupMember) {
            if (!cancelled) {
              setIsMember(false);
              setLoading(false);
            }
            return;
          }

          if (ownerId === user.id) {
            setCurrentUserRole('OWNER');
          } else if (adminIds.includes(user.id) || memberRoleById.get(user.id) === 'ADMIN') {
            setCurrentUserRole('ADMIN');
          } else {
            setCurrentUserRole('MEMBER');
          }

          const membersData: (GroupMember | null)[] = memberIds.map((uid: string) => {
            const d = memberPublicById.get(uid) || (uid === ownerId ? {
              userName: groupData.ownerName,
            } : undefined);
            if (!d) return null;
            let role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER';
            if (uid === ownerId) role = 'OWNER';
            else if (memberRoleById.get(uid) === 'ADMIN' || adminIds.includes(uid)) role = 'ADMIN';

            return {
              id: uid,
              name: (d.userName as string) || t('players.defaultName'),
              email: '',
              photoUrl: ((d.userPhoto || d.userPhotoUrl) as string | undefined),
              favoriteTeam: d.favoriteTeam as string | undefined,
              role,
              joinedAt: memberJoinedAtById.get(uid),
            };
          });

          if (!cancelled) setMembers(membersData.filter(Boolean) as GroupMember[]);
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Error fetching members:', error);
          setError(t('feedback.groups.loadMembersError'));
          showError(t('feedback.groups.loadMembersError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMembers();

    return () => { cancelled = true; };
  }, [groupId, user, showError, retryCount, t]);

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId || !user || currentUserRole !== 'OWNER') return;

    setActionLoading(memberId);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'groups', groupId), {
        members: arrayRemove(memberId),
        admin_ids: arrayRemove(memberId),
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
      showError(t('feedback.groups.removeMemberError'));
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
    <Box>
      <ScreenHeader
        title={!loading && !error && isMember ? t('players.titleWithCount', { count: members.length }) : t('players.title')}
        onBack={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}
        actions={
          !loading && !error && isMember && currentUserRole !== 'MEMBER' ? (
            <IconButton onClick={() => navigate(`/group/${groupId}/invite`)} aria-label={t('a11y.invitePlayers')}>
              <PersonAddIcon />
            </IconButton>
          ) : undefined
        }
      />
      {loading ? (
        <LoadingState shimmerCount={6} itemType="LIST" />
      ) : error ? (
        <PullToRefresh onRefresh={handleRefresh}>
        <PageContainer maxWidth="list">
          <ErrorState
            message={error}
            onRetry={handleRetry}
          />
        </PageContainer>
        </PullToRefresh>
      ) : !isMember ? (
        <PageContainer maxWidth="list" sx={{ textAlign: 'center' }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('players.restrictedAccess')}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            {t('players.restrictedAccessDesc')}
          </Typography>
          <Button variant="outlined" onClick={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}>
            {t('common.back')}
          </Button>
        </PageContainer>
      ) : (
        <>
          <PullToRefresh onRefresh={handleRefresh}>
          <PageContainer maxWidth="list">
            {members.length === 0 ? (
              <EmptyState
                icon={<PersonIcon sx={{ fontSize: 64 }} />}
                title={t('empty.noMembers')}
                description={t('empty.noMembersDesc')}
              />
            ) : (
              <Card>
                <List disablePadding aria-label={t('a11y.groupPlayersList')}>
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
                      t={t}
                    />
                  ))}
                </List>
              </Card>
            )}
          </PageContainer>
          </PullToRefresh>

          {/* Card de jogador estilo figurinha */}
          <PlayerCard
            userId={selectedPlayerId}
            onClose={() => setSelectedPlayerId(null)}
          />

          <ConfirmDialog
            open={!!confirmRemoveId}
            title={t('players.removeMemberTitle')}
            message={t('players.removeMemberMessage')}
            confirmLabel={t('players.removeMemberConfirm')}
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
  t,
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
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Box>
      {showDivider && <Divider />}
      <ListItem
        sx={{ py: 1.5, alignItems: 'flex-start' }}
        secondaryAction={
          isOwner && member.role !== 'OWNER' ? (
            isActionLoading ? (
              <CircularProgress size={24} />
            ) : (
              <IconButton
                edge="end"
                onClick={() => onRemove(member.id)}
                aria-label={t('players.removeMemberAria', { name: member.name })}
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
            aria-label={t('players.viewPlayerCardAria', { name: member.name })}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAvatarClick(member.id)}
          >
            <PlayerAvatar name={member.name} photoUrl={member.photoUrl} size={48} />
          </Box>
        </ListItemAvatar>
        <ListItemText
          sx={{ minWidth: 0, pr: isOwner && member.role !== 'OWNER' ? 1 : 0 }}
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
              <Typography
                variant="body1"
                component="span"
                sx={{
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {member.name}
              </Typography>
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
          secondary={['OWNER', 'ADMIN'].includes(currentUserRole ?? '') ? (
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{
                display: 'block',
                mt: 0.25,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              {member.email}
            </Typography>
          ) : null}
        />
      </ListItem>
    </Box>
  );
});
