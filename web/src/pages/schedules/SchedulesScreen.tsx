import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Switch,
  Chip,
  Divider,
  Button,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';

const logger = createLogger('SchedulesScreen');

interface Schedule {
  id: string;
  groupId: string;
  name: string;
  dayOfWeek: number;
  time: string;
  locationName?: string;
  maxPlayers: number;
  isActive: boolean;
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const SchedulesScreen: React.FC = () => {
  const navigate = useNavigate();
    const theme = useTheme();
    const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { groupId } = useParams<{ groupId: string }>();
  const { showError, showSuccess } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const { t } = useTranslation();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newScheduleDay, setNewScheduleDay] = useState(0);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleMaxPlayers, setNewScheduleMaxPlayers] = useState(14);
  const [scheduleNameTouched, setScheduleNameTouched] = useState(false); // #2231
  const [scheduleTimeTouched, setScheduleTimeTouched] = useState(false); // #2231
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    if (!groupId) return;

    const schedulesRef = collection(db, 'schedules');
    const q = query(schedulesRef, where('group_id', '==', groupId), orderBy('day_of_week'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          ...snakeToCamel<Schedule>(d.data()),
          id: d.id,
        }));
        setSchedules(data);
        setLoading(false);
      },
      (err) => {
        logger.error('Error in schedules listener:', err);
        setError(t('feedback.schedules.loadError'));
        showErrorRef.current('Erro ao carregar agendas.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId, retryCount, t]);

  const handleToggleActive = async (schedule: Schedule) => {
    // Evita spam-toggle enquanto o write está em andamento (#2300)
    if (togglingId === schedule.id) return;
    setTogglingId(schedule.id);
    try {
      await updateDoc(doc(db, 'schedules', schedule.id), {
        is_active: !schedule.isActive,
      });
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, 'Erro ao alterar status'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', deletingSchedule.id));
      showSuccess(t('feedback.schedules.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeletingSchedule(null);
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, 'Erro ao excluir agendamento'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!groupId || !newScheduleName.trim() || !newScheduleTime) return;
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'schedules'), {
        group_id: groupId,
        name: newScheduleName.trim(),
        day_of_week: newScheduleDay,
        time: newScheduleTime,
        max_players: newScheduleMaxPlayers,
        is_active: true,
        created_at: serverTimestamp(),
      });
      showSuccess(t('feedback.schedules.createSuccess'));
      setDialogOpen(false);
      setNewScheduleName('');
      setNewScheduleDay(0);
      setNewScheduleTime('');
      setNewScheduleMaxPlayers(14);
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, 'Erro ao criar agendamento'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title="Agendamentos"
        onBack={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}
        backAriaLabel={t('common.back')}
        actions={
          <IconButton onClick={() => setDialogOpen(true)} aria-label={t('a11y.createSchedule')}>
            <AddIcon />
          </IconButton>
        }
      />

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {error ? (
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Tentar novamente
            </Button>
          }>
            {error}
          </Alert>
        ) : loading ? (
          <LoadingState shimmerCount={4} itemType="CARD" />
        ) : schedules.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <ScheduleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum agendamento
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Crie agendamentos para jogos recorrentes
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Criar primeiro agendamento
            </Button>
          </Box>
        ) : (
          <Card>
            <List disablePadding aria-label={t('a11y.scheduleList')}>
              {schedules.map((schedule, index) => (
                <Box key={schedule.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Switch
                          checked={schedule.isActive}
                          onChange={() => handleToggleActive(schedule)}
                          disabled={togglingId === schedule.id}
                          size="small"
                          inputProps={{ 'aria-label': `${schedule.isActive ? 'Desativar' : 'Ativar'} ${schedule.name}` }}
                        />
                        <IconButton onClick={() => handleDeleteClick(schedule)} aria-label={`Excluir ${schedule.name}`}>
                          <DeleteIcon color="error" />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {schedule.name}
                          {!schedule.isActive && (
                            <Chip label="Inativo" size="small" color="default" />
                          )}
                        </Box>
                      }
                      secondary={`${DAYS_OF_WEEK[schedule.dayOfWeek]} às ${schedule.time} • ${schedule.maxPlayers} jogadores`}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}
      </Container>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setScheduleNameTouched(false); setScheduleTimeTouched(false); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="new-schedule-dialog-title">
        <DialogTitle id="new-schedule-dialog-title">Novo Agendamento</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              label="Nome"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              onBlur={() => setScheduleNameTouched(true)}
              error={scheduleNameTouched && !newScheduleName.trim()}
              helperText={scheduleNameTouched && !newScheduleName.trim() ? t('validation.required') : ' '}
              fullWidth
              required
              placeholder={t('placeholder.enterScheduleName')}
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              select
              label="Dia da Semana"
              value={newScheduleDay}
              onChange={(e) => setNewScheduleDay(Number(e.target.value))}
              fullWidth
            >
              {DAYS_OF_WEEK.map((day, idx) => (
                <MenuItem key={idx} value={idx}>{day}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Horário"
              type="time"
              value={newScheduleTime}
              onChange={(e) => setNewScheduleTime(e.target.value)}
              onBlur={() => setScheduleTimeTouched(true)}
              error={scheduleTimeTouched && !newScheduleTime}
              helperText={scheduleTimeTouched && !newScheduleTime ? t('validation.required') : ' '}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Máx. Jogadores"
              type="number"
              value={newScheduleMaxPlayers}
              onChange={(e) => { const v = parseInt(e.target.value); setNewScheduleMaxPlayers(isNaN(v) ? 14 : v); }}
              fullWidth
              inputProps={{ min: 2, max: 50 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setScheduleNameTouched(false); setScheduleTimeTouched(false); }} disabled={actionLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateSchedule} disabled={actionLoading || !newScheduleName.trim() || !newScheduleTime} startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}>
            {actionLoading ? 'Criando...' : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Excluir Agendamento"
        message={`Tem certeza que deseja excluir "${deletingSchedule?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        loading={actionLoading}
        loadingLabel="Excluindo..."
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
};
