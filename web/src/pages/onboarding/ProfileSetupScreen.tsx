import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  IconButton,
  Avatar,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as ArrowForwardIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { TeamSelector } from '../../components/team/TeamSelector';
import { updateProfile } from 'firebase/auth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ProfileSetupScreen');

export const ProfileSetupScreen: React.FC = () => {
  useDocumentTitle('Configurar Perfil');
  const navigate = useNavigate();
  const theme = useTheme();
  const { firebaseUser } = useAuth();
  const { showError } = useToast();

  const [name, setName] = useState(firebaseUser?.displayName || '');
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firebaseUser || !name.trim()) return;

    setLoading(true);
    try {
      await updateProfile(firebaseUser, { displayName: name });
      
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        name,
        email: firebaseUser.email,
        photo_url: firebaseUser.photoURL || '',
        nickname: '',
        role: 'PLAYER',
        level: 1,
        experience_points: 0,
        striker_rating: 3,
        mid_rating: 3,
        defender_rating: 3,
        gk_rating: 3,
        preferred_position: null,
        preferred_field_types: [],
        favorite_team: favoriteTeam,
        total_games: 0,
        total_goals: 0,
        total_assists: 0,
        total_wins: 0,
        total_draws: 0,
        total_losses: 0,
        total_saves: 0,
        mvp_count: 0,
        yellow_cards: 0,
        red_cards: 0,
        current_streak: 0,
        best_streak: 0,
        is_searchable: true,
        is_verified: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });

      navigate('/');
    } catch (error) {
      logger.error('Error saving profile:', error);
      showError('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
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
            Configurar Perfil
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
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
              aria-label="Alterar foto de perfil"
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
          placeholder="Como seus amigos te chamam?"
          sx={{ mb: 3 }}
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
      </Container>
    </Box>
  );
};
