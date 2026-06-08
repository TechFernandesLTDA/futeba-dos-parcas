import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
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
  Slider,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  PhotoCamera as CameraIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { PageContainer } from '../../components/common/PageContainer';
import { TeamSelector } from '../../components/team/TeamSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PreferredPosition, UserGender } from '../../types/user';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('EditProfileScreen');

// Opções de gênero do perfil — alinhadas com enum Android User.Gender
const USER_GENDER_VALUES: UserGender[] = ['MALE', 'FEMALE', 'OTHER', 'NOT_INFORMED'];

// Limites para upload do avatar (alinhados com storage.rules: 2MB, image/*)
const RATING_RATE_LIMIT_MS = 60_000;
const RATING_RATE_LIMIT_KEY = 'rating_last_changed_at';

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
  strikerRating: number;
  midRating: number;
  defenderRating: number;
  gkRating: number;
  autoStrikerRating: number;
  autoMidRating: number;
  autoDefenderRating: number;
  autoGkRating: number;
  autoRatingSamples: number;
}

// #2276: interface tipada para o doc users lido (substitui Record<string, any>).
// Inclui spellings snake_case acessados como fallback defensivo.
interface RawEditProfileDoc {
  name?: string;
  nickname?: string;
  phone?: string;
  preferredPosition?: PreferredPosition;
  bio?: string;
  favoriteTeam?: string | null;
  strikerRating?: number; striker_rating?: number;
  midRating?: number; mid_rating?: number;
  defenderRating?: number; defender_rating?: number;
  gkRating?: number; gk_rating?: number;
  autoStrikerRating?: number; auto_striker_rating?: number;
  autoMidRating?: number; auto_mid_rating?: number;
  autoDefenderRating?: number; auto_defender_rating?: number;
  autoGkRating?: number; auto_gk_rating?: number;
  autoRatingSamples?: number; auto_rating_samples?: number;
}

