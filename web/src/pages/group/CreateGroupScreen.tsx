import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
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
import { FormScaffold, AdaptiveFormSheet } from '../../components/layout';
import { useCreateGroup } from '../../hooks/useGroups';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { validateGroupForm } from '../../utils/groupValidation';
import { useTranslation } from 'react-i18next';

const logger = createLogger('CreateGroupScreen');

export const CreateGroupScreen: React.FC = () => {
  useDocumentTitle('Criar Grupo');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { createGroup, loading, error } = useCreateGroup();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isDirty = !!formData.name || !!formData.description || formData.isPublic;

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

  const handleSubmit = async () => {
    if (!validate()) return;

    // Defesa em profundidade: apenas FIELD_OWNER e ADMIN podem criar grupos
    if (user && user.role !== 'FIELD_OWNER' && user.role !== 'ADMIN') {
      showError(t('groups.onlyOwnersCanCreate'));
      return;
    }

    try {
      const groupId = await createGroup(formData);
      showSuccess(t('groups.createdSuccess'));
      navigate(`/group/${groupId}`);
    } catch (err) {
      logger.error('Error creating group:', err);
      showError(t('groups.createError'));
    }
  };

  return (
    <AdaptiveFormSheet closeDestination="/groups" isDirty={isDirty}>
    <FormScaffold
      title={t('groups.createGroup')}
      closeDestination="/groups"
      closeVariant="X"
      isDirty={isDirty}
      loading={loading}
    >
      <Container maxWidth="sm" disableGutters sx={{ py: 3 }}>
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
                  <Avatar
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

              <Alert severity="info">
                <Typography variant="body2">
                  {t('groups.ownerInfo')}
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/groups')}
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
      </Container>
    </FormScaffold>
    </AdaptiveFormSheet>
  );
};
