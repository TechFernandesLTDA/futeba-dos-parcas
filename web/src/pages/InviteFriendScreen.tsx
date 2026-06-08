import React, { useCallback, useState } from 'react';
import { useNavigateBack } from '../hooks/useNavigateBack';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  EmojiEvents as TrophyIcon,
  People as PeopleIcon,
  PersonAdd as InviteIcon,
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useGamificationColors } from '../hooks/useGamificationColors';
import { functions } from '../services/firebase';
import { useTranslation } from 'react-i18next';
import PageContainer from '../components/common/PageContainer';

const generateMyInviteCode = httpsCallable<object, { inviteCode: string }>(functions, 'generateMyInviteCode');

export const InviteFriendScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.inviteFriends'));
  const goBack = useNavigateBack('/?tab=4');
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const [generating, setGenerating] = useState(false);

  const inviteCode = user?.inviteCode ?? '';
  const inviteCount = user?.inviteCount ?? 0;
  const inviteLink = inviteCode ? `https://futebadosparcas.web.app/invite/${inviteCode}` : '';

  const getAmbassadorLevel = (count: number): { level: string; icon: string; color: string; next: number } => {
    if (count >= 100) return { level: t('invite.ambassadorLevels.legend'), icon: '👑', color: gColors.gold, next: 0 };
    if (count >= 30) return { level: t('invite.ambassadorLevels.gold'), icon: '🟡', color: gColors.gold, next: 100 };
    if (count >= 10) return { level: t('invite.ambassadorLevels.silver'), icon: '⚪', color: gColors.silver, next: 30 };
    if (count >= 3) return { level: t('invite.ambassadorLevels.bronze'), icon: '🟤', color: gColors.bronze, next: 10 };
    return { level: t('invite.ambassadorLevels.initiate'), icon: '', color: '', next: 3 };
  };

  const ambassador = getAmbassadorLevel(inviteCount);

  const handleCopy = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(
      () => showSuccess(t('feedback.share.linkCopiedFriends')),
      () => showError(t('feedback.share.copyLinkError')),
    );
  }, [inviteLink, showSuccess, showError, t]);

  const handleShare = useCallback(() => {
    if (!inviteLink) return;
    if (navigator.share) {
      navigator.share({
        title: t('app.name'),
        text: t('invite.shareText', { link: inviteLink }),
        url: inviteLink,
      }).catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        showError(t('feedback.share.shareError'));
      });
    } else {
      handleCopy();
    }
  }, [inviteLink, handleCopy, showError, t]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateMyInviteCode();
      showSuccess(t('feedback.groups.inviteCodeGenerated'));
      if (user) {
        user.inviteCode = result.data.inviteCode;
        window.location.reload();
      }
    } catch (err) {
      showError((err as Error).message || t('invite.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageContainer maxWidth="focused">
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label={t('a11y.back')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold" flex={1}>
          {t('invite.title')}
        </Typography>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, textAlign: 'center', bgcolor: (t) => t.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t('invite.ambassadorLevel')}
        </Typography>
        <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
          {ambassador.icon} {ambassador.level}
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" mt={2}>
          <Stack alignItems="center">
            <PeopleIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold">{inviteCount}</Typography>
            <Typography variant="caption" color="text.secondary">{t('invite.invitedCount')}</Typography>
          </Stack>
          {ambassador.next > 0 && (
            <Stack alignItems="center">
              <TrophyIcon sx={{ color: 'warning.main', fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold">{ambassador.next}</Typography>
              <Typography variant="caption" color="text.secondary">{t('invite.nextLevel')}</Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {t('invite.levels')}
        </Typography>
        {[
          { level: t('invite.ambassadorLevels.bronze'), icon: '🥉', count: 3, color: gColors.bronze },
          { level: t('invite.ambassadorLevels.silver'), icon: '🥈', count: 10, color: gColors.silver },
          { level: t('invite.ambassadorLevels.gold'), icon: '🥇', count: 30, color: gColors.gold },
          { level: t('invite.ambassadorLevels.legend'), icon: '👑', count: 100, color: gColors.gold },
        ].map((l) => (
          <Stack
            key={l.level}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              py: 1,
              px: 1,
              borderRadius: 1,
              bgcolor: inviteCount >= l.count ? theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.03) : 'transparent',
              opacity: inviteCount >= l.count ? 1 : 0.5,
            }}
          >
            <Typography variant="h6">{l.icon}</Typography>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={inviteCount >= l.count ? 'bold' : 'normal'}>
                {l.level}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('invite.countInvited', { count: l.count })}
              </Typography>
            </Box>
            {inviteCount >= l.count && <ConqueredChip label={t('invite.conquered')} />}
          </Stack>
        ))}
      </Paper>

      {inviteCode ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {t('invite.yourCode')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('invite.shareDescription')}
          </Typography>
          <TextField
            fullWidth
            value={inviteLink}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopy} aria-label={t('tooltip.copyLink')}>
                    <CopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <Button fullWidth variant="contained" startIcon={<ShareIcon />} onClick={handleShare}>
            {t('invite.share')}
          </Button>
        </Paper>
      ) : (
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <InviteIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {t('invite.noCodeYetTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('invite.noCodeYetDesc')}
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <ShareIcon />}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? t('invite.generating') : t('invite.generateCode')}
          </Button>
        </Paper>
      )}
    </PageContainer>
  );
};

function ConqueredChip({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'inline-flex',
        px: 1,
        py: 0.3,
        borderRadius: 1,
        bgcolor: alpha(theme.palette.success.main, 0.12),
        color: theme.palette.success.main,
        fontSize: '0.75rem',
        fontWeight: 'bold',
      }}
    >
      {label}
    </Box>
  );
}
