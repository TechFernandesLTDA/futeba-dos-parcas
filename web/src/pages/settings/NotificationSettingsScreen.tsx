import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Switch,
  IconButton,
  Skeleton,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  Divider,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Notifications as NotificationsIcon,
  SportsSoccer as GameIcon,
  Groups as GroupsIcon,
  EmojiEvents as AchievementIcon,
  Campaign as AnnouncementIcon,
  VolumeOff as MuteIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { EmptyState } from '../../components/common/EmptyState';

const MUTE_OPTIONS = [
  { hours: 1, label: '1 hora' },
  { hours: 4, label: '4 horas' },
  { hours: 8, label: '8 horas' },
  { hours: 24, label: '24 horas' },
];

const REMINDER_OPTIONS = [
  { value: 5, label: '5 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 hora antes' },
];

export const NotificationSettingsScreen: React.FC = () => {
  useDocumentTitle('Notificações');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    settings,
    loading,
    error,
    setPreference,
    setMuteUntil,
    clearMute,
  } = useNotificationSettings(user?.id);

  const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={600} color="text.primary">
        {title}
      </Typography>
    </Box>
  );

  if (error) {
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
            <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
              <BackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 1 }}>
              Notificações
            </Typography>
          </Box>
        </Box>
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <EmptyState
            icon={<NotificationsIcon />}
            title="Erro ao carregar"
            description={error}
            actionLabel="Tentar novamente"
            onAction={() => queryClient.invalidateQueries()}
          />
        </Container>
      </Box>
    );
  }

  if (loading) {
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
            <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
              <BackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 1 }}>
              Notificações
            </Typography>
          </Box>
        </Box>
        <Container maxWidth="sm" sx={{ py: 2 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent>
                <Skeleton variant="text" width="40%" height={24} />
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} variant="text" width="80%" height={48} />
                ))}
              </CardContent>
            </Card>
          ))}
        </Container>
      </Box>
    );
  }

  const muted = settings.muteUntil && new Date(settings.muteUntil) > new Date();
  const muteRemaining = muted && settings.muteUntil
    ? Math.ceil((new Date(settings.muteUntil!).getTime() - Date.now()) / (60 * 60 * 1000))
    : 0;

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
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Notificações
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {muted && (
          <Card
            sx={{
              mb: 2,
              bgcolor: alpha(theme.palette.warning.main, 0.08),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MuteIcon color="warning" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    Notificações silenciadas
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Restam {muteRemaining}h de silêncio
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" color="warning" onClick={clearMute}>
                  Reativar
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<NotificationsIcon />} title="Push notifications" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Receber notificações push no navegador
              </Typography>
              <Switch
                checked={settings.pushEnabled}
                onChange={(e) => setPreference('pushEnabled', e.target.checked)}
                aria-label="Ativar notificações push"
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<GameIcon />} title="Jogos" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Convites para jogos
              </Typography>
              <Switch
                checked={settings.gameInvites}
                onChange={(e) => setPreference('gameInvites', e.target.checked)}
                aria-label="Notificações de convites para jogos"
              />
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Lembretes de jogos
              </Typography>
              <Switch
                checked={settings.gameReminders}
                onChange={(e) => setPreference('gameReminders', e.target.checked)}
                aria-label="Lembretes de jogos"
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<GroupsIcon />} title="Grupos" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Convites para grupos
              </Typography>
              <Switch
                checked={settings.groupInvites}
                onChange={(e) => setPreference('groupInvites', e.target.checked)}
                aria-label="Convites para grupos"
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<AchievementIcon />} title="Conquistas" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Conquistas e badges
              </Typography>
              <Switch
                checked={settings.achievements}
                onChange={(e) => setPreference('achievements', e.target.checked)}
                aria-label="Notificações de conquistas"
              />
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Votações MVP
              </Typography>
              <Switch
                checked={settings.mvpVotes}
                onChange={(e) => setPreference('mvpVotes', e.target.checked)}
                aria-label="Votações MVP"
              />
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Subida de nível
              </Typography>
              <Switch
                checked={settings.levelUp}
                onChange={(e) => setPreference('levelUp', e.target.checked)}
                aria-label="Notificações de nível"
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<AnnouncementIcon />} title="Sistema" />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Anúncios do sistema
              </Typography>
              <Switch
                checked={settings.systemAnnouncements}
                onChange={(e) => setPreference('systemAnnouncements', e.target.checked)}
                aria-label="Anúncios do sistema"
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<TimerIcon />} title="Lembrete de jogo" />
            <FormControl fullWidth size="small">
              <InputLabel id="reminder-time-label">Notificar com antecedência</InputLabel>
              <Select
                labelId="reminder-time-label"
                value={settings.reminderTime}
                label="Notificar com antecedência"
                onChange={(e) => setPreference('reminderTime', Number(e.target.value))}
                aria-label="Tempo de antecedência do lembrete"
              >
                {REMINDER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <SectionHeader icon={<MuteIcon />} title="Silenciar notificações" />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Silenciar todas as notificações por um período
            </Typography>
            <ButtonGroup variant="outlined" fullWidth aria-label="Opções de silenciar">
              {MUTE_OPTIONS.map((opt) => (
                <Button
                  key={opt.hours}
                  onClick={() => setMuteUntil(opt.hours)}
                  aria-label={`Silenciar por ${opt.label}`}
                >
                  {opt.label}
                </Button>
              ))}
            </ButtonGroup>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