export const EditProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('profile.editTitle'));
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

  // Gêneros traduzidos — derivadas dentro do componente para usar t()
  const USER_GENDER_LABELS: Record<UserGender, string> = {
    MALE: t('profile.genderMale'),
    FEMALE: t('profile.genderFemale'),
    OTHER: t('profile.genderOther'),
    NOT_INFORMED: t('profile.genderNotInformed'),
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
    strikerRating: 0,
    midRating: 0,
    defenderRating: 0,
    gkRating: 0,
    autoStrikerRating: 0,
    autoMidRating: 0,
    autoDefenderRating: 0,
    autoGkRating: 0,
    autoRatingSamples: 0,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  // Gênero é PII → lido/escrito em users_private/{uid} separadamente
  const [gender, setGender] = useState<UserGender | ''>('');
  // Snapshot inicial do gênero para o dirty-check (gênero fica fora de
  // initialData/formData por ser PII em coleção separada).
  const [initialGender, setInitialGender] = useState<UserGender | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Sync ref for cleanup (avoids stale closure in unmount effect)
  previewUrlRef.current = previewUrl;

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
      const url = previewUrlRef.current;
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = snakeToCamel<RawEditProfileDoc>(userDoc.data());
        const loaded: UserProfile = {
          name: data.name || currentUser.displayName || '',
          nickname: data.nickname || '',
          phone: data.phone || '',
          preferredPosition: data.preferredPosition,
          bio: data.bio || '',
          favoriteTeam: data.favoriteTeam || null,
          strikerRating: data.strikerRating ?? data.striker_rating ?? 0,
          midRating: data.midRating ?? data.mid_rating ?? 0,
          defenderRating: data.defenderRating ?? data.defender_rating ?? 0,
          gkRating: data.gkRating ?? data.gk_rating ?? 0,
          autoStrikerRating: data.autoStrikerRating ?? data.auto_striker_rating ?? 0,
          autoMidRating: data.autoMidRating ?? data.auto_mid_rating ?? 0,
          autoDefenderRating: data.autoDefenderRating ?? data.auto_defender_rating ?? 0,
          autoGkRating: data.autoGkRating ?? data.auto_gk_rating ?? 0,
          autoRatingSamples: data.autoRatingSamples ?? data.auto_rating_samples ?? 0,
        };
        setFormData(loaded);
        setInitialData(loaded);
      }

      // Lê gênero de users_private/{uid} (PII — sem bloquear a tela em caso de negação)
      try {
        const privateDoc = await getDoc(doc(db, 'users_private', currentUser.uid));
        if (privateDoc.exists()) {
          const privateData = snakeToCamel<{ gender?: UserGender }>(privateDoc.data());
          if (privateData.gender) {
            setGender(privateData.gender);
            setInitialGender(privateData.gender);
          }
        }
      } catch (privateErr) {
        logger.debug('users_private leitura negada (não-crítico):', privateErr);
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

    const ratingsChanged =
      initialData &&
      (formData.strikerRating !== initialData.strikerRating ||
        formData.midRating !== initialData.midRating ||
        formData.defenderRating !== initialData.defenderRating ||
        formData.gkRating !== initialData.gkRating);

    if (ratingsChanged) {
      let lastChanged = 0;
      try {
        lastChanged = Number(localStorage.getItem(RATING_RATE_LIMIT_KEY) || 0);
      } catch (error) {
        console.warn('Failed to read rating rate limit from localStorage:', error);
      }
      if (Date.now() - lastChanged < RATING_RATE_LIMIT_MS) {
        setSaving(false);
        showError(t('feedback.profile.ratingCooldown'));
        return;
      }
      try {
        localStorage.setItem(RATING_RATE_LIMIT_KEY, String(Date.now()));
      } catch (error) {
        console.warn('Failed to save rating rate limit to localStorage:', error);
      }
    }

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
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      showError(t('feedback.profile.nameRequired'));
      setSaving(false);
      return;
    }

    try {
      // #2172: Auth primeiro via AuthContext.updateUserProfile (que já tem
      // rollback Auth↔Firestore para name/photo). Antes o Firestore era
      // escrito antes do Auth, sem rollback — Auth falhar deixava inconsistente.
      const profileUpdate: { displayName?: string; photoURL?: string } = {};
      if (trimmedName !== currentUser.displayName) {
        profileUpdate.displayName = trimmedName;
      }
      if (uploadedPhotoUrl) {
        profileUpdate.photoURL = uploadedPhotoUrl;
      }
      if (Object.keys(profileUpdate).length > 0) {
        await updateUserProfile?.(profileUpdate);
      }

      // 3) Persiste demais campos do perfil (somente Firestore) — só executa se
      // o passo de Auth acima teve sucesso, mantendo a consistência.
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: trimmedName,
        nickname: formData.nickname,
        phone: formData.phone,
        preferred_position: formData.preferredPosition,
        bio: formData.bio,
        favorite_team: formData.favoriteTeam,
        striker_rating: formData.strikerRating,
        mid_rating: formData.midRating,
        defender_rating: formData.defenderRating,
        gk_rating: formData.gkRating,
        striker_rating_set: true,
        mid_rating_set: true,
        defender_rating_set: true,
        gk_rating_set: true,
        updated_at: serverTimestamp(),
      });

      // Persiste gênero em users_private/{uid} (PII — merge para não sobrescrever outros campos)
      if (gender) {
        try {
          await setDoc(
            doc(db, 'users_private', currentUser.uid),
            { gender, updated_at: serverTimestamp() },
            { merge: true }
          );
        } catch (privateErr) {
          logger.error('Falha ao salvar gênero em users_private:', privateErr);
          // Não bloqueia o fluxo principal — o restante do perfil foi salvo;
          // só o gênero (users_private) falhou. Feedback não-fatal (#601 Pattern 2).
          showError(t('profile.genderSaveError'));
        }
      }

      setSuccess(true);
      setSelectedFile(null); // limpa file pendente após sucesso
      setInitialData(formData); // sync para evitar dirty guard após save
      setInitialGender(gender); // idem para o gênero (PII, fora de formData)
      navigate('/?tab=4');
    } catch (err) {
      // FIX 2026-05-20: usar somente Alert (setError) — antes duplicava
      // Alert + Toast com a mesma mensagem (mesmo pattern do #1420).
      logger.error('Falha ao salvar perfil:', err);
      setError(getFirestoreErrorMessage(err, t('profile.editProfileError')));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/?tab=4');
  };

  if (loading) {
    return (
      <PageContainer maxWidth="form" sx={{ textAlign: 'center' }}>
        <CircularProgress />
      </PageContainer>
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
      formData.strikerRating !== initialData.strikerRating ||
      formData.midRating !== initialData.midRating ||
      formData.defenderRating !== initialData.defenderRating ||
      formData.gkRating !== initialData.gkRating ||
      gender !== initialGender ||
      selectedFile !== null);

  return (
    <AdaptiveFormSheet closeDestination="/?tab=4" isDirty={isDirty}>
      <FormScaffold
        title={t('profile.editProfile')}
        closeDestination="/?tab=4"
        closeVariant="X"
        isDirty={isDirty}
        loading={saving || uploadingAvatar}
        footer={
          <>
            <Button onClick={handleCancel} disabled={saving || uploadingAvatar}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || uploadingAvatar}>
              {saving || uploadingAvatar ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <PageContainer maxWidth="form">
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
                inputProps={{ maxLength: 100 }}
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
                placeholder={t('profile.phonePlaceholder')}
                inputProps={{ maxLength: 20 }}
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
                select
                label={t('profile.gender')}
                value={gender}
                onChange={(e) => setGender(e.target.value as UserGender | '')}
                fullWidth
              >
                <MenuItem value="">
                  <em>{t('profile.genderNone')}</em>
                </MenuItem>
                {USER_GENDER_VALUES.map((g) => (
                  <MenuItem key={g} value={g}>
                    {USER_GENDER_LABELS[g]}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label={t('profile.bioLabel')}
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder={t('profile.bioPlaceholder')}
                inputProps={{ maxLength: 500 }}
              />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('profile.skillsByPosition')}
              </Typography>
              <Tooltip title={t('profile.skillsHint')}>
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
            {[
              { key: 'strikerRating' as const, label: t('profile.positionForward'), autoKey: 'autoStrikerRating' as const },
              { key: 'midRating' as const, label: t('profile.midfield'), autoKey: 'autoMidRating' as const },
              { key: 'defenderRating' as const, label: t('profile.positionDefender'), autoKey: 'autoDefenderRating' as const },
              { key: 'gkRating' as const, label: t('profile.positionGoalkeeper'), autoKey: 'autoGkRating' as const },
            ].map(({ key, label, autoKey }) => (
              <Box key={key} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {label}: {formData[key]?.toFixed(1) || '0.0'}
                  {formData[autoKey] > 0 && (
                    <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                      {t('profile.autoRatingPrefix')}: {formData[autoKey].toFixed(1)}
                    </Typography>
                  )}
                </Typography>
                <Slider
                  value={Math.round((formData[key] || 0) * 20)}
                  onChange={(_, v) => handleInputChange(key, Number(v) / 20)}
                  min={0}
                  max={100}
                  step={1}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 50, label: '2.5' },
                    { value: 100, label: '5' },
                  ]}
                  valueLabelFormat={(value) => (value / 20).toFixed(1)}
                  valueLabelDisplay="auto"
                />
              </Box>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              {t('profile.autoRatingNote')}
            </Typography>
          </CardContent>
        </Card>

      </PageContainer>
      </FormScaffold>
    </AdaptiveFormSheet>
  );
};
