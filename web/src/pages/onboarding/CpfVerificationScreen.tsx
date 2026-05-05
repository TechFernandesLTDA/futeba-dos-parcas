import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Badge as BadgeIcon } from '@mui/icons-material';
import { isValidCpf, formatCpf, stripCpf } from '../../utils/cpfValidator';
import { verifyCpf, setUserVerified } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/**
 * Tela 2/2 do onboarding obrigatório: verificação de CPF.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R3, R6)
 *
 * Fluxo:
 * 1. User digita CPF (mask 999.999.999-99)
 * 2. Valida client-side (formato + dígitos)
 * 3. Cloud Function verifyCpf({ cpf }) — checa duplicate, salva users_private
 * 4. Cloud Function setUserVerified — seta custom claim verified=true
 * 5. Force token refresh + navega para home
 */
export const CpfVerificationScreen: React.FC = () => {
  useDocumentTitle('Verificar CPF');
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showError, showSuccess } = useToast();

  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aplica máscara enquanto digita
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = stripCpf(e.target.value).slice(0, 11);
    if (digits.length === 11) {
      setCpf(formatCpf(digits));
    } else if (digits.length >= 9) {
      setCpf(`${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}${digits.length > 9 ? '-' + digits.substring(9) : ''}`);
    } else if (digits.length >= 6) {
      setCpf(`${digits.substring(0, 3)}.${digits.substring(3, 6)}${digits.length > 6 ? '.' + digits.substring(6) : ''}`);
    } else if (digits.length >= 3) {
      setCpf(`${digits.substring(0, 3)}${digits.length > 3 ? '.' + digits.substring(3) : ''}`);
    } else {
      setCpf(digits);
    }
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!isValidCpf(cpf)) {
      setError('CPF inválido. Confira os dígitos.');
      return;
    }
    if (!firebaseUser) {
      setError('Sessão expirou. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      // Cloud Function valida + checa duplicate + salva users_private
      const verifyResult = await verifyCpf({ cpf: stripCpf(cpf) });
      if (!verifyResult.data.success) {
        throw new Error('Falha ao verificar CPF');
      }

      // Marca usuário como verified=true (custom claim)
      await setUserVerified({});

      // Force token refresh para pegar novo claim
      await firebaseUser.getIdToken(true);

      showSuccess('Conta verificada com sucesso!');
      navigate('/');
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = (err as { message?: string }).message || '';
      let userMsg = 'Erro ao verificar CPF. Tente novamente.';

      if (code === 'functions/already-exists') {
        userMsg = 'Este CPF já está cadastrado em outra conta';
      } else if (code === 'functions/invalid-argument') {
        userMsg = 'CPF inválido';
      } else if (code === 'functions/permission-denied') {
        userMsg = message;
      } else if (code === 'functions/unauthenticated') {
        userMsg = 'Login expirou. Faça login novamente.';
      }

      setError(userMsg);
      showError(userMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <BadgeIcon color="primary" fontSize="large" />
              <Typography component="h1" variant="h5" fontWeight={700}>
                Verificar CPF
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Seu CPF é usado apenas para evitar contas falsas e duplicadas.
              Não compartilhamos com terceiros. Etapa 2 de 2.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="CPF"
              placeholder="999.999.999-99"
              value={cpf}
              onChange={handleChange}
              disabled={loading}
              sx={{ mb: 2 }}
              helperText="Apenas números, com ou sem máscara"
              inputProps={{
                inputMode: 'numeric',
                maxLength: 14,
                'aria-label': 'Número do CPF',
              }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={loading || !isValidCpf(cpf)}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Verificando...' : 'Concluir verificação'}
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 3, textAlign: 'center' }}
            >
              Ao continuar, você concorda com a{' '}
              <a href="/privacy_policy.html" target="_blank" rel="noopener">
                Política de Privacidade
              </a>{' '}
              e os{' '}
              <a href="/terms_of_service.html" target="_blank" rel="noopener">
                Termos de Uso
              </a>
              .
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
