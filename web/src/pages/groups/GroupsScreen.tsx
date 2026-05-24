import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CardContent,
  IconButton,
  Avatar,
  List,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  Chip,
  Alert,
  Button,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Groups as GroupsIcon,
  Person as PersonIcon,
  ExitToApp as ExitIcon,
  PersonAdd as InviteIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useGroups } from '../../hooks/useGroups';
import { LoadingState } from '../../components/common/GameCard';
import { InteractiveCard } from '../../components/common/InteractiveCard';
import { useContextMenu, ContextMenuItem } from '../../hooks/useContextMenu';
import { Group } from '../../types/group';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';

export const GroupsScreen: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'GroupsScreen' });

  const { groups, loading, error, refetch } = useGroups();

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
          <IconButton onClick={() => navigate('/?tab=2')} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('groups.title')}
          </Typography>
          <Button
            size="small"
            onClick={() => navigate('/groups/discover')}
            aria-label="Descobrir grupos publicos"
          >
            Descobrir
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/group/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' }, ml: 1 }}
          >
            {t('groups.createGroup')}
          </Button>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            }
          >
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
                onSettings={() => navigate(`/group/${group.id}/settings`)}
                onInvite={() => navigate(`/group/${group.id}/invite`)}
              />
            ))}
          </List>
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="Criar novo grupo"
        sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', bottom: 16, right: { xs: 16, sm: 'calc(50% - 240px + 16px)' } }}
        onClick={() => navigate('/group/create')}
      >
        <AddIcon />
      </Fab>

      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
};

const GroupItem = React.memo(function GroupItem({
  group,
  onClick,
  onSettings,
  onInvite,
  onLeave,
}: {
  group: Group;
  onClick: () => void;
  onSettings?: () => void;
  onInvite?: () => void;
  onLeave?: () => void;
}) {
  const { currentUser } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const isOwner = group.ownerId === currentUser?.uid;

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: 'settings',
      label: 'Configuracoes',
      icon: <SettingsIcon fontSize="small" />,
      onClick: onSettings ?? (() => {}),
      hidden: !isOwner || !onSettings,
    },
    {
      id: 'invite',
      label: t('groups.invitePlayers'),
      icon: <InviteIcon fontSize="small" />,
      onClick: onInvite ?? (() => {}),
      hidden: !onInvite,
    },
    {
      id: 'leave',
      label: t('groups.leaveGroup'),
      icon: <ExitIcon fontSize="small" color="error" />,
      onClick: onLeave ?? (() => {}),
      hidden: isOwner || !onLeave,
      color: 'error',
    },
  ];

  const menu = useContextMenu(contextMenuItems);

  return (
    <>
      <InteractiveCard
        ref={cardRef}
        onClick={onClick}
        actionAreaLabel={`Grupo ${group.name} com ${group.memberCount || 0} membros`}
        onContextMenu={menu.visibleItems.length > 0 ? menu.handleContextMenu : undefined}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          menu.handleKeyboardContextMenu(e, cardRef.current);
        }}
        sx={{ mb: 1 }}
      >
        <CardContent sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={group.photoUrl}
              alt={group.name}
              sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
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
                  {group.memberCount || 0} {t('groups.members').toLowerCase()}
                </Typography>
              </Box>
            </Box>
            {group.isPrivate && (
              <Chip label="Privado" size="small" color="default" />
            )}
          </Box>
        </CardContent>
      </InteractiveCard>

      {menu.visibleItems.length > 0 && (
        <Menu
          open={Boolean(menu.anchorPosition)}
          onClose={menu.handleClose}
          anchorReference="anchorPosition"
          anchorPosition={menu.anchorPosition ?? undefined}
          aria-label="Menu de acoes do grupo"
        >
          {menu.visibleItems.map((item: ContextMenuItem) => (
            <MenuItem
              key={item.id}
              onClick={() => menu.handleItemClick(item)}
              disabled={item.disabled}
              sx={item.color === 'error' ? { color: 'error.main' } : undefined}
            >
              {item.icon && (
                <ListItemIcon sx={item.color === 'error' ? { color: 'error.main' } : undefined}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
});
