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
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PhotoCamera as CameraIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PreferredPosition } from '../../types/user';

const POSITIONS: { value: PreferredPosition; label: string }[] = [
  { value: 'GOLEIRO', label: 'Goleiro' },
  { value: 'ZAGUEIRO', label: 'Zagueiro' },
  { value: 'LATERAL', label: 'Lateral' },
  { value: 'VOLANTE', label: 'Volante' },
  { value: 'MEIA', label: 'Meia' },
  { value: 'ATACANTE', label: 'Atacante' },
];

interface UserProfile {
  name: string;
  nickname: string;
  phone: string;
  preferredPosition?: PreferredPosition;
  bio: string;
}

export const EditProfileScreen: React.FC = () => {
  useDocumentTitle('Editar Perfil');
  const navigate = useNavigate();
  const theme = useTheme();
  const { currentUser, updateUserProfile } = useAuth();

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
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = snakeToCamel(userDoc.data()) as Record<string, any>;
        setFormData({
          name: data.name || currentUser.displayName || '',
          nickname: data.nickname || '',
          phone: data.phone || '',
          preferredPosition: data.preferredPosition,
          bio: data.bio || '',
        });
      }
    } catch (err) {
      setError((err as Error).message);
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
      errors.name = 'Nome é obrigatório';
    } else if (formData.name.length < 2) {
      errors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

    if (formData.nickname && formData.nickname.length > 20) {
      errors.nickname = 'Apelido deve ter no máximo 20 caracteres';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !currentUser) return;

    setSaving(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: formData.name,
        nickname: formData.nickname,
        phone: formData.phone,
        preferred_position: formData.preferredPosition,
        bio: formData.bio,
        updated_at: new Date(),
      });

      if (formData.name !== currentUser.displayName) {
        await updateUserProfile?.({ displayName: formData.name });
      }

      setSuccess(true);
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      setError((err as Error).message);
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

  return (
    <Box sx={{ pb: 4 }}>
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
            Editar Perfil
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} aria-live="polite">
            Perfil atualizado com sucesso!
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
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                  size="small"
                  aria-label="Alterar foto de perfil"
                >
                  <CameraIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Toque para alterar a foto
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Nome Completo"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name}
                fullWidth
                required
              />

              <TextField
                label="Apelido (como te chamam na pelada)"
                value={formData.nickname}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                error={!!formErrors.nickname}
                helperText={formErrors.nickname || 'Ex: "Zé", "Bomba", "Gordo"'}
                fullWidth
                inputProps={{ maxLength: 20 }}
              />

              <TextField
                label="Telefone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                fullWidth
                placeholder="(11) 99999-9999"
              />

              <TextField
                select
                label="Posição Preferida"
                value={formData.preferredPosition || ''}
                onChange={(e) => handleInputChange('preferredPosition', e.target.value || undefined)}
                fullWidth
              >
                <MenuItem value="">
                  <em>Nenhuma</em>
                </MenuItem>
                {POSITIONS.map((pos) => (
                  <MenuItem key={pos.value} value={pos.value}>
                    {pos.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Conte um pouco sobre você..."
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
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          Salvar Alterações
        </Button>
      </Container>
    </Box>
  );
};
