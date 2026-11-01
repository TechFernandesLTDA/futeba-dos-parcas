/**
 * #4408: visão pública do jogo para quem abre o link compartilhado sem login.
 *
 * Mostra só o que a Cloud Function `publicGamePage` libera (data, horário,
 * local, grupo e contagem de vagas) e um CTA para entrar/criar conta e
 * confirmar presença. Usuário logado nunca chega aqui: o `GameDetailRoute`
 * em App.tsx o leva ao GameDetailScreen completo.
 *
 * Estados: loading (skeleton), empty (jogo privado/inexistente/excluído),
 * error (falha de rede, com retry) e success.
 */
import React, { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Groups as GroupsIcon,
  Lock as LockIcon,
  Place as PlaceIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../contexts/ToastContext';
import { fetchPublicGame, formatPublicGameDate, type PublicGame } from '../../services/publicGameService';

const PUBLIC_SITE_URL = 'https://futebadosparcas.com.br';

const STATUS_KEYS: Record<PublicGame['status'], string> = {
  SCHEDULED: 'publicGame.statusScheduled',
  CONFIRMED: 'publicGame.statusConfirmed',
  LIVE: 'publicGame.statusLive',
  FINISHED: 'publicGame.statusFinished',
  CANCELLED: 'publicGame.statusCancelled',
};

function isAcceptingPlayers(status: PublicGame['status']): boolean {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

function LoadingView({ label }: { label: string }) {
  return (
    <Card variant="outlined" aria-busy="true" aria-label={label}>
      <CardContent>
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="80%" height={40} />
        <Skeleton variant="rounded" height={56} sx={{ mt: 2 }} />
        <Skeleton variant="rounded" height={56} sx={{ mt: 1.5 }} />
        <Skeleton variant="rounded" height={48} sx={{ mt: 3 }} />
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: 'primary.main', display: 'flex', pt: 0.25 }} aria-hidden="true">
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" component="p" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body1" color="text.primary">
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

export const PublicGameScreen: React.FC = () => {
  const { gameId = '' } = useParams<{ gameId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const { data: game, isLoading, isError, refetch } = useQuery({
    queryKey: ['publicGame', gameId],
    queryFn: ({ signal }) => fetchPublicGame(gameId, signal),
    enabled: Boolean(gameId),
    staleTime: 60_000,
  });

  const title = game ? (game.groupName ?? t('publicGame.defaultTitle')) : t('publicGame.pageTitle');
  useDocumentTitle(title);

  const shareUrl = `${PUBLIC_SITE_URL}/game/${encodeURIComponent(gameId)}`;
  const authState = useMemo(() => ({ from: { pathname: `/game/${gameId}` } }), [gameId]);
  const goLogin = useCallback(() => navigate('/login', { state: authState }), [navigate, authState]);
  const goRegister = useCallback(() => navigate('/register', { state: authState }), [navigate, authState]);

  const handleShare = useCallback(async () => {
    const text = t('publicGame.shareText', { title });
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      showSuccess(t('publicGame.linkCopied'));
    } catch (err) {
      // Usuário fechar a folha de compartilhamento não é erro.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showError(t('publicGame.shareError'));
    }
  }, [shareUrl, showError, showSuccess, t, title]);

  let content: React.ReactNode;
  if (isLoading) {
    content = <LoadingView label={t('publicGame.loading')} />;
  } else if (isError) {
    content = (
      <ErrorState
        message={t('publicGame.errorMessage')}
        onRetry={() => void refetch()}
        retryLabel={t('publicGame.retry')}
      />
    );
  } else if (!game) {
    content = (
      <EmptyState
        icon={<LockIcon />}
        title={t('publicGame.unavailableTitle')}
        description={t('publicGame.unavailableBody')}
        actionLabel={t('publicGame.loginShort')}
        onAction={goLogin}
        secondaryActionLabel={t('publicGame.register')}
        onSecondaryAction={goRegister}
      />
    );
  } else {
    const dateLabel = formatPublicGameDate(game.date, i18n.language) ?? t('publicGame.noDate');
    const timeLabel = game.time
      ? (game.endTime ? t('publicGame.timeRange', { start: game.time, end: game.endTime }) : game.time)
      : null;
    const whenValue = timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
    const accepting = isAcceptingPlayers(game.status);
    const confirmedLabel = game.maxPlayers !== null
      ? t('publicGame.confirmedOf', { count: game.playersCount, max: game.maxPlayers })
      : t('publicGame.confirmedNoLimit', { count: game.playersCount });
    const spotsLabel = game.spotsLeft === null
      ? null
      : game.spotsLeft === 0
        ? t('publicGame.full')
        : t('publicGame.spotsLeft', { count: game.spotsLeft });
    const fill = game.maxPlayers ? Math.min(100, Math.round((game.playersCount / game.maxPlayers) * 100)) : 0;

    content = (
      <Card variant="outlined" component="article" aria-labelledby="public-game-title">
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Chip size="small" color={accepting ? 'primary' : 'default'} label={t(STATUS_KEYS[game.status])} />
            <Chip
              size="small"
              variant="outlined"
              label={game.joinMode === 'OPEN' ? t('publicGame.joinOpen') : t('publicGame.joinClosed')}
            />
          </Stack>

          <Typography id="public-game-title" variant="h5" component="h1" color="text.primary" sx={{ mb: 2.5 }}>
            {title}
          </Typography>

          <Stack spacing={2}>
            <InfoRow icon={<TimeIcon />} label={t('publicGame.when')} value={whenValue} />
            <InfoRow
              icon={<PlaceIcon />}
              label={t('publicGame.where')}
              value={game.locationName ?? t('publicGame.noLocation')}
            />
            <Box>
              <InfoRow
                icon={<GroupsIcon />}
                label={t('publicGame.spots')}
                value={spotsLabel ? `${confirmedLabel} · ${spotsLabel}` : confirmedLabel}
              />
              {game.maxPlayers ? (
                <LinearProgress
                  variant="determinate"
                  value={fill}
                  aria-label={confirmedLabel}
                  sx={{ mt: 1, ml: 4.5, height: 8, borderRadius: 4 }}
                />
              ) : null}
            </Box>
          </Stack>

          <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle1" component="h2" color="text.primary">
              {t('publicGame.ctaTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {accepting ? t('publicGame.ctaBody') : t('publicGame.ctaBodyEnded')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" size="large" onClick={goLogin} sx={{ minHeight: 48 }}>
                {accepting ? t('publicGame.login') : t('publicGame.loginShort')}
              </Button>
              <Button variant="outlined" size="large" onClick={goRegister} sx={{ minHeight: 48 }}>
                {t('publicGame.register')}
              </Button>
            </Stack>
          </Box>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }} spacing={2}>
            <Typography variant="caption" color="text.secondary">
              {t('publicGame.privacyNote')}
            </Typography>
            <Button
              variant="text"
              startIcon={<ShareIcon />}
              onClick={() => void handleShare()}
              sx={{ minHeight: 48, flexShrink: 0 }}
            >
              {t('publicGame.share')}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <PageContainer maxWidth="form">
      <Box component="main" id="main-content">
        {content}
      </Box>
    </PageContainer>
  );
};

export default PublicGameScreen;
