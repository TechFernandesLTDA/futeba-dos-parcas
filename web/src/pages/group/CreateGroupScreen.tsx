import { PageContainer } from '../../components/common/PageContainer';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Add as AddIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import MenuItem from '@mui/material/MenuItem';
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { useCreateGroup } from '../../hooks/useGroups';
import { GameGender, GAME_GENDER_LABELS } from '../../types/game';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { validateGroupForm } from '../../utils/groupValidation';
import { useTranslation } from 'react-i18next';

const logger = createLogger('CreateGroupScreen');

const GROUP_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const GROUP_PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const CreateGroupScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.createGroup'));
  const navigate = useNavigate();
  const { user } = useAuth();

  const { createGroup, loading, error } = useCreateGroup();
  const { showError } = useToast();

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isDirty = !!formData.name || !!formData.description || formData.isPublic || !!selectedFile;

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

  const handleSubmit = async () => {
    if (!validate()) return;

    // Defesa em profundidade: apenas FIELD_OWNER e ADMIN podem criar grupos
    if (user && user.role !== 'FIELD_OWNER' && user.role !== 'ADMIN') {
      showError(t('groups.onlyOwnersCanCreate'));
      return;
    }

    try {
      const groupId = await createGroup(formData, selectedFile);
      navigate(`/group/${groupId}`);
    } catch (err) {
      logger.error('Error creating group:', err);
      showError(t('groups.createError'));
    }
  };

  return (
    <AdaptiveFormSheet closeDestination="/?tab=2" isDirty={isDirty}>
    <FormScaffold
      title={t('groups.createGroup')}
      closeDestination="/?tab=2"
      closeVariant="X"
      isDirty={isDirty}
      loading={loading}
    >
      <PageContainer maxWidth="form">
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

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
                    src={previewUrl || undefined}
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
                    disabled={loading}
                  >
                    <CameraIcon />
                  </IconButton>
                </Box>
              </Box>

              <TextField
                label={t('groups.groupNameRequired')}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name || t('common.charCount', { current: formData.name.length, max: 50 })}
                fullWidth
                required
                placeholder={t('groups.groupNamePlaceholder')}
                inputProps={{ maxLength: 100 }}
              />

              <TextField
                label={t('groups.description')}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!formErrors.description}
                helperText={formErrors.description || t('common.charCount', { current: formData.description.length, max: 500 })}
                fullWidth
                multiline
                rows={4}
                placeholder={t('groups.descriptionPlaceholder')}
                inputProps={{ maxLength: 500 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">{t('groups.publicGroup')}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('groups.publicGroupDesc')}
                    </Typography>
                  </Box>
                }
              />

              <TextField
                select
                label={t('groups.defaultGender')}
                value={formData.defaultGender || ''}
                onChange={(e) =>
                  handleInputChange('defaultGender', (e.target.value as GameGender) || undefined)
                }
                fullWidth
              >
                <MenuItem value="">
                  <em>{t('groups.defaultGenderNone')}</em>
                </MenuItem>
                {(Object.entries(GAME_GENDER_LABELS) as [GameGender, string][]).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              <Alert severity="info">
                <Typography variant="body2">
                  {t('groups.ownerInfo')}
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                   onClick={() => navigate('/?tab=2')}
                  fullWidth
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  fullWidth
                  startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                >
                  {t('groups.createGroup')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </PageContainer>
    </FormScaffold>
    </AdaptiveFormSheet>
  );
};
