import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  List,
  Fab,
  useTheme,
  Chip,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Groups as GroupsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useGroups } from '../../hooks/useGroups';
import { LoadingState } from '../../components/common/GameCard';
import { Group } from '../../types/group';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const GroupsScreen: React.FC = () => {
  useDocumentTitle('Grupos');
  const navigate = useNavigate();
  const theme = useTheme();

  // Usa hook que consulta subcoleção users/{uid}/groups (igual ao Android)
  const { groups, loading, error } = useGroups();

  return (
    <Box sx={{ pb: 8 }}>
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
          <Typography component="h1" variant="h6" sx={{ ml: 1 }}>
            Grupos
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <LoadingState shimmerCount={6} itemType="CARD" />
        ) : groups.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <GroupsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum grupo encontrado
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Crie um grupo para jogar com seus amigos!
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Lista de grupos">
            {groups.map((group) => (
              <GroupItem
                key={group.id}
                group={group}
                onClick={() => navigate(`/group/${group.id}`)}
              />
            ))}
          </List>
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="Criar novo grupo"
        sx={{ position: 'fixed', bottom: 16, right: { xs: 16, sm: 'calc(50% - 240px + 16px)' } }}
        onClick={() => navigate('/group/create')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

const GroupItem = React.memo(function GroupItem({
  group,
  onClick,
}: {
  group: Group;
  onClick: () => void;
}) {
  return (
    <Card
      sx={{
        mb: 1,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'scale(1.01)' },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={group.photoUrl}
            alt={group.name}
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
            }}
          >
            {group.name?.charAt(0)?.toUpperCase() || <GroupsIcon />}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {group.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {group.memberCount || 0} membros
              </Typography>
            </Box>
          </Box>
          {group.isPrivate && (
            <Chip label="Privado" size="small" color="default" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
});
