import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  AvatarGroup,
  Fab,
  TextField,
  InputAdornment,
  Skeleton,
} from '@mui/material';
import {
  Add,
  Search,
  People,
  Lock,
  Public,
  Star,
  Shield,
  Event,
} from '@mui/icons-material';
import { Group } from '../../../types';

// Mock groups data
const mockGroups: (Group & { nextGame?: string })[] = [
  {
    id: '1',
    name: 'Pelada dos Parças',
    description: 'A pelada mais tradicional do bairro!',
    type: 'PRIVATE',
    isPublic: false,
    ownerId: '1',
    ownerName: 'João Silva',
    members: [
      { userId: '1', userName: 'João Silva', role: 'OWNER', joinedAt: new Date(), totalGames: 45, level: 25 },
      { userId: '2', userName: 'Pedro Santos', role: 'ADMIN', joinedAt: new Date(), totalGames: 38, level: 22 },
      { userId: '3', userName: 'Lucas Oliveira', role: 'MEMBER', joinedAt: new Date(), totalGames: 32, level: 19 },
    ],
    memberCount: 15,
    totalGamesPlayed: 120,
    nextGameDate: new Date('2026-02-28'),
    nextGameTitle: 'Pelada do Sábado',
    inviteCode: 'ABC123',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'Racha da Firma',
    description: 'Funcionários da empresa',
    type: 'PUBLIC',
    isPublic: true,
    ownerId: '2',
    ownerName: 'Carlos Ferreira',
    members: [
      { userId: '2', userName: 'Carlos Ferreira', role: 'OWNER', joinedAt: new Date(), totalGames: 30, level: 20 },
      { userId: '4', userName: 'André Souza', role: 'MEMBER', joinedAt: new Date(), totalGames: 25, level: 18 },
    ],
    memberCount: 12,
    totalGamesPlayed: 85,
    nextGameDate: new Date('2026-03-01'),
    nextGameTitle: 'Racha do Domingo',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function GroupsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return mockGroups;
    
    const query = searchQuery.toLowerCase();
    return mockGroups.filter(
      group =>
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Star sx={{ fontSize: 16, color: '#FFD700' }} />;
      case 'ADMIN':
        return <Shield sx={{ fontSize: 16, color: '#2979FF' }} />;
      default:
        return null;
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <Box sx={{ pb: 8 }}>
      {/* Search Bar */}
      <Box sx={{ p: 2, pb: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar grupos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {filteredGroups.length} grupo{filteredGroups.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Groups List */}
      <Box sx={{ px: 2 }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="circular" width={56} height={56} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        ) : filteredGroups.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <People sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum grupo encontrado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Crie um grupo para começar!
            </Typography>
          </Box>
        ) : (
          filteredGroups.map((group) => {
            const userMember = group.members.find(m => m.userId === '1');
            const topMembers = group.members.slice(0, 3);

            return (
              <Card key={group.id} sx={{ mb: 2 }}>
                <CardActionArea>
                  <CardContent>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: 'primary.main',
                          fontSize: '1.5rem',
                        }}
                      >
                        {group.name.charAt(0).toUpperCase()}
                      </Avatar>
                      
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold" noWrap>
                            {group.name}
                          </Typography>
                          {group.isPublic ? (
                            <Public fontSize="small" color="action" />
                          ) : (
                            <Lock fontSize="small" color="action" />
                          )}
                        </Box>
                        
                        {userMember && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            {getRoleIcon(userMember.role)}
                            <Typography variant="caption" color="text.secondary">
                              {userMember.role === 'OWNER' ? 'Dono' : userMember.role === 'ADMIN' ? 'Admin' : 'Membro'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Description */}
                    {group.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {group.description}
                      </Typography>
                    )}

                    {/* Stats */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <People fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {group.memberCount} membros
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {group.totalGamesPlayed} jogos
                      </Typography>
                    </Box>

                    {/* Next Game */}
                    {group.nextGameDate && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 1.5,
                          p: 1,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        <Event fontSize="small" color="primary" />
                        <Typography variant="body2" color="primary.main" fontWeight="medium">
                          Próximo: {group.nextGameTitle} • {formatDate(group.nextGameDate)}
                        </Typography>
                      </Box>
                    )}

                    {/* Members Preview */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                      <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
                        {topMembers.map((member) => (
                          <Avatar key={member.userId} sx={{ bgcolor: 'secondary.main' }}>
                            {member.userName.charAt(0).toUpperCase()}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                      {group.memberCount > 3 && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          +{group.memberCount - 3}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })
        )}
      </Box>

      {/* FAB */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}
