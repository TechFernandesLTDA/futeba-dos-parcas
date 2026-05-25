import React, { useCallback, useState } from 'react';
import { useNavigateBack } from '../hooks/useNavigateBack';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  EmojiEvents as TrophyIcon,
  People as PeopleIcon,
  PersonAdd as InviteIcon,
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useGamificationColors } from '../hooks/useGamificationColors';
import { functions } from '../services/firebase';

const generateMyInviteCode = httpsCallable<object, { inviteCode: string }>(functions, 'generateMyInviteCode');

export const InviteFriendScreen: React.FC = () => {
  useDocumentTitle('Convidar Amigos');
  const goBack = useNavigateBack('/?tab=4');
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const gColors = useGamificationColors();
  const [generating, setGenerating] = useState(false);

  const inviteCode = user?.inviteCode ?? '';
  const inviteCount = user?.inviteCount ?? 0;
  const inviteLink = inviteCode ? `https://futebadosparcas.web.app/invite/${inviteCode}` : '';

  const getAmbassadorLevel = (count: number): { level: string; icon: string; color: string; next: number } => {
    if (count >= 100) return { level: 'Lenda', icon: '👑', color: gColors.gold, next: 0 };
    if (count >= 30) return { level: 'Ouro', icon: '🟡', color: gColors.gold, next: 100 };
    if (count >= 10) return { level: 'Prata', icon: '⚪', color: gColors.silver, next: 30 };
    if (count >= 3) return { level: 'Bronze', icon: '🟤', color: gColors.bronze, next: 10 };
    return { level: 'Iniciante', icon: '', color: '', next: 3 };
  };

  const ambassador = getAmbassadorLevel(inviteCount);

  const handleCopy = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(
      () => showSuccess('Link copiado! Compartilhe com seus amigos.'),
      () => showError('Erro ao copiar link.'),
    );
  }, [inviteLink, showSuccess, showError]);

  const handleShare = useCallback(() => {
    if (!inviteLink) return;
    if (navigator.share) {
      navigator.share({
        title: 'Futeba dos Parças',
        text: `Bora jogar uma pelada? Entra no Futeba dos Parças com meu convite: ${inviteLink}`,
        url: inviteLink,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  }, [inviteLink, handleCopy]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateMyInviteCode();
      showSuccess('Código de convite gerado!');
      if (user) {
        user.inviteCode = result.data.inviteCode;
        window.location.reload();
      }
    } catch (err) {
      showError((err as Error).message || 'Erro ao gerar código.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          Convidar Amigos
        </Typography>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, textAlign: 'center', bgcolor: (t) => t.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Seu nível de Embaixador
        </Typography>
        <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
          {ambassador.icon} {ambassador.level}
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" mt={2}>
          <Stack alignItems="center">
            <PeopleIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold">{inviteCount}</Typography>
            <Typography variant="caption" color="text.secondary">convidados</Typography>
          </Stack>
          {ambassador.next > 0 && (
            <Stack alignItems="center">
              <TrophyIcon sx={{ color: 'warning.main', fontSize: 28 }} />
              <Typography variant="h6" fontWeight="bold">{ambassador.next}</Typography>
              <Typography variant="caption" color="text.secondary">próximo nível</Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Níveis de Embaixador
        </Typography>
        {[
          { level: 'Bronze', icon: '🥉', count: 3, color: gColors.bronze },
          { level: 'Prata', icon: '🥈', count: 10, color: gColors.silver },
          { level: 'Ouro', icon: '🥇', count: 30, color: gColors.gold },
          { level: 'Lenda', icon: '👑', count: 100, color: gColors.gold },
        ].map((l) => (
          <Stack
            key={l.level}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              py: 1,
              px: 1,
              borderRadius: 1,
              bgcolor: inviteCount >= l.count ? (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' : 'transparent',
              opacity: inviteCount >= l.count ? 1 : 0.5,
            }}
          >
            <Typography variant="h6">{l.icon}</Typography>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={inviteCount >= l.count ? 'bold' : 'normal'}>
                {l.level}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {l.count} convidados
              </Typography>
            </Box>
            {inviteCount >= l.count && <ConqueredChip label="Conquistado" />}
          </Stack>
        ))}
      </Paper>

      {inviteCode ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Seu código de convite
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Compartilhe este link com seus amigos. Quando eles se cadastrarem, você ganha pontos de Embaixador!
          </Typography>
          <TextField
            fullWidth
            value={inviteLink}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopy} aria-label="Copiar link">
                    <CopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <Button fullWidth variant="contained" startIcon={<ShareIcon />} onClick={handleShare}>
            Compartilhar
          </Button>
        </Paper>
      ) : (
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <InviteIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Você ainda não tem um código de convite
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Gere seu código para começar a convidar amigos e ganhar badges de Embaixador!
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <ShareIcon />}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Gerando...' : 'Gerar Meu Código'}
          </Button>
        </Paper>
      )}
    </Container>
  );
};

function ConqueredChip({ label }: { label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        px: 1,
        py: 0.3,
        borderRadius: 1,
        bgcolor: (t) => t.palette.success.main + '20',
        color: 'success.main',
        fontSize: '0.75rem',
        fontWeight: 'bold',
      }}
    >
      {label}
    </Box>
  );
}
