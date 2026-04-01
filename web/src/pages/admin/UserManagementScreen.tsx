import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ListItemSecondaryAction,
  Divider,
  Button,
  Chip,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AdminPanelSettings as AdminIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('UserManagementScreen');

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
  createdAt?: Date;
  gamesPlayed: number;
  level: number;
}

export const UserManagementScreen: React.FC = () => {
  useDocumentTitle('Gerenciar Usuários');
  const navigate = useNavigate();
  const theme = useTheme();
  useAuth();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('created_at', 'desc'), limit(50));
        const snapshot = await getDocs(q);

        const usersData = snapshot.docs.map((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(d.data()) as Record<string, any>;
          return {
            id: d.id,
            name: data.name || 'Sem nome',
            email: data.email || '',
            photoUrl: data.photoUrl,
            role: data.role || 'PLAYER',
            createdAt: data.createdAt?.toDate?.(),
            gamesPlayed: data.gamesPlayed || 0,
            level: data.level || 1,
          };
        });

        setUsers(usersData);
      } catch (error) {
        logger.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (newRole: string) => {
    if (!selectedUser) return;

    setActionLoading(true);
    setError(null);
    try {
      // Usar Cloud Function para atualizar Custom Claims + documento
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({ uid: selectedUser.id, role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, role: newRole } : u))
      );
      setDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      setError((error as Error)?.message || 'Erro ao atualizar role');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return theme.palette.error.main;
      case 'MODERATOR':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Gerenciar Usuários
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar usuário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar usuário"
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={8} itemType="LIST" />
        ) : (
          <Card>
            <List disablePadding aria-label="Lista de usuários">
              {filteredUsers.map((u, index) => (
                <Box key={u.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    button
                    onClick={() => {
                      setSelectedUser(u);
                      setDialogOpen(true);
                    }}
                  >
                    <ListItemAvatar>
                      <PlayerAvatar name={u.name} photoUrl={u.photoUrl} size={48} level={u.level} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {u.name}
                          <Chip
                            label={u.role}
                            size="small"
                            sx={{
                              bgcolor: alpha(getRoleColor(u.role), 0.1),
                              color: getRoleColor(u.role),
                            }}
                          />
                        </Box>
                      }
                      secondary={`${u.email} • ${u.gamesPlayed} jogos`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" aria-label="Gerenciar permissões">
                        <AdminIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}
      </Container>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} aria-labelledby="manage-user-dialog-title">
        <DialogTitle id="manage-user-dialog-title">Gerenciar Usuário</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                {selectedUser.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedUser.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Role atual: {selectedUser.role}
              </Typography>
            </Box>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => handleRoleChange('PLAYER')}
            disabled={actionLoading}
          >
            Player
          </Button>
          <Button
            onClick={() => handleRoleChange('MODERATOR')}
            disabled={actionLoading}
            color="warning"
          >
            Moderator
          </Button>
          <Button
            onClick={() => handleRoleChange('ADMIN')}
            disabled={actionLoading}
            color="error"
          >
            Admin
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
