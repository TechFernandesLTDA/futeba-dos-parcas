import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { PlayArrow as PlayIcon } from '@mui/icons-material';
import { resolveWallPostStorageUrl } from '../../utils/wallMediaStorage';

interface WallPostVideoPlayerProps {
  src: string;
  poster?: string | null;
  mediaPath?: string | null;
  posterPath?: string | null;
  authorName: string;
  resolveStorageUrl?: (path: string) => Promise<string>;
  maxHeight?: number | string;
}
type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'error';

function withPlaybackRevision(url: string, revision: number) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('fp_play', String(revision));
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Player leve para a timeline: o MP4 so e solicitado apos a interacao do usuario.
 * O elemento nativo preserva suporte a byte ranges, fullscreen e controles moveis.
 */
export function WallPostVideoPlayer({
  src,
  poster,
  mediaPath,
  posterPath,
  authorName,
  resolveStorageUrl = resolveWallPostStorageUrl,
  maxHeight = 420,
}: WallPostVideoPlayerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [activeSrc, setActiveSrc] = useState(src);
  const [activePoster, setActivePoster] = useState(poster);
  const [posterFailed, setPosterFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const recoveryGeneration = useRef(0);
  const sourceRecoveryAttempted = useRef(false);
  const posterRecoveryAttempted = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const setVideoNode = useCallback((node: HTMLVideoElement | null) => {
    const previous = videoRef.current;
    if (previous && previous !== node) {
      previous.pause();
      previous.removeAttribute('src');
      previous.load();
    }
    videoRef.current = node;
  }, []);

  useEffect(() => {
    recoveryGeneration.current += 1;
    sourceRecoveryAttempted.current = false;
    posterRecoveryAttempted.current = false;
    setStatus('idle');
    setActiveSrc(src);
    setActivePoster(poster);
    setPosterFailed(false);
    setRetryKey(0);
  }, [mediaPath, poster, posterPath, src]);

  const openLabel = t('groupWall.openVideo', { name: authorName });
  const hasPoster = Boolean(activePoster) && !posterFailed;

  const activate = () => {
    setStatus('loading');
  };

  const retry = () => {
    // Ação explícita do usuário abre um novo budget de uma única renovação.
    // Falhas automáticas continuam limitadas para não criar loop.
    sourceRecoveryAttempted.current = false;
    posterRecoveryAttempted.current = false;
    setStatus('loading');
    setRetryKey((current) => current + 1);
  };

  const handlePlaybackError = async () => {
    if (!mediaPath || sourceRecoveryAttempted.current) {
      setStatus('error');
      return;
    }

    sourceRecoveryAttempted.current = true;
    setStatus('loading');
    const generation = recoveryGeneration.current;

    try {
      const freshUrl = await resolveStorageUrl(mediaPath);
      if (generation !== recoveryGeneration.current) return;
      setActiveSrc(freshUrl);
      setRetryKey((current) => current + 1);
    } catch {
      if (generation === recoveryGeneration.current) setStatus('error');
    }
  };

  const handlePosterError = async () => {
    if (!posterPath || posterRecoveryAttempted.current) {
      setPosterFailed(true);
      return;
    }

    posterRecoveryAttempted.current = true;
    const generation = recoveryGeneration.current;

    try {
      const freshUrl = await resolveStorageUrl(posterPath);
      if (generation !== recoveryGeneration.current) return;
      setActivePoster(freshUrl);
    } catch {
      if (generation === recoveryGeneration.current) setPosterFailed(true);
    }
  };

  if (status === 'idle') {
    return (
      <Box
        component="button"
        type="button"
        onClick={activate}
        aria-label={openLabel}
        sx={{
          position: 'relative',
          display: 'block',
          width: '100%',
          minHeight: { xs: 200, sm: 240 },
          aspectRatio: '16 / 9',
          p: 0,
          overflow: 'hidden',
          border: 0,
          borderRadius: 1,
          cursor: 'pointer',
          bgcolor: theme.palette.common.black,
          '&:focus-visible': {
            outline: `3px solid ${theme.palette.primary.main}`,
            outlineOffset: -3,
          },
        }}
      >
        {hasPoster && (
          <Box
            component="img"
            src={activePoster!}
            alt=""
            loading="lazy"
            onError={() => void handlePosterError()}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(theme.palette.common.black, hasPoster ? 0.18 : 0.42),
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 58,
              height: 58,
              borderRadius: '50%',
              color: theme.palette.common.white,
              bgcolor: alpha(theme.palette.common.black, 0.72),
            }}
          >
            <PlayIcon sx={{ fontSize: 38 }} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          minHeight: { xs: 200, sm: 240 },
          aspectRatio: '16 / 9',
          placeItems: 'center',
          overflow: 'hidden',
          borderRadius: 1,
          bgcolor: theme.palette.common.black,
        }}
      >
        {hasPoster && (
          <Box
            component="img"
            src={activePoster!}
            alt=""
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.28,
            }}
          />
        )}
        <Alert
          severity="warning"
          action={(
            <Button color="inherit" size="small" onClick={retry}>
              {t('groupWall.retryVideo')}
            </Button>
          )}
          sx={{
            position: 'relative',
            width: { xs: 'calc(100% - 24px)', sm: 'auto' },
            maxWidth: 520,
          }}
        >
          {t('groupWall.videoLoadError')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: theme.palette.common.black,
      }}
    >
      <Box
        component="video"
        key={retryKey}
        ref={setVideoNode}
        controls
        playsInline
        crossOrigin="anonymous"
        preload="metadata"
        controlsList="nodownload"
        poster={hasPoster ? activePoster! : undefined}
        aria-label={openLabel}
        onLoadStart={() => setStatus('loading')}
        onLoadedMetadata={() => setStatus('ready')}
        onCanPlay={() => {
          setStatus('ready');
          void videoRef.current?.play()?.catch(() => {});
        }}
        onPlaying={() => setStatus('ready')}
        onWaiting={() => setStatus('loading')}
        onSeeking={() => setStatus('loading')}
        onSeeked={() => setStatus('ready')}
        onError={() => void handlePlaybackError()}
        sx={{
          display: 'block',
          width: '100%',
          minHeight: { xs: 200, sm: 240 },
          maxHeight,
          aspectRatio: '16 / 9',
          objectFit: 'contain',
          bgcolor: theme.palette.common.black,
        }}
      >
        <source src={withPlaybackRevision(activeSrc, retryKey)} type="video/mp4" />
        {t('groupWall.videoLoadError')}
      </Box>

      {status === 'loading' && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            justifyItems: 'center',
            gap: 1,
            pointerEvents: 'none',
            color: theme.palette.common.white,
            bgcolor: alpha(theme.palette.common.black, 0.38),
          }}
        >
          <CircularProgress size={36} color="inherit" />
          <Typography variant="caption" color="inherit">
            {t('common.loading')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
