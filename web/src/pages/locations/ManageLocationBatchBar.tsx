import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Location } from '../../types/location';
import { setLocationPublicationStatus } from '../../services/cloudFunctions';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import {
  BATCH_ACTIONS,
  BatchAction,
  BatchOutcome,
  batchLimit,
  getBatchTargets,
  runSequentially,
  summarizeBatch,
  writeLocationPatches,
} from './manageLocationBatch';

const logger = createLogger('ManageLocationBatchBar');

interface BatchBarProps {
  /** Quadras selecionadas (já resolvidas a partir dos ids). */
  selected: readonly Location[];
  adminUid: string;
  onClearSelection: () => void;
  /** Chamado com os ids que deram certo, para sair da seleção. */
  onProcessed: (succeededIds: string[]) => void;
}

const ACTION_KEY: Record<BatchAction, string> = {
  PUBLISH: 'publish',
  VERIFY: 'verify',
  DEACTIVATE: 'deactivate',
};

/** Barra fixa de ações em lote + confirmação (#4372). */
export const ManageLocationBatchBar: React.FC<BatchBarProps> = ({
  selected,
  adminUid,
  onClearSelection,
  onProcessed,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [pending, setPending] = useState<BatchAction | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<BatchOutcome[]>([]);

  const targets = useMemo(
    () => (pending ? getBatchTargets(selected, pending) : { eligible: [], skipped: [] }),
    [pending, selected],
  );
  const limit = pending ? batchLimit(pending) : Number.POSITIVE_INFINITY;
  const toProcess = targets.eligible.slice(0, limit);
  const overLimit = targets.eligible.length - toProcess.length;

  const close = () => {
    if (running) return;
    setPending(null);
    setFailures([]);
    setProgress(null);
  };

  const confirm = async () => {
    if (!pending || toProcess.length === 0) return;
    setRunning(true);
    setFailures([]);
    try {
      const outcomes = pending === 'PUBLISH'
        ? await runSequentially(
          toProcess,
          (location) => setLocationPublicationStatus({
            locationId: location.id,
            publicationStatus: 'PUBLISHED',
          }),
          (done, total) => setProgress({ done, total }),
        )
        : await writeLocationPatches(toProcess, pending, adminUid);

      const summary = summarizeBatch(outcomes);
      onProcessed(outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.id));
      if (summary.failed === 0) {
        showSuccess(t('locations.manageFilters.batch.success', { count: summary.succeeded }));
        setPending(null);
      } else {
        showError(t('locations.manageFilters.batch.partial', {
          ok: summary.succeeded,
          failed: summary.failed,
        }));
        setFailures(summary.failures);
      }
    } catch (error) {
      logger.error('Erro na ação em lote de quadras:', error);
      showError(t('locations.manageFilters.batch.error'));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  if (selected.length === 0 && !pending) return null;

  return (
    <>
      {selected.length > 0 && (
        <Paper
          elevation={8}
          role="region"
          aria-label={t('locations.manageFilters.batch.region')}
          sx={{
            position: 'fixed',
            left: { xs: 8, md: 'auto' },
            right: { xs: 8, md: 24 },
            bottom: { xs: 72, md: 24 },
            zIndex: (theme) => theme.zIndex.appBar + 1,
            p: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, px: 1, flex: { xs: '1 1 100%', md: '0 0 auto' } }}>
            {t('locations.manageFilters.batch.selected', { count: selected.length })}
          </Typography>
          {BATCH_ACTIONS.map((action) => (
            <Button
              key={action}
              size="small"
              variant={action === 'PUBLISH' ? 'contained' : 'outlined'}
              color={action === 'DEACTIVATE' ? 'error' : 'primary'}
              onClick={() => setPending(action)}
              sx={{ minHeight: 44, flex: { xs: '1 1 auto', md: '0 0 auto' } }}
            >
              {t(`locations.manageFilters.batch.${ACTION_KEY[action]}`)}
            </Button>
          ))}
          <Button size="small" onClick={onClearSelection} sx={{ minHeight: 44 }}>
            {t('locations.manageFilters.batch.clearSelection')}
          </Button>
        </Paper>
      )}

      <Dialog open={pending !== null} onClose={close} fullWidth maxWidth="xs">
        {pending && (
          <>
            <DialogTitle>
              {t(`locations.manageFilters.batch.${ACTION_KEY[pending]}Title`, { count: toProcess.length })}
            </DialogTitle>
            <DialogContent>
              {toProcess.length === 0 ? (
                <DialogContentText>{t('locations.manageFilters.batch.nothingToDo')}</DialogContentText>
              ) : (
                <>
                  <DialogContentText component="div">
                    {t(`locations.manageFilters.batch.${ACTION_KEY[pending]}Body`)}
                    <Box component="ul" sx={{ pl: 2.5, my: 1 }}>
                      {toProcess.slice(0, 5).map((location) => (
                        <li key={location.id}>{location.name}</li>
                      ))}
                      {toProcess.length > 5 && (
                        <li>{t('locations.manageFilters.batch.andMore', { count: toProcess.length - 5 })}</li>
                      )}
                    </Box>
                  </DialogContentText>
                  {targets.skipped.length > 0 && (
                    <Alert severity="info" sx={{ mb: 1 }}>
                      {t('locations.manageFilters.batch.skipped', { count: targets.skipped.length })}
                    </Alert>
                  )}
                  {overLimit > 0 && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      {t('locations.manageFilters.batch.overLimit', { max: limit, count: overLimit })}
                    </Alert>
                  )}
                  {progress && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2">
                        {t('locations.manageFilters.batch.running', progress)}
                      </Typography>
                    </Box>
                  )}
                  {failures.length > 0 && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {failures.slice(0, 5).map((failure) => (
                        <div key={failure.id}>{failure.name}: {failure.error}</div>
                      ))}
                    </Alert>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={close} disabled={running} sx={{ minHeight: 44 }}>
                {failures.length > 0 ? t('locations.manageFilters.close') : t('locations.manageFilters.cancel')}
              </Button>
              {toProcess.length > 0 && failures.length === 0 && (
                <Button
                  onClick={confirm}
                  disabled={running}
                  variant="contained"
                  color={pending === 'DEACTIVATE' ? 'error' : 'primary'}
                  sx={{ minHeight: 44 }}
                >
                  {t('locations.manageFilters.batch.confirm')}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};
