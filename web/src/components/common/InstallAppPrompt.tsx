import { Box, Button, IconButton, Typography, alpha, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Close, Download, IosShare } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePwaInstall } from '../../hooks/usePwaInstall';

interface InstallAppPromptProps {
  sx?: SxProps<Theme>;
}

export function InstallAppPrompt({ sx }: InstallAppPromptProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { canPrompt, dismiss, install, platform, shouldShow } = usePwaInstall();

  if (!shouldShow) return null;

  const usesShareMenu = platform === 'ios' || platform === 'safari-desktop';
  const hint = platform === 'ios'
    ? t('pwa.iosInstallHint')
    : platform === 'safari-desktop'
      ? t('pwa.safariDesktopInstallHint')
      : platform === 'chromium-desktop'
        ? t('pwa.chromiumDesktopInstallHint')
        : platform === 'android'
          ? t('pwa.androidInstallHint')
          : t('pwa.genericInstallHint');

  return (
    <Box
      aria-label={t('pwa.installTitle')}
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: `${!canPrompt ? 'auto ' : ''}1fr auto${canPrompt ? ' auto' : ''}`,
          alignItems: 'center',
          gap: 1.25,
          p: 1.25,
          mb: 2,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.07),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {!canPrompt && (usesShareMenu
        ? <IosShare color="primary" fontSize="small" aria-hidden="true" sx={{ alignSelf: 'start', mt: 0.25 }} />
        : <Download color="primary" fontSize="small" aria-hidden="true" sx={{ alignSelf: 'start', mt: 0.25 }} />)}

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ lineHeight: 1.25 }}>
          {t('pwa.installTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, mt: 0.25 }}>
          {hint}
        </Typography>
      </Box>

      {canPrompt && (
        <Button
          type="button"
          size="small"
          variant="contained"
          startIcon={<Download />}
          onClick={() => { void install(); }}
          sx={{
            minHeight: 40,
            px: 1.5,
            whiteSpace: 'nowrap',
          }}
        >
          {t('pwa.installAction')}
        </Button>
      )}
      <IconButton
        size="small"
        onClick={dismiss}
        aria-label={t('a11y.close')}
        sx={{ alignSelf: 'start', mt: 0.125 }}
      >
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
}
