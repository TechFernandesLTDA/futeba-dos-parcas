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
import { FormScaffold } from '../../components/layout';
import { useCreateGroup } from '../../hooks/useGroups';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('CreateGroupScreen');

export const CreateGroupScreen: React.FC = () => {
  useDocumentTitle('Criar Grupo');
  const navigate = useNavigate();
  useAuth();

  const { createGroup, loading, error } = useCreateGroup();
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isDirty = !!formData.name || !!formData.description || formData.isPublic;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Nome do grupo é obrigatório';
    } else if (formData.name.length < 3) {
      errors.name = 'Nome deve ter pelo menos 3 caracteres';
    } else if (formData.name.length > 50) {
      errors.name = 'Nome deve ter no máximo 50 caracteres';
    }

    if (formData.description.length > 500) {
      errors.description = 'Descrição deve ter no máximo 500 caracteres';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const groupId = await createGroup(formData);
      showSuccess('Grupo criado com sucesso!');
      navigate(`/group/${groupId}`);
    } catch (err) {
      logger.error('Error creating group:', err);
      showError('Erro ao criar grupo. Tente novamente.');
    }
  };

  return (
    <FormScaffold
      title="Criar Grupo"
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
                    aria-label="Alterar foto do grupo"
                  >
                    <CameraIcon />
                  </IconButton>
                </Box>
              </Box>

              <TextField
                label="Nome do Grupo *"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name || `${formData.name.length}/50 caracteres`}
                fullWidth
                required
                placeholder="Ex: Pelada dos Amigos, Futebol do Sábado"
              />

              <TextField
                label="Descrição"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!formErrors.description}
                helperText={formErrors.description || `${formData.description.length}/500 caracteres`}
                fullWidth
                multiline
                rows={4}
                placeholder="Descreva seu grupo, horários habituais, nível dos jogadores..."
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
                    <Typography variant="body1">Grupo Público</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Grupos públicos podem ser encontrados na busca
                    </Typography>
                  </Box>
                }
              />

              <Alert severity="info">
                <Typography variant="body2">
                  Você será o <strong>donor</strong> do grupo e poderá convidar outros jogadores.
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/groups')}
                  fullWidth
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  fullWidth
                  startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                >
                  Criar Grupo
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </FormScaffold>
  );
};
