import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ArrowBack as BackIcon,
  QrCode2 as QrIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { checkInToGame } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type CheckInState = 'loading' | 'confirming' | 'success' | 'error';

export const QrCheckInScreen: React.FC = () => {
  useDocumentTitle('Check-in por QR Code');
  const { gameId, token } = useParams<{ gameId: string; token: string }>();
  const navigate = useNavigate();
  const goBack = useNavigateBack('/');
  const { currentUser } = useAuth();
  const { showError } = useToast();

  const [state, setState] = useState<CheckInState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [gameName, setGameName] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    if (!gameId || !token) {
      setState('error');
      setErrorMessage('Link inválido');
      return;
    }

    const validateToken = async () => {
      try {
        const gameSnap = await getDoc(doc(db, 'games', gameId));
        if (!gameSnap.exists()) {
          setState('error');
          setErrorMessage('Jogo não encontrado');
          return;
        }

        const gameData = gameSnap.data();
        setGameName(gameData.location_name || gameData.locationName || 'Jogo');

        const storedToken = gameData.checkin_qr_token;
        if (!storedToken || storedToken !== token) {
          setState('error');
          setErrorMessage('QR Code inválido ou expirado');
          return;
        }

        const status = gameData.status;
        if (status !== 'CONFIRMED' && status !== 'LIVE') {
          setState('error');
          setErrorMessage('Check-in não disponível para este jogo');
          return;
        }

        setState('confirming');
      } catch {
        setState('error');
        setErrorMessage('Erro ao validar QR Code');
      }
    };

    validateToken();
  }, [gameId, token]);

  const handleCheckIn = async () => {
    if (!gameId || !token || !currentUser) {
      showError('Você precisa estar logado para fazer check-in');
      return;
    }

    setCheckingIn(true);
    try {
      await checkInToGame({
        gameId,
        qr_token: token,
      });
      setState('success');
    } catch (err) {
      setErrorMessage((err as Error)?.message || 'Erro ao realizar check-in');
      setState('error');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={goBack}>
          Voltar
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {state === 'loading' && (
            <Box sx={{ py: 4 }}>
              <CircularProgress size={48} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Validando QR Code...
              </Typography>
            </Box>
          )}

          {state === 'confirming' && (
            <>
              <QrIcon
                sx={{
                  fontSize: 64,
                  color: 'primary.main',
                  mb: 2,
                }}
              />
              <Typography variant="h5" gutterBottom>
                Check-in por QR Code
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {gameName}
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleCheckIn}
                disabled={checkingIn}
                startIcon={checkingIn ? <CircularProgress size={20} color="inherit" /> : undefined}
              >
                {checkingIn ? 'Realizando check-in...' : 'Confirmar Check-in'}
              </Button>
            </>
          )}

          {state === 'success' && (
            <>
              <SuccessIcon
                sx={{
                  fontSize: 64,
                  color: 'success.main',
                  mb: 2,
                }}
              />
              <Typography variant="h5" gutterBottom>
                Check-in realizado!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {gameName}
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate(`/game/${gameId}`)}
              >
                Ver detalhes do jogo
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <ErrorIcon
                sx={{
                  fontSize: 64,
                  color: 'error.main',
                  mb: 2,
                }}
              />
              <Typography variant="h5" gutterBottom>
                Erro no check-in
              </Typography>
              <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
                {errorMessage}
              </Alert>
              <Button
                variant="outlined"
                sx={{ mt: 3 }}
                onClick={() => navigate('/')}
              >
                Voltar ao início
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};
