import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Movie as MovieIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  type UploadTask,
  uploadBytesResumable,
} from 'firebase/storage';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/common/EmptyState';
import { ReactionBar } from '../../components/reactions/ReactionBar';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GameVideosTab');
const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;
const CAPTION_MAX_LENGTH = 200;
const MAX_VIDEOS_PER_GAME = 10;
const MAX_VIDEOS_PER_USER_PER_GAME = 3;

interface GameVideo {
  id: string;
  gameId: string;
  url: string;
  storagePath: string;
  thumbnailPath: string | null;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByPhoto?: string;
  caption?: string;
  reactions?: Record<string, string[]>;
  status: 'PROCESSING' | 'READY' | 'REJECTED';
  rejectionReason?: string | null;
  durationSec?: number | null;
  createdAt?: Date;
}

interface GameVideosTabProps {
  gameId: string;
  isFinished: boolean;
  isConfirmedPlayer: boolean;
  isOwner: boolean;
  canManage?: boolean;
}

function safeVideoFileName(file: File) {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 48) || 'clip';
  return `${Date.now()}-${base}-${crypto.randomUUID()}.mp4`;
}

export const GameVideosTab: React.FC<GameVideosTabProps> = ({
  gameId,
  isFinished,
  isConfirmedPlayer,
  isOwner,
  canManage = isOwner,
}) => {
  const { t } = useTranslation();
  const { currentUser, user } = useAuth();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);
  const mountedRef = useRef(true);

  const [videos, setVideos] = useState<GameVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  showErrorRef.current = showError;
  const activeVideoCount = videos.filter((video) => video.status !== 'REJECTED').length;
  const userVideoCount = videos.filter((video) => video.uploadedBy === currentUser?.uid && video.status !== 'REJECTED').length;
  const hasReachedGameLimit = activeVideoCount >= MAX_VIDEOS_PER_GAME;
  const hasReachedUserLimit = userVideoCount >= MAX_VIDEOS_PER_USER_PER_GAME;
  const canUpload = isFinished && (isConfirmedPlayer || canManage) && !hasReachedGameLimit && !hasReachedUserLimit;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploadTaskRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const videosQuery = query(
      collection(db, 'game_videos'),
      where('game_id', '==', gameId),
      orderBy('created_at', 'desc'),
    );

    const unsubscribe = onSnapshot(
      videosQuery,
      (snapshot) => {
        setVideos(snapshot.docs.map((videoDoc) => {
          const raw = videoDoc.data();
          return {
            id: videoDoc.id,
            gameId: raw.game_id,
            url: raw.url,
            storagePath: raw.storage_path,
            thumbnailPath: raw.thumbnail_path ?? null,
            uploadedBy: raw.uploaded_by,
            uploadedByName: raw.uploaded_by_name || t('common.player'),
            uploadedByPhoto: raw.uploaded_by_photo || undefined,
            caption: raw.caption || undefined,
            reactions: raw.reactions || {},
            status: raw.status || 'PROCESSING',
            rejectionReason: raw.rejection_reason,
            durationSec: raw.duration_sec,
            createdAt: raw.created_at?.toDate?.(),
          };
        }));
        setLoading(false);
      },
      (err) => {
        logger.error('Error loading game videos:', err);
        const message = getFirestoreErrorMessage(err, t('gameVideos.loadError'));
        setError(message);
        setLoading(false);
        showErrorRef.current(message);
      },
    );

    return () => unsubscribe();
  }, [gameId, t]);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnailUrls = async () => {
      const nextUrls: Record<string, string> = {};
      await Promise.all(videos.map(async (video) => {
        if (!video.thumbnailPath) return;
        try {
          nextUrls[video.id] = await getDownloadURL(storageRef(storage, video.thumbnailPath));
        } catch (err) {
          logger.warn('Failed to resolve video thumbnail URL:', err);
        }
      }));

      if (!cancelled) {
        setThumbnailUrls(nextUrls);
      }
    };

    void loadThumbnailUrls();

    return () => {
      cancelled = true;
    };
  }, [videos]);

  const validateVideo = async (file: File) => {
    if (file.type !== 'video/mp4') {
      throw new Error(t('gameVideos.invalidType'));
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(t('gameVideos.sizeLimit'));
    }
    const cleanCaption = caption.trim();
    if (cleanCaption.length > CAPTION_MAX_LENGTH) {
      throw new Error(t('gameVideos.captionTooLong', { max: CAPTION_MAX_LENGTH }));
    }
    return { cleanCaption };
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    setUploading(true);
    setUploadProgress(0);
    let uploadedPath: string | null = null;
    try {
      const { cleanCaption } = await validateVideo(file);
      const path = `games/${gameId}/videos/${currentUser.uid}/${safeVideoFileName(file)}`;
      const fileRef = storageRef(storage, path);
      uploadedPath = path;
      const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: 'video/mp4',
        customMetadata: {
          gameId,
          uploadedBy: currentUser.uid,
        },
      });
      uploadTaskRef.current = uploadTask;

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (!mountedRef.current) return;
            setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          reject,
          () => resolve(),
        );
      });
      uploadTaskRef.current = null;

      const downloadUrl = await getDownloadURL(fileRef);
      await addDoc(collection(db, 'game_videos'), {
        game_id: gameId,
        url: downloadUrl,
        storage_path: path,
        thumbnail_path: null,
        uploaded_by: currentUser.uid,
        uploaded_by_name: user?.name || currentUser.displayName || t('common.player'),
        uploaded_by_photo: user?.photoUrl || currentUser.photoURL || '',
        content_type: 'video/mp4',
        size: file.size,
        duration_sec: null,
        caption: cleanCaption,
        reactions: {},
        status: 'PROCESSING',
        rejection_reason: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      if (mountedRef.current) {
        setCaption('');
        showSuccess(t('gameVideos.uploadSuccess'));
      }
    } catch (err) {
      uploadTaskRef.current = null;
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
      if (code === 'storage/canceled') {
        return;
      }
      if (uploadedPath) {
        await deleteObject(storageRef(storage, uploadedPath)).catch((storageErr) => {
          logger.warn('Failed to clean orphaned game video upload:', storageErr);
        });
      }
      logger.error('Error uploading game video:', err);
      if (mountedRef.current) {
        showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err, t('gameVideos.uploadError')));
      }
    } finally {
      if (mountedRef.current) {
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const canDelete = (video: GameVideo) => {
    if (!currentUser?.uid) return false;
    return video.uploadedBy === currentUser.uid || canManage;
  };

  const handleDelete = async (video: GameVideo) => {
    if (!canDelete(video)) {
      showError(t('gameVideos.deleteForbidden'));
      return;
    }

    setDeletingId(video.id);
    try {
      if (video.storagePath) {
        await deleteObject(storageRef(storage, video.storagePath)).catch((storageErr) => {
          const code = typeof storageErr === 'object' && storageErr && 'code' in storageErr ? String(storageErr.code) : '';
          if (code !== 'storage/object-not-found') {
            throw storageErr;
          }
        });
      }
      if (video.thumbnailPath) {
        await deleteObject(storageRef(storage, video.thumbnailPath)).catch((storageErr) => {
          const code = typeof storageErr === 'object' && storageErr && 'code' in storageErr ? String(storageErr.code) : '';
          if (code !== 'storage/object-not-found') {
            throw storageErr;
          }
        });
      }
      await deleteDoc(doc(db, 'game_videos', video.id)).catch(async (deleteErr) => {
        await updateDoc(doc(db, 'game_videos', video.id), {
          url: '',
          storage_path: null,
          thumbnail_path: null,
          updated_at: serverTimestamp(),
        }).catch((recoveryErr) => {
          logger.warn('Failed to scrub game video document after storage deletion:', recoveryErr);
        });
        throw deleteErr;
      });
      showSuccess(t('gameVideos.deleteSuccess'));
    } catch (err) {
      logger.error('Error deleting game video:', err);
      showError(getFirestoreErrorMessage(err, t('gameVideos.deleteError')));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{t('gameVideos.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('gameVideos.description')}</Typography>
          </Box>

          {canUpload && (
            <Stack spacing={1.5}>
              <TextField
                size="small"
                label={t('gameVideos.captionLabel')}
                placeholder={t('gameVideos.captionPlaceholder')}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                inputProps={{ maxLength: CAPTION_MAX_LENGTH }}
                helperText={t('common.charCount', { current: caption.length, max: CAPTION_MAX_LENGTH })}
              />
              <Box>
                <input ref={fileInputRef} hidden type="file" accept="video/mp4" onChange={handleUpload} />
                <Button
                  variant="contained"
                  startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? t('gameVideos.uploading') : t('gameVideos.addVideo')}
                </Button>
                {uploading && <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />}
              </Box>
            </Stack>
          )}
          {!canUpload && isFinished && (isConfirmedPlayer || canManage) && (hasReachedGameLimit || hasReachedUserLimit) && (
            <Alert severity="info">
              {hasReachedGameLimit ? t('gameVideos.gameLimitReached') : t('gameVideos.userLimitReached')}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>}

          {!loading && !error && videos.length === 0 && (
            <EmptyState
              icon={<MovieIcon sx={{ fontSize: 48 }} />}
              title={t('gameVideos.emptyTitle')}
              description={canUpload ? t('gameVideos.emptyUploadDesc') : t('gameVideos.emptyReadOnlyDesc')}
            />
          )}

          {!loading && !error && videos.length > 0 && (
            <Stack spacing={2}>
              {videos.map((video) => (
                <Card key={video.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={700}>{video.uploadedByName}</Typography>
                          {video.caption && <Typography variant="body2" color="text.secondary">{video.caption}</Typography>}
                        </Box>
                        <Chip size="small" label={t(`gameVideos.status_${video.status}`)} color={video.status === 'READY' ? 'success' : video.status === 'REJECTED' ? 'error' : 'default'} />
                        {canDelete(video) && (
                          <IconButton
                            size="small"
                            aria-label={t('gameVideos.deleteVideo')}
                            disabled={deletingId === video.id}
                            onClick={() => void handleDelete(video)}
                          >
                            {deletingId === video.id ? <CircularProgress size={18} /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </Stack>
                      {video.status === 'REJECTED' ? (
                        <Alert severity="warning">{t('gameVideos.rejected')}</Alert>
                      ) : (
                        <Box
                          component="video"
                          src={video.url}
                          poster={thumbnailUrls[video.id]}
                          muted
                          controls
                          playsInline
                          preload="metadata"
                          sx={{ width: '100%', maxHeight: 420, bgcolor: 'common.black', borderRadius: 1 }}
                        />
                      )}
                      {video.status !== 'REJECTED' && (
                        <ReactionBar
                          targetPath={`game_videos/${video.id}`}
                          reactions={video.reactions || {}}
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
