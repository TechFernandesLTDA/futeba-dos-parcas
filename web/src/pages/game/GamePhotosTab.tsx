import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  AddPhotoAlternate as AddPhotoIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  PhotoLibrary as PhotoLibraryIcon,
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
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/common/EmptyState';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GamePhotosTab');
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const CAPTION_MAX_LENGTH = 160;

interface GamePhoto {
  id: string;
  gameId: string;
  url: string;
  storagePath: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByPhoto?: string;
  caption?: string;
  createdAt?: Date;
}

interface GamePhotosTabProps {
  gameId: string;
  isFinished: boolean;
  isConfirmedPlayer: boolean;
  isOwner: boolean;
  canManage?: boolean;
}

function safeFileName(file: File) {
  const extension = file.type.split('/')[1] || 'jpg';
  return `${Date.now()}-${crypto.randomUUID()}.${extension.replace('jpeg', 'jpg')}`;
}

export const GamePhotosTab: React.FC<GamePhotosTabProps> = ({
  gameId,
  isFinished,
  isConfirmedPlayer,
  isOwner,
  canManage = isOwner,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { currentUser, user } = useAuth();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<GamePhoto | null>(null);

  showErrorRef.current = showError;
  const canUpload = isFinished && (isConfirmedPlayer || canManage);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const photosQuery = query(
      collection(db, 'game_photos'),
      where('game_id', '==', gameId),
      orderBy('created_at', 'desc'),
    );

    const unsubscribe = onSnapshot(
      photosQuery,
      (snapshot) => {
        setPhotos(snapshot.docs.map((photoDoc) => {
          const raw = photoDoc.data();
          return {
            id: photoDoc.id,
            gameId: raw.game_id,
            url: raw.url,
            storagePath: raw.storage_path,
            uploadedBy: raw.uploaded_by,
            uploadedByName: raw.uploaded_by_name || t('common.player'),
            uploadedByPhoto: raw.uploaded_by_photo || undefined,
            caption: raw.caption || undefined,
            createdAt: raw.created_at?.toDate?.(),
          };
        }));
        setLoading(false);
      },
      (err) => {
        logger.error('Error loading game photos:', err);
        const message = getFirestoreErrorMessage(err, t('gamePhotos.loadError'));
        setError(message);
        setLoading(false);
        showErrorRef.current(message);
      },
    );

    return () => unsubscribe();
  }, [gameId, t]);

  const validatePhoto = (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(t('gamePhotos.invalidType'));
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      throw new Error(t('gamePhotos.sizeLimit'));
    }
    const cleanCaption = caption.trim();
    if (cleanCaption.length > CAPTION_MAX_LENGTH) {
      throw new Error(t('gamePhotos.captionTooLong', { max: CAPTION_MAX_LENGTH }));
    }
    return cleanCaption;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    setUploading(true);
    try {
      const cleanCaption = validatePhoto(file);
      const path = `games/${gameId}/photos/${currentUser.uid}/${safeFileName(file)}`;
      const fileRef = storageRef(storage, path);

      await uploadBytes(fileRef, file, {
        contentType: file.type,
        customMetadata: {
          gameId,
          uploadedBy: currentUser.uid,
        },
      });
      const downloadUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'game_photos'), {
        game_id: gameId,
        url: downloadUrl,
        storage_path: path,
        uploaded_by: currentUser.uid,
        uploaded_by_name: user?.name || currentUser.displayName || t('common.player'),
        uploaded_by_photo: user?.photoUrl || currentUser.photoURL || '',
        content_type: file.type,
        size: file.size,
        caption: cleanCaption,
        status: 'ACTIVE',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setCaption('');
      showSuccess(t('gamePhotos.uploadSuccess'));
    } catch (err) {
      logger.error('Error uploading game photo:', err);
      showError(err instanceof Error && !('code' in err) ? err.message : getFirestoreErrorMessage(err, t('gamePhotos.uploadError')));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canDelete = (photo: GamePhoto) => {
    if (!currentUser?.uid) return false;
    return photo.uploadedBy === currentUser.uid || canManage;
  };

  const handleDelete = async (photo: GamePhoto) => {
    if (!canDelete(photo)) {
      showError(t('gamePhotos.deleteForbidden'));
      return;
    }

    setDeletingId(photo.id);
    try {
      if (photo.storagePath) {
        try {
          await deleteObject(storageRef(storage, photo.storagePath));
        } catch (err) {
          const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
          if (code !== 'storage/object-not-found') throw err;
        }
      }
      await deleteDoc(doc(db, 'game_photos', photo.id));
      setSelectedPhoto((current) => (current?.id === photo.id ? null : current));
      showSuccess(t('gamePhotos.deleteSuccess'));
    } catch (err) {
      logger.error('Error deleting game photo:', err);
      showError(getFirestoreErrorMessage(err, t('gamePhotos.deleteError')));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <PhotoLibraryIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{t('gamePhotos.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('gamePhotos.description')}</Typography>
          </Box>
        </Stack>

        {canUpload && (
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              label={t('gamePhotos.captionLabel')}
              placeholder={t('gamePhotos.captionPlaceholder')}
              fullWidth
              inputProps={{ maxLength: CAPTION_MAX_LENGTH }}
              helperText={t('common.charCount', { current: caption.length, max: CAPTION_MAX_LENGTH })}
            />
            <Box>
              <input ref={fileInputRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} hidden onChange={handleUpload} />
              <Button
                variant="contained"
                startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <AddPhotoIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? t('gamePhotos.uploading') : t('gamePhotos.addPhoto')}
              </Button>
            </Box>
          </Stack>
        )}

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && !error && photos.length === 0 && (
          <EmptyState
            icon={<PhotoLibraryIcon sx={{ fontSize: 48 }} />}
            title={t('gamePhotos.emptyTitle')}
            description={canUpload ? t('gamePhotos.emptyUploadDesc') : t('gamePhotos.emptyReadOnlyDesc')}
          />
        )}

        {!loading && !error && photos.length > 0 && (
          <Grid container spacing={1.5}>
            {photos.map((photo) => (
              <Grid xs={6} sm={4} md={3} key={photo.id}>
                <Box
                  sx={{
                    position: 'relative',
                    pt: '100%',
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                    '&:hover .photo-delete': { opacity: 1 },
                  }}
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <Box
                    component="img"
                    src={photo.url}
                    alt={t('gamePhotos.photoAlt', { name: photo.uploadedByName })}
                    loading="lazy"
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {canDelete(photo) && (
                    <IconButton
                      className="photo-delete"
                      size="small"
                      aria-label={t('gamePhotos.deletePhoto')}
                      disabled={deletingId === photo.id}
                      sx={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        bgcolor: alpha(theme.palette.common.black, 0.58),
                        color: theme.palette.common.white,
                        opacity: { xs: 1, sm: 0 },
                        transition: (transitionTheme) => transitionTheme.transitions.create('opacity', { duration: transitionTheme.transitions.duration.shorter }),
                        '&:hover': { bgcolor: theme.palette.error.main },
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(photo);
                      }}
                    >
                      {deletingId === photo.id ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>

      <Dialog open={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} maxWidth="md" fullWidth>
        {selectedPhoto && (
          <>
            <Box sx={{ position: 'relative', bgcolor: theme.palette.common.black, display: 'flex', justifyContent: 'center' }}>
              <IconButton
                sx={{ position: 'absolute', top: 8, right: 8, color: theme.palette.common.white, bgcolor: alpha(theme.palette.common.black, 0.52), zIndex: 1 }}
                onClick={() => setSelectedPhoto(null)}
                aria-label={t('a11y.close')}
              >
                <CloseIcon />
              </IconButton>
              <Box component="img" src={selectedPhoto.url} alt={t('gamePhotos.photoAlt', { name: selectedPhoto.uploadedByName })} sx={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain' }} />
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2 }}>
              <Avatar src={selectedPhoto.uploadedByPhoto}>{selectedPhoto.uploadedByName.charAt(0).toUpperCase()}</Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>{selectedPhoto.uploadedByName}</Typography>
                {selectedPhoto.caption && <Typography variant="body2" color="text.secondary">{selectedPhoto.caption}</Typography>}
              </Box>
              {canDelete(selectedPhoto) && (
                <Button
                  color="error"
                  startIcon={deletingId === selectedPhoto.id ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                  disabled={deletingId === selectedPhoto.id}
                  onClick={() => handleDelete(selectedPhoto)}
                >
                  {t('common.delete')}
                </Button>
              )}
            </Stack>
          </>
        )}
      </Dialog>
    </Card>
  );
};
