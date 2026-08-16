import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
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
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../contexts/ToastContext';
import { LoadingState } from '../../components/common/GameCard';
import { PageContainer } from '../../components/common/PageContainer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { hasDuplicateScheduleSlot } from '../../utils/gameScheduleValidation';
import { useAuth } from '../../contexts/AuthContext';

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

export const SchedulesScreen: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { groupId } = useParams<{ groupId: string }>();
  const { showError, showSuccess } = useToast();
  const { firebaseUser } = useAuth();
  const currentUserId = firebaseUser?.uid;
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const { t } = useTranslation();
  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`schedule.day${i}`));

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
  const [canManage, setCanManage] = useState(false);

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
        showErrorRef.current(t('feedback.schedules.loadError'));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId, retryCount, t]);

  useEffect(() => {
    if (!groupId || !currentUserId) {
      setCanManage(false);
      return;
    }
    let cancelled = false;
    void Promise.all([
      getDoc(doc(db, 'groups', groupId)),
      getDoc(doc(db, 'groups', groupId, 'members', currentUserId)),
    ]).then(([groupSnapshot, memberSnapshot]) => {
      if (cancelled) return;
      const group = groupSnapshot.data();
      const member = memberSnapshot.data();
      const identityMatches = member?.user_id === currentUserId;
      setCanManage(
        group?.owner_id === currentUserId ||
        (identityMatches && member?.status === 'ACTIVE' &&
          (member?.role === 'OWNER' || member?.role === 'ADMIN'))
      );
    }).catch((cause) => {
      if (cancelled) return;
      logger.error('Error checking schedule permissions:', cause);
      setCanManage(false);
      showErrorRef.current(t('feedback.schedules.loadError'));
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, groupId, retryCount, t]);

  const handleToggleActive = async (schedule: Schedule) => {
    if (!canManage) return;
    // Evita spam-toggle enquanto o write está em andamento (#2300)
    if (togglingId === schedule.id) return;
    setTogglingId(schedule.id);
    try {
      await updateDoc(doc(db, 'schedules', schedule.id), {
        is_active: !schedule.isActive,
      });
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, t('feedback.schedules.toggleError')));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSchedule || !canManage) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', deletingSchedule.id));
      showSuccess(t('feedback.schedules.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeletingSchedule(null);
    } catch (err: unknown) {
      showError(getFirestoreErrorMessage(err, t('feedback.schedules.deleteError')));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!groupId || !currentUserId || !canManage || !newScheduleName.trim() || !newScheduleTime) return;
    setActionLoading(true);
    try {
      const existingSnapshot = await getDocs(
        query(collection(db, 'schedules'), where('group_id', '==', groupId)),
      );
      const existingSlots = existingSnapshot.docs.map((scheduleDoc) => {
        const data = scheduleDoc.data();
        return {
          dayOfWeek: Number(data.day_of_week),
          time: String(data.time ?? ''),
          isActive: data.is_active !== false,
        };
      });

      if (hasDuplicateScheduleSlot(existingSlots, newScheduleDay, newScheduleTime)) {
        showError(t('feedback.schedules.duplicateSlot'));
        return;
      }

      await addDoc(collection(db, 'schedules'), {
        owner_id: currentUserId,
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
      showError(getFirestoreErrorMessage(err, t('feedback.schedules.createError')));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box>
      <ScreenHeader
        title={t('schedule.title')}
        onBack={() => navigate(groupId ? `/group/${groupId}` : '/?tab=2')}
        backAriaLabel={t('common.back')}
        actions={canManage ? (
          <IconButton onClick={() => setDialogOpen(true)} aria-label={t('a11y.createSchedule')}>
            <AddIcon />
          </IconButton>
        ) : undefined}
      />

      <PageContainer maxWidth="list">
        {error ? (
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              {t('common.retry')}
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
              {t('schedule.emptyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('schedule.emptyDesc')}
            </Typography>
            {canManage && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
                sx={{ mt: 2 }}
              >
                {t('schedule.createFirst')}
              </Button>
            )}
          </Box>
        ) : (
          <Card>
            <List disablePadding aria-label={t('a11y.scheduleList')}>
              {schedules.map((schedule, index) => (
                <Box key={schedule.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={canManage ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Switch
                          checked={schedule.isActive}
                          onChange={() => handleToggleActive(schedule)}
                          disabled={togglingId === schedule.id}
                          size="small"
                          inputProps={{ 'aria-label': schedule.isActive ? t('schedule.deactivate', { name: schedule.name }) : t('schedule.activate', { name: schedule.name }) }}
                        />
                        <IconButton onClick={() => handleDeleteClick(schedule)} aria-label={t('schedule.deleteAria', { name: schedule.name })}>
                          <DeleteIcon color="error" />
                        </IconButton>
                      </Box>
                    ) : undefined}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {schedule.name}
                          {!schedule.isActive && (
                            <Chip label={t('schedule.inactive')} size="small" color="default" />
                          )}
                        </Box>
                      }
                      secondary={t('schedule.itemDescription', { day: daysOfWeek[schedule.dayOfWeek], time: schedule.time, players: schedule.maxPlayers })}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        )}
      </PageContainer>

      <Dialog open={canManage && dialogOpen} onClose={() => { setDialogOpen(false); setScheduleNameTouched(false); setScheduleTimeTouched(false); }} fullScreen={isMobile} fullWidth maxWidth="sm" aria-labelledby="new-schedule-dialog-title">
        <DialogTitle id="new-schedule-dialog-title">{t('schedule.newTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              label={t('schedule.nameLabel')}
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
              label={t('schedule.dayOfWeekLabel')}
              value={newScheduleDay}
              onChange={(e) => setNewScheduleDay(Number(e.target.value))}
              fullWidth
            >
              {daysOfWeek.map((day, idx) => (
                <MenuItem key={idx} value={idx}>{day}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('schedule.timeLabel')}
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
              label={t('games.create.maxPlayers')}
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
            {actionLoading ? t('schedule.creating') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={canManage && deleteDialogOpen}
        title={t('schedule.deleteTitle')}
        message={t('schedule.deleteConfirm', { name: deletingSchedule?.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        loading={actionLoading}
        loadingLabel={t('common.deleting')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
};
