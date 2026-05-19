import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Avatar,
  IconButton,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PhotoCamera as CameraIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { FormScaffold } from '../../components/layout';
import { TeamSelector } from '../../components/team/TeamSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PreferredPosition } from '../../types/user';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('EditProfileScreen');

// Limites para upload do avatar (alinhados com storage.rules: 2MB, image/*)
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ACCEPTED_PREFIX = 'image/';

const POSITION_VALUES: PreferredPosition[] = [
  'GOLEIRO',
  'ZAGUEIRO',
  'LATERAL',
  'VOLANTE',
  'MEIA',
  'ATACANTE',
];

interface UserProfile {
  name: string;
  nickname: string;
  phone: string;
  preferredPosition?: PreferredPosition;
  bio: string;
  favoriteTeam?: string | null;
}

export const EditProfileScreen: React.FC = () => {
  useDocumentTitle('Editar Perfil');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, updateUserProfile } = useAuth();
  const { showError } = useToast();
  const [initialData, setInitialData] = useState<UserProfile | null>(null);

  // Posições traduzidas — derivadas dentro do componente para usar t()
  const POSITION_LABELS: Record<PreferredPosition, string> = {
    GOLEIRO: t('profile.positionGoalkeeper'),
    ZAGUEIRO: t('profile.positionDefender'),
    LATERAL: t('profile.positionFullback'),
    VOLANTE: t('profile.positionDefMidfielder'),
    MEIA: t('profile.positionMidfielder'),
    ATACANTE: t('profile.positionForward'),
  };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    nickname: '',
    phone: '',
    preferredPosition: undefined,
    bio: '',
    favoriteTeam: null,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo (storage.rules exige image/*)
    if (!file.type.startsWith(AVATAR_ACCEPTED_PREFIX)) {
      showError(t('profile.avatarInvalidType'));
      return;
    }

    // Valida tamanho (storage.rules limita a 2MB)
    if (file.size > AVATAR_MAX_BYTES) {
      showError(t('profile.avatarTooLarge'));
      return;
    }

    // Revoga URL anterior pra evitar memory leak
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
  };

  // Cleanup de blob URL ao desmontar
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = snakeToCamel(userDoc.data()) as Record<string, any>;
        const loaded: UserProfile = {
          name: data.name || currentUser.displayName || '',
          nickname: data.nickname || '',
          phone: data.phone || '',
          preferredPosition: data.preferredPosition,
          bio: data.bio || '',
          favoriteTeam: data.favoriteTeam || null,
        };
        setFormData(loaded);
        setInitialData(loaded);
      }
    } catch (err) {
      setError(getFirestoreErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser, loadProfile]);

  const handleInputChange = (field: keyof UserProfile, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('profile.errorNameRequired');
    } else if (formData.name.length < 2) {
      errors.name = t('profile.errorNameMinLength');
    }

    if (formData.nickname && formData.nickname.length > 20) {
      errors.nickname = t('profile.errorNicknameMaxLength');
    }

    // #1339: telefone é opcional, mas se preenchido deve ter DDD + número
    // (10 fixo, 11 celular). Não força máscara (mudança de UX maior).
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      errors.phone = t('profile.errorInvalidPhone');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const uploadAvatar = async (file: File, uid: string): Promise<string> => {
    // Path alinhado com storage.rules: users/{uid}/{fileName}
    const fileRef = storageRef(storage, `users/${uid}/avatar.jpg`);
    await uploadBytes(fileRef, file, { contentType: file.type });
    return getDownloadURL(fileRef);
  };

  const handleSave = async () => {
    if (!validate() || !currentUser) return;

    setSaving(true);
    setError(null);

    // 1) Upload do avatar (se houver arquivo selecionado)
    let uploadedPhotoUrl: string | null = null;
    if (selectedFile) {
      setUploadingAvatar(true);
      try {
        uploadedPhotoUrl = await uploadAvatar(selectedFile, currentUser.uid);
      } catch (err) {
        logger.error('Falha ao enviar foto de perfil:', err);
        setError(t('profile.avatarUploadError'));
        showError(t('profile.avatarUploadError'));
        setUploadingAvatar(false);
        setSaving(false);
        return;
      }
      setUploadingAvatar(false);
    }

    // 2) Persiste demais campos do perfil no Firestore
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: formData.name,
        nickname: formData.nickname,
        phone: formData.phone,
        preferred_position: formData.preferredPosition,
        bio: formData.bio,
        favorite_team: formData.favoriteTeam,
        updated_at: serverTimestamp(),
      });

      // 3) Atualiza Firebase Auth profile (displayName e/ou photoURL)
      const profileUpdate: { displayName?: string; photoURL?: string } = {};
      if (formData.name !== currentUser.displayName) {
        profileUpdate.displayName = formData.name;
      }
      if (uploadedPhotoUrl) {
        profileUpdate.photoURL = uploadedPhotoUrl;
      }
      if (Object.keys(profileUpdate).length > 0) {
        await updateUserProfile?.(profileUpdate);
      }

      setSuccess(true);
      setSelectedFile(null); // limpa file pendente após sucesso
      setInitialData(formData); // sync para evitar dirty guard após save
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      logger.error('Falha ao salvar perfil:', err);
      setError(getFirestoreErrorMessage(err));
      showError(t('profile.editProfileError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const isDirty =
    initialData !== null &&
    (formData.name !== initialData.name ||
      formData.nickname !== initialData.nickname ||
      formData.phone !== initialData.phone ||
      formData.preferredPosition !== initialData.preferredPosition ||
      formData.bio !== initialData.bio ||
      formData.favoriteTeam !== initialData.favoriteTeam ||
      selectedFile !== null);

  return (
    <FormScaffold
      title={t('profile.editProfile')}
      closeDestination="/profile"
      closeVariant="X"
      isDirty={isDirty}
      loading={saving || uploadingAvatar}
    >
      <Container maxWidth="sm" disableGutters sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} aria-live="polite">
            {t('profile.updatedSuccess')}
          </Alert>
        )}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  hidden
                  aria-label={t('profile.selectPhotoAria')}
                  onChange={handleFileChange}
                />
                <Avatar
                  src={previewUrl || currentUser?.photoURL || undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    bgcolor: 'primary.main',
                    fontSize: '2.5rem',
                  }}
                >
                  {formData.name?.charAt(0)?.toUpperCase() || '?'}
                </Avatar>
                <IconButton
                  onClick={handlePhotoClick}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    // action.hover adapta light/dark; grey.100 era quase branco em dark (#1379)
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  size="small"
                  aria-label={t('profile.changePhotoAria')}
                >
                  <CameraIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                {t('profile.tapToChangePhoto')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label={t('profile.fullNameLabel')}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name}
                fullWidth
                required
              />

              <TextField
                label={t('profile.nicknameLabel')}
                value={formData.nickname}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                error={!!formErrors.nickname}
                helperText={formErrors.nickname || t('profile.nicknameHelper')}
                fullWidth
                inputProps={{ maxLength: 20 }}
              />

              <TextField
                label={t('profile.phoneLabel')}
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                error={!!formErrors.phone}
                helperText={formErrors.phone}
                fullWidth
                placeholder="(11) 99999-9999"
              />

              <TextField
                select
                label={t('profile.preferredPosition')}
                value={formData.preferredPosition || ''}
                onChange={(e) => handleInputChange('preferredPosition', e.target.value || undefined)}
                fullWidth
              >
                <MenuItem value="">
                  <em>{t('profile.positionNone')}</em>
                </MenuItem>
                {POSITION_VALUES.map((pos) => (
                  <MenuItem key={pos} value={pos}>
                    {POSITION_LABELS[pos]}
                  </MenuItem>
                ))}
              </TextField>

              <TeamSelector
                value={formData.favoriteTeam || null}
                onChange={(teamId) => handleInputChange('favoriteTeam', teamId)}
                optional
              />

              <TextField
                label={t('profile.bioLabel')}
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder={t('profile.bioPlaceholder')}
                inputProps={{ maxLength: 200 }}
              />
            </Box>
          </CardContent>
        </Card>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleSave}
          disabled={saving || uploadingAvatar}
          startIcon={saving || uploadingAvatar ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {uploadingAvatar ? t('profile.uploadingPhoto') : t('profile.saveChanges')}
        </Button>
      </Container>
    </FormScaffold>
  );
};
