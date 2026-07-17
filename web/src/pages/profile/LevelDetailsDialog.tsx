import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Stars as StarsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { LevelEntry } from '../../types/gamification';
import { getLevelColor } from '../../types/user';
import {
  getLevelBadgeDescription,
  getLevelBadgeImage,
  handleBadgeImageError,
} from '../../utils/levelBadge';

interface LevelDetailsDialogProps {
  entry: LevelEntry | null;
  currentXp: number;
  isCurrent: boolean;
  isUnlocked: boolean;
  onClose: () => void;
}

export function LevelDetailsDialog({
  entry,
  currentXp,
  isCurrent,
  isUnlocked,
  onClose,
}: LevelDetailsDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  if (!entry) return null;

  const color = getLevelColor(entry.level, theme);
  const xpRemaining = Math.max(entry.xpRequired - currentXp, 0);
  const statusLabel = isCurrent
    ? t('level.statusCurrent')
    : isUnlocked
      ? t('level.statusUnlocked')
      : t('level.statusLocked');
  const statusIcon = isUnlocked
    ? <CheckIcon fontSize="small" />
    : <LockIcon fontSize="small" />;

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xs"
      aria-labelledby="level-details-title"
      aria-describedby="level-details-description"
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 4 },
          overflow: 'hidden',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        id="level-details-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('level.detailEyebrow', { level: entry.level })}
          </Typography>
          <Typography variant="h6" component="div" fontWeight={800}>
            {entry.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={t('level.closeDetailsAria')} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
        <Box
          sx={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            minHeight: { xs: 300, sm: 280 },
            mb: 2.5,
            borderRadius: 4,
            overflow: 'hidden',
            border: `1px solid ${alpha(color, 0.25)}`,
            background: `
              radial-gradient(circle at 50% 42%, ${alpha(color, 0.22)} 0%, transparent 52%),
              linear-gradient(145deg, ${alpha(color, 0.08)}, ${alpha(theme.palette.background.paper, 0.96)})
            `,
          }}
        >
          <Box
            component="img"
            src={getLevelBadgeImage(entry.level)}
            onError={handleBadgeImageError}
            alt={getLevelBadgeDescription(entry.level, entry.name)}
            sx={{
              width: { xs: 250, sm: 230 },
              height: { xs: 250, sm: 230 },
              objectFit: 'contain',
              filter: isUnlocked
                ? `drop-shadow(0 12px 24px ${alpha(color, 0.35)})`
                : `saturate(0.72) drop-shadow(0 10px 20px ${alpha(color, 0.22)})`,
            }}
          />
          <Chip
            icon={statusIcon}
            label={statusLabel}
            color={isCurrent ? 'primary' : isUnlocked ? 'success' : 'default'}
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              fontWeight: 700,
              bgcolor: isUnlocked ? undefined : alpha(theme.palette.background.paper, 0.92),
            }}
          />
        </Box>

        <Typography
          id="level-details-description"
          variant="body1"
          align="center"
          sx={{ fontStyle: 'italic', mb: 2.5, px: 1 }}
        >
          “{entry.phrase}”
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(color, 0.08) }}>
            <Typography variant="caption" color="text.secondary">
              {t('level.requiredXp')}
            </Typography>
            <Typography variant="h6" fontWeight={800} color={color}>
              {entry.xpRequired.toLocaleString('pt-BR')}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              {isUnlocked ? t('level.yourXp') : t('level.xpRemaining')}
            </Typography>
            <Typography variant="h6" fontWeight={800}>
              {(isUnlocked ? currentXp : xpRemaining).toLocaleString('pt-BR')}
            </Typography>
          </Box>
        </Box>

        {!isUnlocked && (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              p: 1.5,
              mb: 2.5,
              borderRadius: 2.5,
              bgcolor: alpha(theme.palette.info.main, 0.08),
            }}
          >
            <StarsIcon color="info" fontSize="small" sx={{ mt: 0.2 }} />
            <Typography variant="body2" color="text.secondary">
              {t('level.lockedExplanation')}
            </Typography>
          </Box>
        )}

        <Button variant="contained" fullWidth onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
