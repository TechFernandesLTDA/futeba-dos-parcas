import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  IconButton,
  Dialog,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { EmptyState } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('GamePhotosTab');

interface GamePhoto {
  id: string;
  gameId: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt?: Date;
}

interface GamePhotosTabProps {
  gameId: string;
  isFinished: boolean;
  isConfirmedPlayer: boolean;
  isOwner: boolean;
}

function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

export const GamePhotosTab: React.FC<GamePhotosTabProps> = ({
  gameId,
  isFinished,
  isConfirmedPlayer,
  isOwner,
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const { t } = useTranslation();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<GamePhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = isFinished && (isConfirmedPlayer || isOwner);

  useEffect(() => {
    const q = query(
      collection(db, 'game_photos'),
      where('game_id', '==', gameId),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const photosData = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            gameId: raw.game_id,
            url: raw.url,
            uploadedBy: raw.uploaded_by,
            uploadedByName: raw.uploaded_by_name || 'Jogador',
            createdAt: raw.created_at?.toDate?.(),
          };
        });
        setPhotos(photosData);
      },
      (err) => {
        logger.error('Error loading photos:', err);
        showErrorRef.current('Erro ao carregar fotos');
      }
    );

    return () => unsubscribe();
  }, [gameId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const photoId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const ref = storageRef(storage, `games/${gameId}/photos/${photoId}.jpg`);

      await uploadBytes(ref, compressed, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(ref);

      await addDoc(collection(db, 'game_photos'), {
        game_id: gameId,
        url: downloadUrl,
        uploaded_by: currentUser.uid,
        uploaded_by_name: currentUser.displayName || 'Jogador',
        storage_path: `games/${gameId}/photos/${photoId}.jpg`,
        created_at: serverTimestamp(),
      });
    } catch (err) {
      logger.error('Error uploading photo:', err);
      showErrorRef.current(getFirestoreErrorMessage(err, 'Erro ao fazer upload da foto'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: GamePhoto) => {
    if (!currentUser) return;
    const isUploader = photo.uploadedBy === currentUser.uid;
    if (!isUploader && !isOwner) {
      showErrorRef.current('Apenas o uploader ou o organizador podem deletar');
      return;
    }

    try {
      await deleteDoc(doc(db, 'game_photos', photo.id));
    } catch (err) {
      logger.error('Error deleting photo:', err);
      showErrorRef.current('Erro ao deletar foto');
    }
  };

  const canDelete = (photo: GamePhoto) => {
  const { t } = useTranslation();
    if (!currentUser) return false;
    return photo.uploadedBy === currentUser.uid || isOwner;
  };

  return (
    <Box>
      {canUpload && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUpload}
          />
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Enviando...' : 'Adicionar Foto'}
          </Button>
        </Box>
      )}

      {photos.length === 0 ? (
        <EmptyState
          icon={<AddIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
          title="Nenhuma foto ainda"
          description={canUpload ? 'Seja o primeiro a compartilhar uma foto!' : 'Fotos serão exibidas aqui após o jogo.'}
        />
      ) : (
        <Grid container spacing={1}>
          {photos.map((photo) => (
            <Grid xs={4} sm={3} md={2} key={photo.id}>
              <Box
                sx={{
                  position: 'relative',
                  paddingTop: '100%',
                  borderRadius: 1,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  '&:hover .delete-btn': { opacity: 1 },
                }}
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.url}
                  alt={`Foto por ${photo.uploadedByName}`}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {canDelete(photo) && (
                  <IconButton
                    className="delete-btn"
                    size="small"
                    aria-label={t('a11y.deletePhoto')}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      bgcolor: alpha(theme.palette.common.black, 0.5),
                      color: theme.palette.common.white,
                      opacity: 0,
                      transition: (t) => t.transitions.create('opacity', { duration: t.transitions.duration.shorter }),
                      '&:hover': { bgcolor: 'error.main' },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        maxWidth="lg"
        fullWidth
      >
        <Box sx={{ position: 'relative', bgcolor: theme.palette.common.black, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconButton
            sx={{ position: 'absolute', top: 8, right: 8, color: theme.palette.common.white, zIndex: 1, bgcolor: alpha(theme.palette.common.black, 0.5) }}
            onClick={() => setSelectedPhoto(null)}
            aria-label={t('a11y.close')}
          >
            <CloseIcon />
          </IconButton>
          {selectedPhoto && (
            <img
              src={selectedPhoto.url}
              alt={`Foto por ${selectedPhoto.uploadedByName}`}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          )}
        </Box>
        {selectedPhoto && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Foto de {selectedPhoto.uploadedByName}
            </Typography>
          </Box>
        )}
      </Dialog>
    </Box>
  );
};
