import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import { ArrowForward as ArrowForwardIcon, SportsSoccer as SoccerIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const WelcomeScreen: React.FC = () => {
  useDocumentTitle('Bem-vindo');
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white',
        p: 3,
      }}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: alpha('#fff', 0.2),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
        }}
      >
        <SoccerIcon sx={{ fontSize: 64 }} />
      </Box>

      <Typography variant="h3" fontWeight={700} gutterBottom sx={{ textAlign: 'center' }}>
        Futeba dos Parças
      </Typography>

      <Typography variant="h6" sx={{ textAlign: 'center', opacity: 0.9, mb: 4, maxWidth: 300 }}>
        Organize suas peladas com os amigos de forma fácil e divertida
      </Typography>

      <Box sx={{ width: '100%', maxWidth: 300 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          sx={{
            bgcolor: 'white',
            color: theme.palette.primary.main,
            py: 1.5,
            mb: 2,
            '&:hover': { bgcolor: alpha('#fff', 0.9) },
          }}
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate('/register')}
        >
          Criar Conta
        </Button>

        <Button
          fullWidth
          variant="outlined"
          size="large"
          sx={{
            borderColor: 'white',
            color: 'white',
            py: 1.5,
            '&:hover': { borderColor: alpha('#fff', 0.8), bgcolor: alpha('#fff', 0.1) },
          }}
          onClick={() => navigate('/login')}
        >
          Já tenho conta
        </Button>
      </Box>

      <Typography variant="caption" sx={{ mt: 4, opacity: 0.7 }}>
        Ao continuar, você concorda com nossos Termos de Uso
      </Typography>
    </Box>
  );
};
