import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useGroupDetail } from '../../hooks/useGroups';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ShimmerLoading } from '../../components/common/GameCard';

const logger = createLogger('GroupEditScreen');

export const GroupEditScreen: React.FC = () => {
  useDocumentTitle('Editar Grupo');
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser, firebaseUser, user } = useAuth();

  const { group, members, loading, error } = useGroupDetail(groupId || null);
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Verificar permissão: apenas owner ou admin pode editar
  const uid = firebaseUser?.uid || user?.id;
  const myMember = members.find((m) => m.userId === uid);
  const isOwner = myMember?.role === 'OWNER';
  const isAdmin = myMember?.role === 'ADMIN' || isOwner;

  // Preencher formulário com dados do grupo carregado
  useEffect(() => {
    if (group && !initialized) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        isPublic: group.isPublic || false,
      });
      setInitialized(true);
    }
  }, [group, initialized]);

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
    if (!validate() || !groupId || !uid) return;

    setSaving(true);
    try {
      // Atualizar documento principal do grupo
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_public: formData.isPublic,
        type: formData.isPublic ? 'PUBLIC' : 'PRIVATE',
        updated_at: Timestamp.now(),
      });

      // Atualizar subcoleção users/{uid}/groups com o nome atualizado
      const userGroupRef = doc(db, 'users', uid, 'groups', groupId);
      await updateDoc(userGroupRef, {
        group_name: formData.name.trim(),
      });

      logger.info('Grupo atualizado com sucesso', { groupId });
      showSuccess('Grupo atualizado com sucesso!');
      navigate(-1);
    } catch (err: any) {
      logger.error('Erro ao atualizar grupo:', err);
      showError('Erro ao atualizar grupo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Estado de carregamento
  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <ShimmerLoading count={3} type="card" />
      </Container>
    );
  }

  // Estado de erro
  if (error || !group) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Alert severity="error">{error || 'Grupo não encontrado'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  // Verificar permissão de edição
  if (!isAdmin) {
    return (
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Alert severity="warning">
          Apenas o dono ou administradores podem editar o grupo.
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Cabeçalho */}
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Editar Grupo
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Nome do Grupo *"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name || `${formData.name.length}/50 caracteres`}
                fullWidth
                required
                placeholder="Ex: Pelada dos Amigos, Futebol do Sábado"
                aria-label="Nome do grupo"
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
                aria-label="Descrição do grupo"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                    aria-label="Tornar grupo público"
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

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(-1)}
                  fullWidth
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={saving}
                  fullWidth
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  aria-label="Salvar alterações do grupo"
                >
                  Salvar
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
