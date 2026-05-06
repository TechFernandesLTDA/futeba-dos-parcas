import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  Group as GroupIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useInvitePlayers } from '../../hooks/useGroups';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('JoinByInviteScreen');

interface InvitePreview {
  groupId: string;
  groupName: string;
  inviterName: string;
  expired: boolean;
  used: boolean;
}

/**
 * Tela de aceitar convite via link compartilhado /join/:code.
 *
 * Fluxo:
 * 1. Lookup do code na collection invites
 * 2. Mostra preview do grupo + inviter
 * 3. Botao "Entrar no grupo" chama joinByInviteCode
 * 4. Sucesso: navega pra /group/:groupId
 *
 * Issue #514.
 */
export const JoinByInviteScreen: React.FC = () => {
  useDocumentTitle('Aceitar Convite');
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { joinByInviteCode, loading: joining } = useInvitePlayers();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (!code) {
        setError('Código de convite não informado');
        setLoading(false);
        return;
      }
      try {
        const upperCode = code.toUpperCase();
        const q = query(
          collection(db, 'invites'),
          where('code', '==', upperCode),
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;

        if (snapshot.empty) {
          setError('Convite não encontrado. Verifique o código e tente novamente.');
          setLoading(false);
          return;
        }

        const data = snapshot.docs[0].data();
        const expiresAt = data.expires_at?.toDate?.() ?? null;
        const expired = expiresAt && expiresAt < new Date();
        const used = data.used === true;

        setPreview({
          groupId: data.group_id || '',
          groupName: data.group_name || 'Grupo',
          inviterName: data.inviter_name || 'Organizador',
          expired,
          used,
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        logger.error('Erro ao buscar convite:', err);
        setError('Não foi possível carregar o convite. Tente novamente.');
        setLoading(false);
      }
    }

    lookup();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleJoin = async () => {
    if (!code || !preview) return;
    try {
      await joinByInviteCode(code);
      showSuccess(`Você entrou no grupo ${preview.groupName}!`);
      navigate(`/group/${preview.groupId}`);
    } catch (err) {
      logger.error('Erro ao entrar no grupo:', err);
      showError((err as Error).message || 'Erro ao entrar no grupo');
    }
  };

  if (!firebaseUser) {
    // ProtectedRoute geralmente cuida disso, mas garantia extra
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={2}>
              <LoginIcon sx={{ fontSize: 64, color: 'primary.main' }} />
              <Typography variant="h6">Faça login para aceitar o convite</Typography>
              <Button
                variant="contained"
                onClick={() =>
                  navigate(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`)
                }
              >
                Entrar
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Carregando convite…</Typography>
        </Stack>
      </Container>
    );
  }

  if (error || !preview) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={2}>
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />
              <Typography variant="h6">Convite inválido</Typography>
              <Typography color="text.secondary" textAlign="center">
                {error || 'Este convite não existe.'}
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/')}>
                Voltar
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (preview.expired || preview.used) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={2}>
              <ErrorIcon sx={{ fontSize: 64, color: 'warning.main' }} />
              <Typography variant="h6">
                {preview.used ? 'Convite já usado' : 'Convite expirado'}
              </Typography>
              <Typography color="text.secondary" textAlign="center">
                {preview.used
                  ? 'Este convite já foi utilizado. Peça um novo ao organizador.'
                  : 'Este convite expirou. Peça um novo ao organizador.'}
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/')}>
                Voltar
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Stack alignItems="center" spacing={3}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 72, height: 72 }}>
              <GroupIcon sx={{ fontSize: 40 }} />
            </Avatar>

            <Stack alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">
                {preview.inviterName} convidou você para
              </Typography>
              <Typography variant="h5" textAlign="center" fontWeight="bold">
                {preview.groupName}
              </Typography>
            </Stack>

            <Alert severity="info" sx={{ width: '100%' }}>
              Ao aceitar, você se torna membro deste grupo e pode participar dos jogos.
            </Alert>

            <Box sx={{ width: '100%', display: 'flex', gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/')}
                disabled={joining}
              >
                Recusar
              </Button>
              <Button
                fullWidth
                variant="contained"
                startIcon={joining ? <CircularProgress size={16} /> : <CheckIcon />}
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? 'Entrando…' : 'Aceitar e entrar'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};
