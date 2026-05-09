import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
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
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';

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
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newScheduleDay, setNewScheduleDay] = useState(0);
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [newScheduleMaxPlayers, setNewScheduleMaxPlayers] = useState(14);

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
        showErrorRef.current('Erro ao carregar agendas.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      await updateDoc(doc(db, 'schedules', schedule.id), {
        is_active: !schedule.isActive,
      });
    } catch (err: unknown) {
      showError('Erro ao alterar status: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
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
      showSuccess('Agendamento excluído.');
      setDeleteDialogOpen(false);
      setDeletingSchedule(null);
    } catch (err: unknown) {
      showError('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
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
      showSuccess('Agendamento criado com sucesso!');
      setDialogOpen(false);
      setNewScheduleName('');
      setNewScheduleDay(0);
      setNewScheduleTime('');
      setNewScheduleMaxPlayers(14);
    } catch (err: unknown) {
      showError('Erro ao criar agendamento: ' + (err instanceof Error ? err.message : 'Tente novamente.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Agendamentos
          </Typography>
          <IconButton onClick={() => setDialogOpen(true)} aria-label="Criar agendamento">
            <AddIcon />
          </IconButton>
        </Box>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {loading ? (
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
          </Box>
        ) : (
          <Card>
            <List disablePadding aria-label="Lista de agendamentos">
              {schedules.map((schedule, index) => (
                <Box key={schedule.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={() => handleToggleActive(schedule)}>
                          <Switch checked={schedule.isActive} size="small" />
                        </IconButton>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="new-schedule-dialog-title">
        <DialogTitle id="new-schedule-dialog-title">Novo Agendamento</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              label="Nome"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              fullWidth
              required
              placeholder="Ex: Futebol de Sábado"
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
          <Button onClick={() => setDialogOpen(false)} disabled={actionLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateSchedule} disabled={actionLoading || !newScheduleName.trim() || !newScheduleTime} startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}>
            {actionLoading ? 'Criando...' : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="delete-schedule-dialog-title">
        <DialogTitle id="delete-schedule-dialog-title">Excluir Agendamento</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja excluir &quot;{deletingSchedule?.name}&quot;? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={actionLoading} startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}>
            {actionLoading ? 'Excluindo...' : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
