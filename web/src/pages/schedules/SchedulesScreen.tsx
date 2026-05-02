import { useState, useEffect } from 'react';
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
  Skeleton,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

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
  useDocumentTitle('Agenda');
  const navigate = useNavigate();
  const theme = useTheme();
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    if (!groupId) return;

    const schedulesRef = collection(db, 'schedules');
    const q = query(schedulesRef, where('group_id', '==', groupId), orderBy('day_of_week'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        ...snakeToCamel<Schedule>(d.data()),
        id: d.id,
      }));
      setSchedules(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      await updateDoc(doc(db, 'schedules', schedule.id), {
        is_active: !schedule.isActive,
      });
    } catch (err: any) {
      showError('Erro ao alterar status: ' + err.message);
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
    } catch (err: any) {
      showError('Erro ao excluir: ' + err.message);
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
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

      <Container maxWidth="sm" sx={{ py: 2 }}>
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
                  <ListItem secondaryAction={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={() => handleToggleActive(schedule)}>
                          <Switch checked={schedule.isActive} size="small" />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteClick(schedule)} aria-label={`Excluir ${schedule.name}`}>
                          <DeleteIcon color="error" />
                        </IconButton>
                      </Box>
                    }>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} aria-labelledby="new-schedule-dialog-title">
        <DialogTitle id="new-schedule-dialog-title">Novo Agendamento</DialogTitle>
        <DialogContent>
          <Typography>Formulário de criação de agendamento...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} aria-labelledby="delete-schedule-dialog-title">
        <DialogTitle id="delete-schedule-dialog-title">Excluir Agendamento</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja excluir &quot;{deletingSchedule?.name}&quot;? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={actionLoading} startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}>
            {actionLoading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
