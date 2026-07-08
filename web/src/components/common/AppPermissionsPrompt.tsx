import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  LocationOn,
  NotificationsActive,
  Storage,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppPermissions } from '../../hooks/useAppPermissions';
import type { AppPermissionId, AppPermissionItem } from '../../hooks/useAppPermissions';

const SNOOZE_STORAGE_KEY = 'futeba.permissionPrompt.snoozedUntil';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function readSnoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_STORAGE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function snoozePrompt() {
  try {
    localStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    // Ignore storage errors; the prompt can appear again next session.
  }
}

function getPermissionIcon(id: AppPermissionId) {
  if (id === 'notifications') return <NotificationsActive fontSize="small" color="primary" />;
  if (id === 'location') return <LocationOn fontSize="small" color="primary" />;
  return <Storage fontSize="small" color="primary" />;
}

function isActionable(permission: AppPermissionItem) {
  return permission.supported && permission.state !== 'granted' && permission.state !== 'denied';
}

export function AppPermissionsPrompt() {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    permissions,
    requestNotifications,
    requestLocation,
    requestStorage,
  } = useAppPermissions();
  const [snoozed, setSnoozed] = useState(readSnoozed);

  const visiblePermissions = useMemo(() => (
    (['notifications', 'location', 'storage'] as const)
      .map((id) => permissions[id])
      .filter((permission) => permission.supported && permission.state !== 'granted')
  ), [permissions]);

  if (snoozed || visiblePermissions.length === 0) return null;

  const handleSnooze = () => {
    snoozePrompt();
    setSnoozed(true);
  };

  const requestById: Record<AppPermissionId, () => Promise<unknown>> = {
    notifications: requestNotifications,
    location: requestLocation,
    storage: requestStorage,
  };

  return (
    <Box
      aria-label={t('permissions.title')}
      sx={{
        border: `1px solid ${alpha(theme.palette.info.main, 0.24)}`,
        bgcolor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.14 : 0.07),
        borderRadius: 2,
        p: 1.25,
        mb: { xs: 1, md: 1.25 },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.25 }}>
            {t('permissions.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, mt: 0.25 }}>
            {t('permissions.description')}
          </Typography>
        </Box>
        <Button size="small" color="inherit" onClick={handleSnooze} sx={{ flexShrink: 0, minWidth: 0 }}>
          {t('common.later')}
        </Button>
      </Stack>

      <Stack spacing={0.75} sx={{ mt: 1 }}>
        {visiblePermissions.map((permission) => {
          const actionable = isActionable(permission);
          const denied = permission.state === 'denied';

          return (
            <Box
              key={permission.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 1,
                minHeight: 44,
              }}
            >
              {getPermissionIcon(permission.id)}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.25 }}>
                  {t(`permissions.items.${permission.id}.title`)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                  {denied
                    ? t('permissions.blockedHint')
                    : t(`permissions.items.${permission.id}.description`)}
                </Typography>
              </Box>
              {denied ? (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('permissions.blocked')}
                </Typography>
              ) : (
                <Button
                  type="button"
                  size="small"
                  variant={actionable ? 'contained' : 'outlined'}
                  disabled={!actionable || permission.loading}
                  startIcon={permission.loading ? <CircularProgress color="inherit" size={16} /> : undefined}
                  onClick={() => { void requestById[permission.id](); }}
                  sx={{ minHeight: 36, px: 1.25, whiteSpace: 'nowrap' }}
                >
                  {t('permissions.allowAction')}
                </Button>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
