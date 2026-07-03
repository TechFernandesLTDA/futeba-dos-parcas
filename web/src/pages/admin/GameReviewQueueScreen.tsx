import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  AssignmentTurnedIn as ApproveIcon,
  ErrorOutline as ReviewIcon,
  GppBad as RejectIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { collection, limit, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/common/PageContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { db } from '../../services/firebase';
import { reviewHeldGameRewards } from '../../services/cloudFunctions';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { snakeToCamel, toDate } from '../../utils/firestoreHelpers';
import type { Game, XpRewardStatus } from '../../types/game';
import { getFunctionsErrorMessage } from '../../utils/firebaseErrors';

const logger = createLogger('GameReviewQueueScreen');

type QueueFilter = 'HELD_FOR_REVIEW' | 'ELIGIBLE' | 'REJECTED_BY_ADMIN';

interface ReviewQueueGame extends Game {
  ownerNameResolved: string;
}

const TRACKED_REWARD_STATUSES: XpRewardStatus[] = [
  'HELD_FOR_REVIEW',
  'ELIGIBLE',
  'REJECTED_BY_ADMIN',
];

function parseReviewGame(docId: string, raw: Record<string, unknown>): ReviewQueueGame {
  const converted = snakeToCamel(raw);
  return {
    id: docId,
    ...converted,
    dateTime: toDate((raw.dateTime ?? raw.date_time) as Timestamp | Date) || converted.dateTime as Date | undefined,
    createdAt: toDate((raw.created_at ?? raw.createdAt) as Timestamp | Date),
    updatedAt: toDate((raw.updated_at ?? raw.updatedAt) as Timestamp | Date),
    xpProcessedAt: toDate((raw.xp_processed_at ?? raw.xpProcessedAt) as Timestamp | Date),
    xpRewardHeldAt: toDate((raw.xp_reward_held_at ?? raw.xpRewardHeldAt) as Timestamp | Date),
    xpRewardReviewedAt: toDate((raw.xp_reward_reviewed_at ?? raw.xpRewardReviewedAt) as Timestamp | Date),
    validationUpdatedAt: toDate((raw.validation_updated_at ?? raw.validationUpdatedAt) as Timestamp | Date),
    ownerNameResolved:
      String(raw.owner_name ?? raw.ownerName ?? converted.ownerName ?? raw.owner_id ?? converted.ownerId ?? 'Organizador'),
  } as ReviewQueueGame;
}

function formatDateTime(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return 'Sem data';
  return value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRewardStatusMeta(status?: XpRewardStatus) {
  switch (status) {
    case 'HELD_FOR_REVIEW':
      return { label: 'Retido para revisão', color: 'warning' as const };
    case 'ELIGIBLE':
      return { label: 'Liberado manualmente', color: 'info' as const };
    case 'REJECTED_BY_ADMIN':
      return { label: 'Rejeitado pelo admin', color: 'error' as const };
    case 'PROCESSED':
      return { label: 'Processado', color: 'success' as const };
    default:
      return { label: 'Sem status', color: 'default' as const };
  }
}

function getValidationStatusMeta(status?: Game['validationStatus']) {
  switch (status) {
    case 'VALIDATED':
      return { label: 'Validado', color: 'success' as const };
    case 'LOW_CONFIDENCE':
      return { label: 'Baixa confiança', color: 'warning' as const };
    case 'REVIEW_REQUIRED':
      return { label: 'Revisão necessária', color: 'error' as const };
    default:
      return { label: 'Sem validação', color: 'default' as const };
  }
}

export const GameReviewQueueScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [games, setGames] = useState<ReviewQueueGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('HELD_FOR_REVIEW');
  const [search, setSearch] = useState('');
  const [reviewDialogGame, setReviewDialogGame] = useState<ReviewQueueGame | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    const gamesRef = collection(db, 'games');
    const gamesQuery = query(
      gamesRef,
      where('xp_reward_status', 'in', TRACKED_REWARD_STATUSES),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const parsed = snapshot.docs
          .map((doc) => parseReviewGame(doc.id, doc.data()))
          .filter((game) => game.status === 'FINISHED')
          .sort((a, b) => {
            const aTime = a.xpRewardHeldAt?.getTime() ?? a.validationUpdatedAt?.getTime() ?? a.dateTime?.getTime() ?? 0;
            const bTime = b.xpRewardHeldAt?.getTime() ?? b.validationUpdatedAt?.getTime() ?? b.dateTime?.getTime() ?? 0;
            return bTime - aTime;
          });
        setGames(parsed);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        logger.error('Error loading game review queue:', snapshotError);
        setError('Não foi possível carregar a fila de revisão.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const summary = useMemo(() => ({
    held: games.filter((game) => game.xpRewardStatus === 'HELD_FOR_REVIEW').length,
    approved: games.filter((game) => game.xpRewardStatus === 'ELIGIBLE').length,
    rejected: games.filter((game) => game.xpRewardStatus === 'REJECTED_BY_ADMIN').length,
  }), [games]);

  const filteredGames = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return games.filter((game) => {
      const matchesFilter = game.xpRewardStatus === filter;
      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        game.locationName,
        game.ownerNameResolved,
        game.id,
        game.validationReasons?.join(' '),
        game.xpRewardHoldReasons?.join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [filter, games, search]);

  const handleOpenReview = (game: ReviewQueueGame, action: 'APPROVE' | 'REJECT') => {
    setReviewDialogGame(game);
    setReviewAction(action);
    setReviewReason('');
  };

  const handleSubmitReview = async () => {
    if (!reviewDialogGame) return;
    if (reviewReason.trim().length < 10) {
      showError('Informe um motivo com pelo menos 10 caracteres.');
      return;
    }

    setReviewLoading(true);
    try {
      await reviewHeldGameRewards({
        gameId: reviewDialogGame.id,
        action: reviewAction,
        reason: reviewReason.trim(),
      });
      showSuccess(reviewAction === 'APPROVE' ? 'Recompensas liberadas para processamento.' : 'Recompensas rejeitadas com sucesso.');
      setReviewDialogGame(null);
      setReviewReason('');
    } catch (reviewError) {
      logger.error('Error reviewing held rewards:', reviewError);
      showError(getFunctionsErrorMessage(reviewError, 'reviewHeldGameRewards', 'Não foi possível concluir a revisão.'));
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <PageContainer maxWidth="dashboard">
      <ScreenHeader
        title="Revisão de jogos"
        onBack={() => navigate('/admin/users')}
        component="h1"
      />

      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Fila antifraude por evidência
        </Typography>
        <Alert severity="info">
          Jogos com validação em revisão ficam retidos aqui até uma decisão administrativa com justificativa auditável.
        </Alert>

        <Grid container spacing={2}>
          <Grid xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Pendentes</Typography>
                <Typography variant="h4" fontWeight={800}>{summary.held}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Liberados manualmente</Typography>
                <Typography variant="h4" fontWeight={800}>{summary.approved}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Rejeitados</Typography>
                <Typography variant="h4" fontWeight={800}>{summary.rejected}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <ToggleButtonGroup
            exclusive
            color="primary"
            value={filter}
            onChange={(_event, value) => {
              if (value) setFilter(value);
            }}
          >
            <ToggleButton value="HELD_FOR_REVIEW">Pendentes</ToggleButton>
            <ToggleButton value="ELIGIBLE">Liberados</ToggleButton>
            <ToggleButton value="REJECTED_BY_ADMIN">Rejeitados</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label="Buscar por jogo, organizador ou motivo"
            fullWidth
          />
        </Stack>

        {loading ? (
          <LoadingState shimmerCount={6} itemType="LIST" />
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : filteredGames.length === 0 ? (
          <EmptyState
            title="Nenhum jogo nesta fila"
            description="Quando uma validação exigir revisão manual, ela aparecerá aqui com os sinais e motivos do bloqueio."
            icon={<ReviewIcon sx={{ fontSize: 48 }} />}
          />
        ) : (
          <Stack spacing={2}>
            {filteredGames.map((game) => {
              const rewardMeta = getRewardStatusMeta(game.xpRewardStatus);
              const validationMeta = getValidationStatusMeta(game.validationStatus);
              const reasons = game.xpRewardHoldReasons?.length ? game.xpRewardHoldReasons : game.validationReasons ?? [];
              return (
                <Card key={game.id}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                        <Box>
                          <Typography variant="h6" fontWeight={800}>{game.locationName || 'Jogo sem local'}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTime(game.dateTime)} • Organizador: {game.ownerNameResolved}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Jogo {game.id}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip label={rewardMeta.label} color={rewardMeta.color} />
                          <Chip label={validationMeta.label} color={validationMeta.color} variant="outlined" />
                          {typeof game.validationScore === 'number' && (
                            <Chip label={`Score ${game.validationScore}`} variant="outlined" />
                          )}
                        </Stack>
                      </Stack>

                      <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.75 }}>
                          Motivos e sinais
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {reasons.length > 0 ? reasons.map((reason) => (
                            <Chip key={`${game.id}-${reason}`} label={reason} variant="outlined" />
                          )) : (
                            <Chip label="Sem razões registradas" variant="outlined" />
                          )}
                        </Stack>
                      </Box>

                      {(game.xpRewardReviewReason || game.xpRewardReviewedAt) && (
                        <Alert severity={game.xpRewardStatus === 'REJECTED_BY_ADMIN' ? 'error' : 'info'}>
                          <Typography variant="body2" fontWeight={700}>
                            Última decisão manual
                          </Typography>
                          <Typography variant="body2">
                            {game.xpRewardReviewDecision === 'APPROVED' ? 'Aprovado' : 'Rejeitado'} em {formatDateTime(game.xpRewardReviewedAt)}
                          </Typography>
                          {game.xpRewardReviewReason && (
                            <Typography variant="body2">{game.xpRewardReviewReason}</Typography>
                          )}
                        </Alert>
                      )}

                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <Button
                          variant="outlined"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => navigate(`/game/${game.id}`)}
                        >
                          Abrir jogo
                        </Button>
                        {game.xpRewardStatus === 'HELD_FOR_REVIEW' && (
                          <>
                            <Button
                              variant="contained"
                              color="primary"
                              startIcon={<ApproveIcon />}
                              onClick={() => handleOpenReview(game, 'APPROVE')}
                            >
                              Liberar recompensas
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<RejectIcon />}
                              onClick={() => handleOpenReview(game, 'REJECT')}
                            >
                              Rejeitar recompensas
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Dialog
        open={!!reviewDialogGame}
        onClose={() => (reviewLoading ? null : setReviewDialogGame(null))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {reviewAction === 'APPROVE' ? 'Liberar recompensas retidas' : 'Rejeitar recompensas retidas'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {reviewDialogGame?.locationName} • {reviewDialogGame ? formatDateTime(reviewDialogGame.dateTime) : ''}
            </Typography>
            <TextField
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
              label="Justificativa da decisão"
              placeholder="Descreva a evidência usada para aprovar ou rejeitar este jogo."
              fullWidth
              multiline
              minRows={4}
              inputProps={{ maxLength: 500 }}
              helperText={`${reviewReason.trim().length}/500`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogGame(null)} disabled={reviewLoading}>Cancelar</Button>
          <Button
            onClick={handleSubmitReview}
            variant="contained"
            color={reviewAction === 'APPROVE' ? 'primary' : 'error'}
            disabled={reviewLoading}
            startIcon={reviewLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {reviewAction === 'APPROVE' ? 'Confirmar liberação' : 'Confirmar rejeição'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
