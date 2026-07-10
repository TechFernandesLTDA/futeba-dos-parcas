import { PageContainer } from '../../components/common/PageContainer';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  PersonOff as PersonOffIcon,
} from '@mui/icons-material';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState, PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { getUsersByIds } from '../../utils/userBatch';

const logger = createLogger('InvitePlayersScreen');

interface SearchResult {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
}

interface GroupMember {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
}

export const InvitePlayersScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.invitePlayers'));
  const { groupId } = useParams<{ groupId: string }>();
  const { user, firebaseUser } = useAuth();
  const { showError } = useToast();
  const uid = firebaseUser?.uid || user?.id;
  const closeDestination = groupId ? `/group/${groupId}` : '/?tab=2';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('Grupo');
  const [canInviteGroup, setCanInviteGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    const fetchMembers = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (cancelled) return;
        if (groupDoc.exists()) {
          const rawGroupData = groupDoc.data();
          const groupData = snakeToCamel(rawGroupData) as Record<string, unknown>;

          setGroupName((groupData.name as string) || 'Grupo');
          const ownerId = (rawGroupData.owner_id as string | undefined) || (groupData.ownerId as string | undefined);
          const isOwner = Boolean(uid && ownerId === uid);
          setCanInviteGroup(isOwner);

          if (!isOwner) {
            setError(t('feedback.groups.onlyOwnerInvite', {
              defaultValue: 'Apenas o dono do grupo pode convidar jogadores.',
            }));
            return;
          }

          // Query members from subcollection (schema: groups/{id}/members/{uid})
          const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
          if (cancelled) return;

          const memberDocs = membersSnap.docs;
          const usersById = await getUsersByIds(memberDocs.map((memberDoc) => memberDoc.id));
          if (cancelled) return;

          const membersData = memberDocs
            .map((memberDoc) => {
              const uid = memberDoc.id;
              const memberRole = (memberDoc.data().role as string) || 'MEMBER';
              const d = usersById.get(uid);
              if (!d) return null;

              return {
                id: uid,
                name: (d.name as string) || 'Jogador',
                email: (d.email as string) || '',
                photoUrl: d.photoUrl as string | undefined,
                role: memberRole,
              };
            })
            .filter(Boolean) as GroupMember[];

          if (!cancelled) setMembers(membersData);
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
  }, [groupId, showError, retryCount, t, uid]);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    if (!canInviteGroup) {
      showError(t('feedback.groups.onlyOwnerInvite', {
        defaultValue: 'Apenas o dono do grupo pode convidar jogadores.',
      }));
      return;
    }
    // #2216: bloqueia reentrada enquanto uma busca está em andamento
    // (evita chamadas concorrentes ao apertar Enter repetidamente).
    if (searching) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('name', '>=', searchQuery), where('name', '<=', searchQuery + '\uf8ff'));
      const snapshot = await getDocs(q);

      const results = snapshot.docs
        .map((d) => ({ ...snakeToCamel<SearchResult>(d.data()), id: d.id }))
        .filter((u) => !members.some((m) => m.id === u.id));

      setSearchResults(results);
    } catch (error) {
      logger.error('Error searching users:', error);
      showError(t('feedback.search.usersError'));
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (targetUser: SearchResult) => {
    if (!groupId || !uid) return;
    if (!canInviteGroup) {
      showError(t('feedback.groups.onlyOwnerInvite', {
        defaultValue: 'Apenas o dono do grupo pode convidar jogadores.',
      }));
      return;
    }

    setInviting(targetUser.id);
    try {
      // Verificar limite de convites pendentes antes de enviar (#1043)
      // #2351: convites diretos usam a colecao `group_invites` (schema
      // invited_by_id/invited_user_id). A colecao `invites` agora e exclusiva
      // de codigos compartilhaveis (doc-id == code); o write antigo aqui caia
      // no catch-all deny da rule de `invites`.
      const MAX_PENDING_INVITES = 20;
      const memberSnap = await getDoc(doc(db, 'groups', groupId, 'members', targetUser.id));
      if (memberSnap.exists()) {
        const status = memberSnap.data().status;
        if (status !== 'REMOVED' && status !== 'INACTIVE') {
          showError(t('feedback.groups.memberAlreadyLinked', {
            defaultValue: 'Este jogador já possui vínculo ativo ou bloqueado neste grupo.',
          }));
          return;
        }
      }

      const existingQuery = query(
        collection(db, 'group_invites'),
        where('group_id', '==', groupId),
        where('invited_user_id', '==', targetUser.id),
        where('status', '==', 'PENDING')
      );
      const existing = await getDocs(existingQuery);
      if (!existing.empty) {
        showError(t('feedback.groups.inviteAlreadyPending', 'Este jogador já tem um convite pendente para este grupo.'));
        return;
      }

      const senderPendingQuery = query(
        collection(db, 'group_invites'),
        where('invited_by_id', '==', uid),
        where('group_id', '==', groupId),
        where('status', '==', 'PENDING')
      );
      const senderPending = await getDocs(senderPendingQuery);
      if (senderPending.size >= MAX_PENDING_INVITES) {
        showError(`Você já tem ${senderPending.size} convites pendentes neste grupo. Aguarde respostas antes de enviar mais.`);
        return;
      }

      await addDoc(collection(db, 'group_invites'), {
        group_id: groupId,
        group_name: groupName,
        group_photo: null,
        invited_by_id: uid,
        invited_by_name: user?.name || firebaseUser?.displayName || 'Organizador',
        invited_user_id: targetUser.id,
        invited_user_name: targetUser.name,
        invited_user_photo: targetUser.photoUrl || null,
        status: 'PENDING',
        // AUDIT: client-clock drift accepted for 24h invite expiry window
        expires_at: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setSearchResults((prev) => prev.filter((r) => r.id !== targetUser.id));
    } catch (error) {
      logger.error('Error inviting user:', error);
      showError(t('feedback.groups.inviteError'));
    } finally {
      setInviting(null);
    }
  };

  return (
    <AdaptiveFormSheet closeDestination={closeDestination}>
      <FormScaffold
        title="Convidar Jogadores"
        closeDestination={closeDestination}
        closeVariant="back"
      >
        <PageContainer maxWidth="form">
        <TextField
          fullWidth
          placeholder={t('placeholder.searchName')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            // Resetar empty state quando o usuário digitar novamente (#1125)
            if (hasSearched) setHasSearched(false);
          }}
          aria-label={t('a11y.searchPlayerByName')}
          onKeyDown={(e) => {
            // #2216: ignora Enter enquanto a busca está em andamento
            if (e.key === 'Enter' && !searching && searchQuery.trim().length >= 2) {
              handleSearch();
            }
          }}
          inputProps={{ maxLength: 200 }}
          InputProps={{
            endAdornment: (
              <IconButton onClick={handleSearch} disabled={searching || !canInviteGroup} aria-label={t('a11y.search')}>
                {searching ? <CircularProgress size={24} /> : <SearchIcon />}
              </IconButton>
            ),
          }}
          disabled={!canInviteGroup}
          sx={{ mb: 2 }}
        />

        {/* Empty state quando a busca foi executada e não retornou resultados (#1125) */}
        {hasSearched && !searching && searchResults.length === 0 && (
          <Box sx={{ mb: 2 }}>
            <EmptyState
              icon={<PersonOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />}
              title={t('empty.noPlayerFound')}
              description={t('empty.noPlayerFoundDesc', { query: searchQuery })}
            />
          </Box>
        )}

        {searchResults.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <List disablePadding aria-label={t('a11y.searchResultsList')}>
              {searchResults.map((result, index) => (
                <Box key={result.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{ alignItems: 'flex-start' }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() => handleInvite(result)}
                        disabled={inviting === result.id || !canInviteGroup}
                        aria-label={`Convidar ${result.name}`}
                      >
                        {inviting === result.id ? (
                          <CircularProgress size={24} />
                        ) : (
                          <PersonAddIcon color="primary" />
                        )}
                      </IconButton>
                    }
                  >
                    <ListItemAvatar>
                      <PlayerAvatar name={result.name} photoUrl={result.photoUrl} size={40} />
                    </ListItemAvatar>
                    <ListItemText
                      sx={{ minWidth: 0, pr: 1 }}
                      primary={
                        <Typography
                          variant="body1"
                          component="span"
                          sx={{
                            display: 'block',
                            minWidth: 0,
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          {result.name}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          component="span"
                          sx={{
                            display: 'block',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          {result.email}
                        </Typography>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Membros do Grupo ({members.length})
        </Typography>

        {error ? (
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Tentar novamente
            </Button>
          }>
            {error}
          </Alert>
        ) : loading ? (
          <LoadingState shimmerCount={5} itemType="LIST" />
        ) : (
          <Card>
            <List disablePadding aria-label={t('a11y.groupMembers')}>
              {members.map((member, index) => (
                <Box key={member.id}>
                  {index > 0 && <Divider />}
                  <ListItem sx={{ alignItems: 'flex-start' }}>
                    <ListItemAvatar>
                      <PlayerAvatar name={member.name} photoUrl={member.photoUrl} size={40} />
                    </ListItemAvatar>
                    <ListItemText
                      sx={{ minWidth: 0 }}
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
                          {member.role === 'OWNER' && (
                            <Chip label="Dono" size="small" color="primary" />
                          )}
                        </Box>
                      }
                      secondary={
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
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}
      </PageContainer>
      </FormScaffold>
    </AdaptiveFormSheet>
  );
};
