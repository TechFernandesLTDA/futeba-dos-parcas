import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import HighlightIcon from '@mui/icons-material/AutoAwesome';
import CopyIcon from '@mui/icons-material/ContentCopy';
import TrophyIcon from '@mui/icons-material/EmojiEvents';
import DuoIcon from '@mui/icons-material/Groups';
import ShareIcon from '@mui/icons-material/Share';
import GoalIcon from '@mui/icons-material/SportsSoccer';
import SaveIcon from '@mui/icons-material/SportsHandball';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot } from 'firebase/firestore';
import { EmptyState } from '../../components/common/EmptyState';
import { ReactionBar } from '../../components/reactions/ReactionBar';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../services/firebase';
import type { Game, GameConfirmation } from '../../types/game';
import type { ReactionsMap } from '../../constants/reactions';
import { createLogger } from '../../utils/logger';
import {
  HighlightMoment,
  HighlightPlayer,
  buildPostGameHighlights,
  formatPostGameHighlightsShareText,
} from '../../utils/postGameHighlights';

const logger = createLogger('PostGameHighlightsPanel');

interface PostGameHighlightsPanelProps {
  game: Game;
  confirmations: GameConfirmation[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const PlayerAvatar: React.FC<{ player?: HighlightPlayer }> = ({ player }) => (
  <Avatar src={player?.userPhoto} alt={player?.userName ?? ''} sx={{ width: 44, height: 44 }}>
    {player?.userName.charAt(0).toUpperCase() ?? '?'}
  </Avatar>
);

const getMomentIcon = (moment?: HighlightMoment) => {
  if (moment?.kind === 'save') return <SaveIcon color="info" />;
  if (moment?.kind === 'assist') return <DuoIcon color="success" />;
  if (moment?.kind === 'mvp') return <TrophyIcon color="warning" />;
  return <GoalIcon color="primary" />;
};

export const PostGameHighlightsPanel: React.FC<PostGameHighlightsPanelProps> = ({
  game,
  confirmations,
  loading = false,
  error = null,
  onRetry,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [highlightReactions, setHighlightReactions] = useState<ReactionsMap>({});

  const highlights = useMemo(
    () => buildPostGameHighlights(game, confirmations),
    [game, confirmations],
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'post_game_highlights', game.id),
      (snapshot) => {
        const data = snapshot.data();
        setHighlightReactions((data?.reactions as ReactionsMap | undefined) ?? {});
      },
      (err) => {
        setHighlightReactions({});
        showError(t('reactions.loadError'));
        logger.error('Error loading post-game highlight reactions:', err);
      },
    );

    return () => unsubscribe();
  }, [game.id, showError, t]);

  const momentLabel = useMemo(() => {
    const moment = highlights.moment;
    if (!moment) return '';

    if (moment.kind === 'presence') {
      return t('postGameHighlights.moments.presence', { count: moment.value ?? 0 });
    }

    return t(`postGameHighlights.moments.${moment.kind}`, {
      name: moment.player?.userName,
      count: moment.value,
    });
  }, [highlights.moment, t]);

  const shareText = useMemo(
    () => formatPostGameHighlightsShareText(game, highlights),
    [game, highlights],
  );
  const reactionCreateData = useMemo(() => ({
    game_id: game.id,
    reactions: {},
  }), [game.id]);
  const canUseNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleShare = async () => {
    try {
      if (canUseNativeShare) {
        await navigator.share({
          title: t('postGameHighlights.shareTitle'),
          text: shareText,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      showSuccess(t('postGameHighlights.copySuccess'));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(shareText);
        showSuccess(t('postGameHighlights.copySuccess'));
      } catch {
        showError(t('postGameHighlights.shareError'));
      }
    }
  };

  return (
    <Card
      sx={{
        mt: 2,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)}, ${alpha(theme.palette.success.main, 0.08)} 52%, ${theme.palette.background.paper})`,
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <HighlightIcon />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={800}>
              {t('postGameHighlights.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('postGameHighlights.description')}
            </Typography>
          </Box>
          <Chip
            size="small"
            icon={<HighlightIcon />}
            label={t('postGameHighlights.confirmedCount', { count: highlights.confirmedCount })}
            variant="outlined"
          />
        </Stack>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>{t('common.retry')}</Button> : undefined}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : !highlights.hasHighlights ? (
          <EmptyState
            icon={<HighlightIcon sx={{ fontSize: 48 }} />}
            title={t('postGameHighlights.emptyTitle')}
            description={t('postGameHighlights.emptyDescription')}
          />
        ) : (
          <Stack spacing={2}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.background.paper, 0.72),
                boxShadow: theme.shadows[1],
              }}
            >
              <Grid container spacing={2}>
                <Grid xs={12} md={4}>
                  <HighlightTile
                    icon={<TrophyIcon color="warning" />}
                    eyebrow={t('postGameHighlights.mvp')}
                    title={highlights.mvp?.userName || t('postGameHighlights.pendingMvp')}
                    description={highlights.mvp
                      ? t('postGameHighlights.mvpDescription')
                      : t('postGameHighlights.pendingMvpDescription')}
                    avatar={<PlayerAvatar player={highlights.mvp} />}
                  />
                </Grid>
                <Grid xs={12} md={4}>
                  <HighlightTile
                    icon={<DuoIcon color="success" />}
                    eyebrow={t('postGameHighlights.bestDuo')}
                    title={highlights.bestDuo.length >= 2
                      ? `${highlights.bestDuo[0].userName} + ${highlights.bestDuo[1].userName}`
                      : t('postGameHighlights.pendingDuo')}
                    description={highlights.bestDuo.length >= 2
                      ? t('postGameHighlights.bestDuoDescription')
                      : t('postGameHighlights.pendingDuoDescription')}
                  />
                </Grid>
                <Grid xs={12} md={4}>
                  <HighlightTile
                    icon={getMomentIcon(highlights.moment)}
                    eyebrow={t('postGameHighlights.bigMoment')}
                    title={momentLabel || t('postGameHighlights.pendingMoment')}
                    description={t('postGameHighlights.bigMomentDescription')}
                  />
                </Grid>
              </Grid>
            </Box>

            <ReactionBar
              targetPath={`post_game_highlights/${game.id}`}
              reactions={highlightReactions}
              createData={reactionCreateData}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                startIcon={canUseNativeShare ? <ShareIcon /> : <CopyIcon />}
                onClick={handleShare}
              >
                {canUseNativeShare ? t('postGameHighlights.share') : t('postGameHighlights.copy')}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { sm: 'center' } }}>
                {t('postGameHighlights.shareHint')}
              </Typography>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

interface HighlightTileProps {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  avatar?: React.ReactNode;
}

const HighlightTile: React.FC<HighlightTileProps> = ({
  icon,
  eyebrow,
  title,
  description,
  avatar,
}) => (
  <Stack spacing={1.25} sx={{ height: '100%' }}>
    <Stack direction="row" spacing={1} alignItems="center">
      {avatar ?? icon}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
          {eyebrow}
        </Typography>
        <Typography variant="subtitle2" fontWeight={800} noWrap>
          {title}
        </Typography>
      </Box>
    </Stack>
    <Typography variant="body2" color="text.secondary">
      {description}
    </Typography>
  </Stack>
);
