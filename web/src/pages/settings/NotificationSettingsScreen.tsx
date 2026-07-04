import { PageContainer } from '../../components/common/PageContainer';
import React, { useCallback } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
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
import { useTranslation } from 'react-i18next';
import { ErrorState } from '../../components/common/ErrorState';
import { ScreenHeader } from '../../components/common/ScreenHeader';

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

const SectionHeader = React.memo(function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={600} color="text.primary">
        {title}
      </Typography>
    </Box>
  );
});

export const NotificationSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.notifications'));
  const goBack = useNavigateBack();
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

  const handlePushEnabled = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('pushEnabled', e.target.checked);
  }, [setPreference]);

  const handleGameInvites = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('gameInvites', e.target.checked);
  }, [setPreference]);

  const handleGameReminders = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('gameReminders', e.target.checked);
  }, [setPreference]);

  const handleGroupInvites = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('groupInvites', e.target.checked);
  }, [setPreference]);

  const handleAchievements = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('achievements', e.target.checked);
  }, [setPreference]);

  const handleMvpVotes = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('mvpVotes', e.target.checked);
  }, [setPreference]);

  const handleGameChat = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('gameChat', e.target.checked);
  }, [setPreference]);

  const handleLevelUp = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('levelUp', e.target.checked);
  }, [setPreference]);

  const handleSystemAnnouncements = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('systemAnnouncements', e.target.checked);
  }, [setPreference]);

  const handleReminderTime = useCallback((e: { target: { value: unknown } }) => {
    setPreference('reminderTime', Number(e.target.value));
  }, [setPreference]);

  const handleMuteForHours = useCallback((hours: number) => () => {
    setMuteUntil(hours);
  }, [setMuteUntil]);

  const muted = settings.muteUntil && new Date(settings.muteUntil) > new Date();
  const muteRemaining = muted && settings.muteUntil
    ? Math.ceil((new Date(settings.muteUntil!).getTime() - Date.now()) / (60 * 60 * 1000))
    : 0;

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader title="Notificações" onBack={goBack} />

      <PageContainer maxWidth="form">
        {error ? (
          <ErrorState
            message={error || t('settings.loadError')}
            error={error}
            onRetry={() => queryClient.invalidateQueries()}
            retryLabel={t('common.retry')}
          />
        ) : loading ? (
          <>
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
          </>
        ) : (
          <>
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
                        {t('settings.notifications.muteActive')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('settings.notifications.muteRemaining', { hours: muteRemaining })}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" color="warning" onClick={clearMute} sx={{ minHeight: 44 }}>
                      {t('settings.notifications.muteReactivate')}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SectionHeader icon={<NotificationsIcon />} title={t('settings.notifications.pushTitle')} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.pushDescription')}
                  </Typography>
                  <Switch
                    checked={settings.pushEnabled}
                    onChange={handlePushEnabled}
                    aria-label={t('settings.notifications.pushToggle')}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SectionHeader icon={<GameIcon />} title={t('settings.notifications.gamesTitle')} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.gameInvitesDescription')}
                  </Typography>
                  <Switch
                    checked={settings.gameInvites}
                    onChange={handleGameInvites}
                    aria-label={t('settings.notifications.gameInvites')}
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.gameRemindersDescription')}
                  </Typography>
                  <Switch
                    checked={settings.gameReminders}
                    onChange={handleGameReminders}
                    aria-label={t('settings.notifications.gameReminders')}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SectionHeader icon={<GroupsIcon />} title={t('settings.notifications.groupsTitle')} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.groupInvitesDescription')}
                  </Typography>
                  <Switch
                    checked={settings.groupInvites}
                    onChange={handleGroupInvites}
                    aria-label={t('settings.notifications.groupInvites')}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SectionHeader icon={<AchievementIcon />} title={t('settings.notifications.achievementsTitle')} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.achievementsDescription')}
                  </Typography>
                  <Switch
                    checked={settings.achievements}
                    onChange={handleAchievements}
                    aria-label={t('settings.notifications.achievements')}
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.mvpVotesDescription')}
                  </Typography>
                  <Switch
                    checked={settings.mvpVotes}
                    onChange={handleMvpVotes}
                    aria-label={t('settings.notifications.mvpVotes')}
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.gameChatDescription')}
                  </Typography>
                  <Switch
                    checked={settings.gameChat}
                    onChange={handleGameChat}
                    aria-label={t('settings.notifications.gameChat')}
                  />
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.levelUpDescription')}
                  </Typography>
                  <Switch
                    checked={settings.levelUp}
                    onChange={handleLevelUp}
                    aria-label={t('settings.notifications.levelUp')}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SectionHeader icon={<AnnouncementIcon />} title={t('settings.notifications.systemTitle')} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.notifications.systemAnnouncementsDescription')}
                  </Typography>
                  <Switch
                    checked={settings.systemAnnouncements}
                    onChange={handleSystemAnnouncements}
                    aria-label={t('settings.notifications.systemAnnouncements')}
                  />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <SectionHeader icon={<TimerIcon />} title={t('settings.notifications.reminderTitle')} />
                <FormControl fullWidth size="small">
                  <InputLabel id="reminder-time-label">{t('settings.notifications.reminderLabel')}</InputLabel>
                  <Select
                    labelId="reminder-time-label"
                    value={settings.reminderTime}
                    label={t('settings.notifications.reminderLabel')}
                    onChange={handleReminderTime}
                    aria-label={t('settings.notifications.reminderTime')}
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
                <SectionHeader icon={<MuteIcon />} title={t('settings.notifications.muteTitle')} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('settings.notifications.muteDescription')}
                </Typography>
                <ButtonGroup variant="outlined" fullWidth aria-label={t('settings.notifications.muteOptions')}>
                  {MUTE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.hours}
                      onClick={handleMuteForHours(opt.hours)}
                      aria-label={t('settings.notifications.muteFor', { period: opt.label })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </ButtonGroup>
              </CardContent>
            </Card>
          </>
        )}
      </PageContainer>
    </Box>
  );
};
