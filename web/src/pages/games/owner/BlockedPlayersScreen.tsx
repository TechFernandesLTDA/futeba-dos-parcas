import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Block as BlockIcon,
  RemoveCircle as UnblockIcon,
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../../components/common/GameCard';
import { ErrorState } from '../../../components/common/ErrorState';
import { ScreenHeader } from '../../../components/common/ScreenHeader';
import { PageContainer } from '../../../components/common/PageContainer';
import { snakeToCamel } from '../../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { createLogger } from '../../../utils/logger';
import { useToast } from '../../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

const logger = createLogger('BlockedPlayersScreen');

interface BlockedPlayer {
  id: string;
  name: string;
  photoUrl?: string;
  reason?: string;
  blockedAt?: Date;
}

// #2276: interfaces tipadas para os docs lidos (substituem Record<string, any>).
interface RawBlockedGameDoc {
  blockedPlayers?: string[];
  ownerId?: string;
}
interface RawBlockedUserDoc {
  name?: string;
  photoUrl?: string;
}

export const BlockedPlayersScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.blockedPlayers'));
  const navigateBack = useNavigateBack('/?tab=1');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [gameOwnerId, setGameOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false; // #2278: evita setState após unmount

    const fetchBlocked = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists() && !cancelled) {
          const gameData = snakeToCamel<RawBlockedGameDoc>(gameDoc.data());
          const blockedIds = gameData.blockedPlayers || [];
          const ownerId = gameData.ownerId || null;
          setGameOwnerId(ownerId);

          // Guard: apenas o dono do jogo pode acessar esta tela
          if (user && user.id !== ownerId) {
            showError(t('feedback.games.onlyOwnerAccess'));
            navigate('/', { replace: true });
            return;
          }

          const players = await Promise.all(
            blockedIds.map(async (uid: string) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const data = snakeToCamel<RawBlockedUserDoc>(userDoc.data());
                return {
                  id: uid,
                  name: data.name || 'Jogador',
                  photoUrl: data.photoUrl,
                };
              }
              return null;
            })
          );
          
          if (!cancelled) setBlockedPlayers(players.filter(Boolean) as BlockedPlayer[]);
        }
        } catch (error) {
        logger.error('Error fetching blocked players:', error);
        if (!cancelled) {
          setLoadError('Erro ao carregar lista de bloqueados.');
          showError(t('feedback.games.blockedListError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBlocked();
    return () => {
      cancelled = true;
    };
  }, [gameId, navigate, showError, user, t]);

  const handleUnblock = async (playerId: string) => {
    if (!gameId || !user) return;

    if (user.id !== gameOwnerId) {
      showError(t('feedback.games.onlyOwnerUnblock'));
      return;
    }

    setUnblockingId(playerId);
    try {
      await updateDoc(doc(db, 'games', gameId), {
        blocked_players: arrayRemove(playerId),
      });
      setBlockedPlayers((prev) => prev.filter((p) => p.id !== playerId));
      showSuccess(t('feedback.games.unblockSuccess'));
    } catch (error) {
      logger.error('Error unblocking player:', error);
      showError(t('feedback.games.unblockError'));
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title="Jogadores Bloqueados" onBack={navigateBack} />

      <PageContainer maxWidth="list">
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => { setLoadError(null); setLoading(true); }}
          />
        ) : loading ? (
          <LoadingState shimmerCount={4} itemType="LIST" />
        ) : blockedPlayers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <BlockIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogador bloqueado
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Jogadores bloqueados não poderão participar deste jogo
            </Typography>
          </Box>
        ) : (
          <Card>
            <List disablePadding aria-label={t('a11y.blockedPlayers')}>
              {blockedPlayers.map((player, index) => (
                <Box key={player.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<UnblockIcon />}
                        onClick={() => handleUnblock(player.id)}
                        disabled={unblockingId === player.id || (user?.id !== gameOwnerId)}
                      >
                        {unblockingId === player.id ? 'Desbloqueando...' : 'Desbloquear'}
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={48} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={player.name}
                      secondary="Bloqueado para este jogo"
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}

        <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Dica:</strong> Jogadores bloqueados não receberão notificações sobre este jogo e não poderão confirmar presença.
          </Typography>
        </Box>
      </PageContainer>
    </Box>
  );
};
