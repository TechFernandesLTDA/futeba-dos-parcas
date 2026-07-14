import { PageContainer } from '../../components/common/PageContainer';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Avatar,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormLabel,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ArrowForwardIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { recomputeMyProfileClaim } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { TeamSelector } from '../../components/team/TeamSelector';
import { updateProfile } from 'firebase/auth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { avatarSizes } from '../../theme/iconSizes';
import type { PreferredPosition } from '../../types/user';
import { useTranslation } from 'react-i18next';
import {
  getProfileAvatarUploadErrorKey,
  uploadProfileAvatar,
  validateProfileAvatar,
} from '../../utils/profileAvatar';
import { STORAGE_IMAGE_ACCEPT } from '../../utils/storageImage';

const logger = createLogger('ProfileSetupScreen');

export const ProfileSetupScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.profileSetup'));
  const navigate = useNavigate();
  const goBack = useNavigateBack('/welcome');
  const theme = useTheme();
  const { firebaseUser, refreshUser, refreshClaims } = useAuth();
  const { showError } = useToast();

  const [name, setName] = useState(firebaseUser?.displayName || '');
  const [nickname, setNickname] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [preferredPosition, setPreferredPosition] = useState<PreferredPosition | null>(null);
  const [preferredFieldTypes, setPreferredFieldTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateProfileAvatar(file);
    if (validationError === 'invalid-type') {
      showError(t('profile.avatarInvalidType'));
      event.target.value = '';
      return;
    }
    if (validationError === 'too-large') {
      showError(t('profile.avatarTooLarge'));
      event.target.value = '';
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setSelectedFile(file);
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleSave = async () => {
    if (!firebaseUser || !name.trim()) return;

    setLoading(true);
    const originalDisplayName = firebaseUser.displayName;
    const originalPhotoURL = firebaseUser.photoURL;
    const trimmedName = name.trim();
    try {
      let uploadedPhotoUrl = firebaseUser.photoURL || '';
      if (selectedFile) {
        try {
          uploadedPhotoUrl = await uploadProfileAvatar(selectedFile, firebaseUser);
        } catch (uploadErr) {
          logger.error('Falha ao enviar foto de perfil no onboarding:', uploadErr);
          showError(t(getProfileAvatarUploadErrorKey(uploadErr)));
          return;
        }
      }

      await updateProfile(firebaseUser, {
        displayName: trimmedName,
        ...(selectedFile ? { photoURL: uploadedPhotoUrl } : {}),
      });
      
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const profileData = {
          name: trimmedName,
          photo_url: uploadedPhotoUrl,
          nickname: nickname.trim(),
          preferred_position: preferredPosition,
          preferred_field_types: preferredFieldTypes,
          favorite_team: favoriteTeam,
          is_searchable: true,
        };

        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, profileData);
        } else {
          await setDoc(userRef, {
            ...profileData,
            email: firebaseUser.email || '',
            role: 'PLAYER',
            striker_rating: 0,
            mid_rating: 0,
            defender_rating: 0,
            gk_rating: 0,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }
      } catch (firestoreErr) {
        logger.error('Firestore setDoc failed, rolling back Auth:', firestoreErr);
        try {
          await updateProfile(firebaseUser, {
            displayName: originalDisplayName ?? undefined,
            photoURL: originalPhotoURL ?? undefined,
          });
        } catch (rollbackErr) {
          logger.error('Rollback do Auth falhou:', rollbackErr);
          showError(t('feedback.auth.profileInconsistent'));
        }
        showError(t('feedback.profile.saveError'));
        return;
      }

      // #3187: recomputa o claim `profileComplete` no servidor e força refresh
      // do ID token ANTES de navegar — senão o ProfileGate lê o claim stale do
      // token cacheado e reabre o modal de perfil incompleto (loop de re-gate).
      // Falhas são não-fatais: o claim é recomputado lazy em outros pontos.
      try {
        await recomputeMyProfileClaim();
      } catch (recomputeErr) {
        logger.warn('recomputeMyProfileClaim falhou (não-fatal):', recomputeErr);
      }
      try {
        await refreshClaims();
      } catch (claimsErr) {
        logger.warn('Refresh de claims falhou (não-fatal):', claimsErr);
      }

      await refreshUser();

      navigate('/');
    } catch (error) {
      logger.error('Error saving profile:', error);
      showError(t('feedback.profile.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={goBack} aria-label={t('a11y.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('onboarding.setupProfile')}
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="focused">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <input
              type="file"
              accept={STORAGE_IMAGE_ACCEPT}
              ref={fileInputRef}
              hidden
              aria-label={t('profile.selectPhotoAria')}
              onChange={handleFileChange}
            />
            <Avatar
              sx={{
                width: avatarSizes.xxl,
                height: avatarSizes.xxl,
                bgcolor: theme.palette.primary.main,
                fontSize: 48,
              }}
              src={previewUrl || firebaseUser?.photoURL || undefined}
            >
              {name?.charAt(0)?.toUpperCase() || '?'}
            </Avatar>
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                bgcolor: 'background.paper',
                boxShadow: 2,
                '&:hover': { bgcolor: 'background.paper' },
              }}
              size="small"
              aria-label={t('a11y.changeProfilePhoto')}
            >
              <CameraIcon />
            </IconButton>
          </Box>
        </Box>

        <TextField
          fullWidth
          label={t('onboarding.profileSetup.nameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('placeholder.enterNickname')}
          autoComplete="name"
          sx={{ mb: 3 }}
          inputProps={{ maxLength: 100 }}
        />

        <TextField
          fullWidth
          label={t('auth.email')}
          value={firebaseUser?.email || ''}
          disabled
          sx={{ mb: 3 }}
        />

        <Box sx={{ mb: 3 }}>
          <TeamSelector
            value={favoriteTeam}
            onChange={setFavoriteTeam}
            optional
          />
        </Box>

        <TextField
          fullWidth
          label={t('onboarding.profileSetup.nicknameLabel')}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t('placeholder.enterDisplayName')}
          sx={{ mb: 3 }}
          inputProps={{ maxLength: 20 }}
        />

        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ mb: 1, display: 'block', color: 'text.secondary', fontSize: '0.875rem' }}>
            {t('profile.preferredPosition')}
          </FormLabel>
          <ToggleButtonGroup
            value={preferredPosition}
            exclusive
            onChange={(_, val: PreferredPosition | null) => setPreferredPosition(val)}
            aria-label={t('a11y.preferredPosition')}
            size="small"
            fullWidth
          >
            <ToggleButton value="GOLEIRO" aria-label={t('a11y.goalkeeper')}>GK</ToggleButton>
            <ToggleButton value="ZAGUEIRO" aria-label={t('a11y.defender')}>DEF</ToggleButton>
            <ToggleButton value="MEIA" aria-label={t('a11y.midfielder')}>MID</ToggleButton>
            <ToggleButton value="ATACANTE" aria-label={t('a11y.forward')}>STR</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ mb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.875rem' }}>
            {t('onboarding.profileSetup.preferredFieldTypesLabel')}
          </FormLabel>
          <FormGroup row>
            {[
              { value: 'SOCIETY', label: t('onboarding.profileSetup.fieldTypes.society') },
              { value: 'FUTSAL', label: t('onboarding.profileSetup.fieldTypes.futsal') },
              { value: 'CAMPO', label: t('onboarding.profileSetup.fieldTypes.field') },
            ].map((ft) => (
              <FormControlLabel
                key={ft.value}
                control={
                  <Checkbox
                    checked={preferredFieldTypes.includes(ft.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPreferredFieldTypes([...preferredFieldTypes, ft.value]);
                      } else {
                        setPreferredFieldTypes(preferredFieldTypes.filter((v) => v !== ft.value));
                      }
                    }}
                  />
                }
                label={ft.label}
              />
            ))}
          </FormGroup>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('onboarding.profileSetup.nameVisibilityHint')}
        </Typography>

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={!name.trim() || loading}
          onClick={handleSave}
          endIcon={loading ? <CircularProgress size={20} /> : <ArrowForwardIcon />}
        >
          {loading ? t('common.saving') : t('common.continue')}
        </Button>
      </PageContainer>
    </Box>
  );
};
