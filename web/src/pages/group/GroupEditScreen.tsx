import { PageContainer } from '../../components/common/PageContainer';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  IconButton,
  Avatar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import MenuItem from '@mui/material/MenuItem';
import { FormScaffold } from '../../components/layout';
import { GameGender, GAME_GENDER_LABELS } from '../../types/game';
import { doc, updateDoc, serverTimestamp, collection, getDocs, writeBatch, deleteField } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { db } from '../../services/firebase';
import { storage } from '../../services/firebaseStorage';
import { useGroupDetail } from '../../hooks/useGroups';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ShimmerLoading } from '../../components/common/GameCard';
import { validateGroupForm } from '../../utils/groupValidation';
import { useTranslation } from 'react-i18next';
import { uploadImageWithStorageAuthRetry } from '../../utils/storageUpload';

const logger = createLogger('GroupEditScreen');

const GROUP_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const GROUP_PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const GROUP_PHOTO_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const GroupEditScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.editGroup'));
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { firebaseUser, user } = useAuth();
  const closeDestination = groupId ? `/group/${groupId}` : '/?tab=2';

  const { group, members, loading, error } = useGroupDetail(groupId || null);
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    isPublic: boolean;
    defaultGender?: GameGender;
  }>({
    name: '',
    description: '',
    isPublic: false,
    defaultGender: undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Verificar permissão: apenas owner ou admin pode editar
  const uid = firebaseUser?.uid || user?.id;
  const myMember = members.find((m) => m.userId === uid);
  const isOwner = group?.ownerId === uid || myMember?.role === 'OWNER';
  const isAdmin = myMember?.role === 'ADMIN' || isOwner;

  // Preencher formulário com dados do grupo carregado
  useEffect(() => {
    if (group && !initialized) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        isPublic: group.isPublic || false,
        defaultGender: group.defaultGender,
      });
      setInitialized(true);
    }
  }, [group, initialized]);

  const handleInputChange = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const errors = validateGroupForm(formData);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!GROUP_PHOTO_ACCEPTED_TYPES.includes(file.type)) {
      showError(t('groups.photoInvalidType'));
      return;
    }

    if (file.size > GROUP_PHOTO_MAX_BYTES) {
      showError(t('groups.photoTooLarge'));
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleUploadPhoto = async (file: File): Promise<string> => {
    const extension = GROUP_PHOTO_EXTENSION_BY_TYPE[file.type] || 'jpg';
    const groupPhotoRef = storageRef(storage, `groups/${groupId}/logo.${extension}`);
    await uploadImageWithStorageAuthRetry(groupPhotoRef, file);
    return getDownloadURL(groupPhotoRef);
  };

  const handleSubmit = async () => {
    if (!validate() || !groupId || !uid) return;

    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (selectedFile && groupId) {
        setUploadingPhoto(true);
        try {
          photoUrl = await handleUploadPhoto(selectedFile);
        } catch (uploadErr) {
          logger.error('Erro ao fazer upload da foto:', uploadErr);
          showError(t('groups.photoUploadError'));
          setUploadingPhoto(false);
          setSaving(false);
          return;
        }
        setUploadingPhoto(false);
      }

      // Atualizar documento principal do grupo
      const groupRef = doc(db, 'groups', groupId);
      const updateData: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_public: formData.isPublic,
        type: formData.isPublic ? 'PUBLIC' : 'PRIVATE',
        updated_at: serverTimestamp(),
      };
      if (photoUrl) {
        updateData.photo_url = photoUrl;
      }
      // Persiste ou remove categoria padrão dos jogos
      if (formData.defaultGender) {
        updateData.default_gender = formData.defaultGender;
      } else {
        // Ao limpar a seleção, remove o campo do documento
        updateData.default_gender = deleteField();
      }
      await updateDoc(groupRef, updateData);

      // Broadcast denormalized data to ALL group members (non-critical)
      try {
        const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
        const memberIds = membersSnap.docs.map(d => d.id);

        for (let i = 0; i < memberIds.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = memberIds.slice(i, i + 500);

          chunk.forEach(memberId => {
            const memberGroupRef = doc(db, 'users', memberId, 'groups', groupId);
            const memberUpdate: Record<string, unknown> = {
              group_name: formData.name.trim(),
            };
            if (photoUrl) {
              memberUpdate.group_photo = photoUrl;
            }
            batch.update(memberGroupRef, memberUpdate);
          });

          await batch.commit();
        }

        logger.info('Denormalização propagada', { groupId, memberCount: memberIds.length });
      } catch (subErr) {
        logger.warn('Falha ao propagar denormalização (não-crítico):', subErr);
      }

      logger.info('Grupo atualizado com sucesso', { groupId });
      showSuccess(t('feedback.groups.updateSuccess'));
      navigate(closeDestination);
    } catch (err) {
      logger.error('Erro ao atualizar grupo:', err);
      showError(t('feedback.groups.updateError'));
    } finally {
      setSaving(false);
    }
  };

  // Estado de carregamento
  if (loading) {
    return (
      <PageContainer maxWidth="form">
        <ShimmerLoading count={3} type="card" />
      </PageContainer>
    );
  }

  // Estado de erro
  if (error || !group) {
    return (
      <PageContainer maxWidth="form">
        <Alert severity="error">{error || t('groupDetail.notFound')}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(closeDestination)} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </PageContainer>
    );
  }

  // Verificar permissão de edição
  if (!isAdmin) {
    return (
      <PageContainer maxWidth="form">
        <Alert severity="warning">
          {t('groups.onlyOwnerOrAdminEdit')}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(closeDestination)} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </PageContainer>
    );
  }

  const isDirty =
    initialized &&
    group !== null &&
    (formData.name !== (group.name || '') ||
      formData.description !== (group.description || '') ||
      formData.isPublic !== (group.isPublic || false) ||
      formData.defaultGender !== (group.defaultGender) ||
      !!selectedFile);

  return (
    <FormScaffold
      title={t("groups.editGroup")}
      closeDestination={closeDestination}
      closeVariant="X"
      isDirty={isDirty}
      loading={saving}
    >
      <PageContainer maxWidth="form">
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ position: 'relative' }}>
                  <input
                    type="file"
                    accept={GROUP_PHOTO_ACCEPTED_TYPES.join(',')}
                    ref={fileInputRef}
                    hidden
                    aria-label={t('groups.changePhotoAria')}
                    onChange={handleFileChange}
                  />
                  <Avatar
                    src={previewUrl || group.photoUrl || undefined}
                    sx={{
                      width: 100,
                      height: 100,
                      bgcolor: 'primary.main',
                      fontSize: '2.5rem',
                    }}
                  >
                    {formData.name.charAt(0).toUpperCase() || 'G'}
                  </Avatar>
                  <IconButton
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                    size="small"
                    aria-label={t('groups.changePhotoAria')}
                    onClick={handlePhotoClick}
                    disabled={saving || uploadingPhoto}
                  >
                    {uploadingPhoto ? <CircularProgress size={20} /> : <CameraIcon />}
                  </IconButton>
                </Box>
              </Box>

              <TextField
                label={t("groups.groupNameRequired")}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name || t('common.charCount', { current: formData.name.length, max: 50 })}
                fullWidth
                required
                placeholder={t('placeholder.enterGroupNameExample')}
                aria-label={t('a11y.groupName')}
                inputProps={{ maxLength: 100 }}
              />

              <TextField
                label={t("groups.description")}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!formErrors.description}
                helperText={formErrors.description || t('common.charCount', { current: formData.description.length, max: 500 })}
                fullWidth
                multiline
                rows={4}
                placeholder={t('placeholder.enterGroupDescription')}
                aria-label={t('a11y.groupDescription')}
                inputProps={{ maxLength: 500 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                    aria-label={t('a11y.makeGroupPublic')}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">{t("groups.publicGroup")}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("groups.publicGroupDesc")}
                    </Typography>
                  </Box>
                }
              />

              <TextField
                select
                label={t("groups.defaultGender")}
                value={formData.defaultGender || ''}
                onChange={(e) =>
                  handleInputChange('defaultGender', (e.target.value as GameGender) || undefined)
                }
                fullWidth
              >
                <MenuItem value=""><em>{t("groups.defaultGenderNone")}</em></MenuItem>
                {(Object.entries(GAME_GENDER_LABELS) as [GameGender, string][]).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </TextField>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(closeDestination)}
                  fullWidth
                  disabled={saving || uploadingPhoto}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={saving || uploadingPhoto}
                  fullWidth
                  startIcon={saving || uploadingPhoto ? <CircularProgress size={20} /> : <SaveIcon />}
                  aria-label={t('a11y.saveGroupChanges')}
                >
                  {t('common.save')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </PageContainer>
    </FormScaffold>
  );
};
