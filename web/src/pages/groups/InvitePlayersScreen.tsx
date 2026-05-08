import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { FormScaffold } from '../../components/layout';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState, PlayerAvatar } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

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
  useDocumentTitle('Convidar Jogadores');
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { showError } = useToast();
  const closeDestination = groupId ? `/group/${groupId}` : '/groups';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('Grupo');

  useEffect(() => {
    if (!groupId) return;

    const fetchMembers = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (groupDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const groupData = snakeToCamel(groupDoc.data()) as Record<string, any>;
          const memberIds = groupData.members || [];

          setGroupName(groupData.name || 'Grupo');

          const membersData = await Promise.all(
            memberIds.map(async (uid: string) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = snakeToCamel(userDoc.data()) as Record<string, any>;
                return {
                  id: uid,
                  name: d.name || 'Jogador',
                  email: d.email || '',
                  photoUrl: d.photoUrl,
                  role: groupData.ownerId === uid ? 'OWNER' : 'MEMBER',
                };
              }
              return null;
            })
          );

          setMembers(membersData.filter(Boolean) as GroupMember[]);
        }
      } catch (error) {
        logger.error('Error fetching members:', error);
        showError('Erro ao carregar membros.');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [groupId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
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
      showError('Erro ao buscar usuários.');
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (targetUser: SearchResult) => {
    if (!groupId || !user) return;

    setInviting(targetUser.id);
    try {
      await addDoc(collection(db, 'invites'), {
        group_id: groupId,
        group_name: groupName,
        from_user_id: user.id,
        to_user_id: targetUser.id,
        status: 'PENDING',
        expires_at: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        created_at: serverTimestamp(),
      });
      setSearchResults((prev) => prev.filter((r) => r.id !== targetUser.id));
    } catch (error) {
      logger.error('Error inviting user:', error);
      showError('Erro ao enviar convite. Tente novamente.');
    } finally {
      setInviting(null);
    }
  };

  const _existingMemberIds = new Set(members.map((m) => m.id));

  return (
    <FormScaffold
      title="Convidar Jogadores"
      closeDestination={closeDestination}
      closeVariant="back"
    >
      <Container maxWidth="sm" disableGutters sx={{ py: 2 }}>
        <TextField
          fullWidth
          placeholder="Buscar por nome..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Buscar jogador por nome"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            endAdornment: (
              <IconButton onClick={handleSearch} disabled={searching} aria-label="Buscar">
                {searching ? <CircularProgress size={24} /> : <SearchIcon />}
              </IconButton>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {searchResults.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <List disablePadding aria-label="Resultados da busca">
              {searchResults.map((result, index) => (
                <Box key={result.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemAvatar>
                      <PlayerAvatar name={result.name} photoUrl={result.photoUrl} size={40} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={result.name}
                      secondary={result.email}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleInvite(result)}
                        disabled={inviting === result.id}
                        aria-label={`Convidar ${result.name}`}
                      >
                        {inviting === result.id ? (
                          <CircularProgress size={24} />
                        ) : (
                          <PersonAddIcon color="primary" />
                        )}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Membros do Grupo ({members.length})
        </Typography>

        {loading ? (
          <LoadingState shimmerCount={5} itemType="LIST" />
        ) : (
          <Card>
            <List disablePadding aria-label="Membros do grupo">
              {members.map((member, index) => (
                <Box key={member.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemAvatar>
                      <PlayerAvatar name={member.name} photoUrl={member.photoUrl} size={40} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {member.name}
                          {member.role === 'OWNER' && (
                            <Chip label="Dono" size="small" color="primary" />
                          )}
                        </Box>
                      }
                      secondary={member.email}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}
      </Container>
    </FormScaffold>
  );
};
