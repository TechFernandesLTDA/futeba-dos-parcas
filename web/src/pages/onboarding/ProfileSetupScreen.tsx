import { PageContainer } from '../../components/common/PageContainer';
import { useState } from 'react';
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
import { useTranslation } from 'react-i18next';

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
  const [preferredPosition, setPreferredPosition] = useState<string | null>(null);
  const [preferredFieldTypes, setPreferredFieldTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firebaseUser || !name.trim()) return;

    setLoading(true);
    const originalDisplayName = firebaseUser.displayName;
    const trimmedName = name.trim();
    try {
      await updateProfile(firebaseUser, { displayName: trimmedName });
      
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const profileData = {
          name: trimmedName,
          photo_url: firebaseUser.photoURL || '',
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
          await updateProfile(firebaseUser, { displayName: originalDisplayName ?? undefined });
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
            Configurar Perfil
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="focused">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <Avatar
              sx={{
                width: avatarSizes.xxl,
                height: avatarSizes.xxl,
                bgcolor: theme.palette.primary.main,
                fontSize: 48,
              }}
              src={firebaseUser?.photoURL || undefined}
            >
              {name?.charAt(0)?.toUpperCase() || '?'}
            </Avatar>
            <IconButton
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
          label="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('placeholder.enterNickname')}
          autoComplete="name"
          sx={{ mb: 3 }}
          inputProps={{ maxLength: 100 }}
        />

        <TextField
          fullWidth
          label="Email"
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
          label="Apelido"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t('placeholder.enterDisplayName')}
          sx={{ mb: 3 }}
          inputProps={{ maxLength: 20 }}
        />

        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ mb: 1, display: 'block', color: 'text.secondary', fontSize: '0.875rem' }}>
            Posição Preferida
          </FormLabel>
          <ToggleButtonGroup
            value={preferredPosition}
            exclusive
            onChange={(_, val) => setPreferredPosition(val)}
            aria-label={t('a11y.preferredPosition')}
            size="small"
            fullWidth
          >
            <ToggleButton value="GK" aria-label={t('a11y.goalkeeper')}>GK</ToggleButton>
            <ToggleButton value="DEF" aria-label={t('a11y.defender')}>DEF</ToggleButton>
            <ToggleButton value="MID" aria-label={t('a11y.midfielder')}>MID</ToggleButton>
            <ToggleButton value="STR" aria-label={t('a11y.forward')}>STR</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ mb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.875rem' }}>
            Tipos de Campo Preferidos
          </FormLabel>
          <FormGroup row>
            {[
              { value: 'SOCIETY', label: 'Society' },
              { value: 'FUTSAL', label: 'Futsal' },
              { value: 'CAMPO', label: 'Campo' },
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
          Seu nome será exibido para outros jogadores nos jogos e grupos.
        </Typography>

        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={!name.trim() || loading}
          onClick={handleSave}
          endIcon={loading ? <CircularProgress size={20} /> : <ArrowForwardIcon />}
        >
          {loading ? 'Salvando...' : 'Continuar'}
        </Button>
      </PageContainer>
    </Box>
  );
};
