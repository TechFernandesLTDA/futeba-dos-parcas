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
  SportsSoccer as GameIcon,
} from '@mui/icons-material';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useInvitePlayers } from '../../hooks/useGroups';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';

const logger = createLogger('JoinByInviteScreen');

interface InvitePreview {
  type: 'GROUP' | 'GAME';
  groupId: string;
  groupName: string;
  gameId?: string;
  gameName?: string;
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
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.acceptInvite'));
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showError } = useToast();
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
        // #2351: lookup por doc-id == code (get), nao where('code') (LIST).
        const inviteSnap = await getDoc(doc(db, 'invites', upperCode));
        if (cancelled) return;

        if (!inviteSnap.exists()) {
          setError('Convite não encontrado. Verifique o código e tente novamente.');
          setLoading(false);
          return;
        }

        const data = inviteSnap.data();
        const expiresAt = data.expires_at?.toDate?.() ?? null;
        const now = Timestamp.now();
        const expired = expiresAt ? expiresAt.getTime() < now.toMillis() : true;
        const used = data.used === true;

        setPreview({
          type: data.game_id ? 'GAME' : (data.type || 'GROUP'),
          groupId: data.group_id || '',
          groupName: data.group_name || 'Grupo',
          gameId: data.game_id || undefined,
          gameName: data.game_name || undefined,
          inviterName: data.inviter_name || 'Organizador',
          expired,
          used,
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        logger.error('Erro ao buscar convite:', err);
        showError('Não foi possível carregar o convite. Tente novamente.');
        setError('Não foi possível carregar o convite. Tente novamente.');
        setLoading(false);
      }
    }

    lookup();
    return () => {
      cancelled = true;
    };
  }, [code, showError]);

  const handleJoin = async () => {
    if (!code || !preview) return;
    if (preview.expired) {
      showError('Este convite expirou. Peça um novo ao organizador.');
      return;
    }
    if (preview.used) {
      showError('Este convite já foi utilizado. Peça um novo ao organizador.');
      return;
    }

    if (preview.type === 'GAME' && preview.gameId) {
      navigate(`/game/${preview.gameId}`, { replace: true });
      return;
    }

    try {
      await joinByInviteCode(code);
      navigate(`/group/${preview.groupId}`, { replace: true });
    } catch (err) {
      logger.error('Erro ao entrar no grupo:', err);
      showError(getFunctionsErrorMessage(err, 'joinGroup', 'Erro ao entrar no grupo'));
    }
  };

  if (!firebaseUser) {
    // ProtectedRoute geralmente cuida disso, mas garantia extra
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={2}>
              <LoginIcon sx={{ fontSize: 64, color: 'primary.main' }} aria-hidden="true" />
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
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} aria-hidden="true" />
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
              <ErrorIcon sx={{ fontSize: 64, color: 'warning.main' }} aria-hidden="true" />
              <Typography variant="h6">
                {preview.used ? 'Convite já usado' : 'Convite expirado'}
              </Typography>
              <Alert severity="warning" sx={{ width: '100%' }}>
                {preview.used
                  ? 'Este convite já foi utilizado. Peça um novo ao organizador.'
                  : 'Este convite expirou. Peça um novo ao organizador.'}
              </Alert>
              <Button variant="outlined" onClick={() => navigate('/')}>
                Voltar
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const isGameInvite = preview.type === 'GAME' && preview.gameId;

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent>
          <Stack alignItems="center" spacing={3}>
            <Avatar sx={{ bgcolor: isGameInvite ? 'success.main' : 'primary.main', width: 64, height: 64 }}>
              {isGameInvite ? <GameIcon sx={{ fontSize: 40 }} aria-hidden="true" /> : <GroupIcon sx={{ fontSize: 40 }} aria-hidden="true" />}
            </Avatar>

            <Stack alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">
                {preview.inviterName} convidou você para
              </Typography>
              <Typography variant="h5" textAlign="center" fontWeight="bold">
                {isGameInvite ? (preview.gameName || 'Jogo') : preview.groupName}
              </Typography>
              {isGameInvite && preview.groupName && (
                <Typography variant="body2" color="text.secondary">
                  Grupo: {preview.groupName}
                </Typography>
              )}
            </Stack>

            <Alert severity="info" sx={{ width: '100%' }}>
              {isGameInvite
                ? 'Ao aceitar, você será direcionado para os detalhes do jogo e poderá confirmar sua presença.'
                : 'Ao aceitar, você se torna membro deste grupo e pode participar dos jogos.'}
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
                startIcon={joining ? <CircularProgress size={16} aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? 'Entrando…' : (isGameInvite ? 'Ver jogo' : 'Aceitar e entrar')}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};
