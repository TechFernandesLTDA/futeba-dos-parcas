import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  Slider,
  useTheme,
  useMediaQuery,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Star as StarIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  Speed as SpeedIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import {
  XP_PARTICIPATION,
  XP_GOAL,
  XP_ASSIST,
  XP_MVP,
  XP_WIN,
  XP_STREAK_7,
} from '../../utils/constants';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ErrorState } from '../../components/common/ErrorState';

const logger = createLogger('GamificationSettingsScreen');

// Caminho Firestore: preferências de gamificação do usuário (por usuário, não global)
// XP defaults globais ficam em app_settings/gamification (somente ADMIN edita via Android)
const GAMIFICATION_PREFS_DOC = 'gamification';

interface GamificationPrefs {
  xpNotifications: boolean;
  levelUpNotifications: boolean;
  badgeNotifications: boolean;
  showLevel: boolean;
  showStreak: boolean;
  showBadges: boolean;
  animationsSpeed: number;
}

const DEFAULT_PREFS: GamificationPrefs = {
  xpNotifications: true,
  levelUpNotifications: true,
  badgeNotifications: true,
  showLevel: true,
  showStreak: true,
  showBadges: true,
  animationsSpeed: 1,
};

export const GamificationSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.gamification'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [prefs, setPrefs] = useState<GamificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    try {
      const prefsRef = doc(db, 'users', user.id, 'preferences', GAMIFICATION_PREFS_DOC);
      const docSnap = await getDoc(prefsRef);
      if (docSnap.exists()) {
        const data = snakeToCamel<Partial<GamificationPrefs>>(docSnap.data() as Record<string, unknown>);
        setPrefs({ ...DEFAULT_PREFS, ...data });
      }
    } catch (error) {
      logger.error('Erro ao carregar preferências de gamificação:', error);
      setError(t('feedback.gamification.loadError'));
      showError(t('feedback.gamification.loadError'));
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  useEffect(() => {
    if (user) {
      loadPrefs();
    }
  }, [user, loadPrefs]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const prefsRef = doc(db, 'users', user.id, 'preferences', GAMIFICATION_PREFS_DOC);
      await setDoc(prefsRef, {
        xp_notifications: prefs.xpNotifications,
        level_up_notifications: prefs.levelUpNotifications,
        badge_notifications: prefs.badgeNotifications,
        show_level: prefs.showLevel,
        show_streak: prefs.showStreak,
        show_badges: prefs.showBadges,
        animations_speed: prefs.animationsSpeed,
        updated_at: serverTimestamp(),
      }, { merge: true });
      showSuccess(t('settings.gamification.saveSuccess'));
    } catch (error) {
      logger.error('Erro ao salvar preferências de gamificação:', error);
      showError(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader title="Gamificação" onBack={goBack} />

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => { setError(null); loadPrefs(); }}
        />
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Notificações de Gamificação
              </Typography>
              <List disablePadding>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Notificações de XP"
                    secondary="Receba alertas ao ganhar XP"
                  />
                  <Switch
                    checked={prefs.xpNotifications}
                    onChange={(e) => setPrefs((p) => ({ ...p, xpNotifications: e.target.checked }))}
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <TrophyIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Alertas de Level Up"
                    secondary="Notificar ao subir de nível"
                  />
                  <Switch
                    checked={prefs.levelUpNotifications}
                    onChange={(e) => setPrefs((p) => ({ ...p, levelUpNotifications: e.target.checked }))}
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <StarIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Alertas de Badges"
                    secondary="Notificar ao desbloquear badges"
                  />
                  <Switch
                    checked={prefs.badgeNotifications}
                    onChange={(e) => setPrefs((p) => ({ ...p, badgeNotifications: e.target.checked }))}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Exibição no Perfil
              </Typography>
              <List disablePadding>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <VisibilityIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Mostrar Nível"
                    secondary="Exibir nível no perfil"
                  />
                  <Switch
                    checked={prefs.showLevel}
                    onChange={(e) => setPrefs((p) => ({ ...p, showLevel: e.target.checked }))}
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <FireIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Mostrar Sequência"
                    secondary="Exibir streak no perfil"
                  />
                  <Switch
                    checked={prefs.showStreak}
                    onChange={(e) => setPrefs((p) => ({ ...p, showStreak: e.target.checked }))}
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <StarIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Mostrar Badges"
                    secondary="Exibir conquistas no perfil"
                  />
                  <Switch
                    checked={prefs.showBadges}
                    onChange={(e) => setPrefs((p) => ({ ...p, showBadges: e.target.checked }))}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Animações
              </Typography>
              <Box sx={{ px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <SpeedIcon color="action" />
                  <Typography>{t('settings.gamification.animationsSpeed')}</Typography>
                </Box>
                <Slider
                  value={prefs.animationsSpeed}
                  onChange={(_, v) => setPrefs((p) => ({ ...p, animationsSpeed: v as number }))}
                  min={0.5}
                  max={2}
                  step={0.25}
                  marks={[
                    { value: 0.5, label: 'Lento' },
                    { value: 1, label: 'Normal' },
                    { value: 2, label: 'Rápido' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </CardContent>
          </Card>

          <Button
            variant="contained"
            fullWidth
            onClick={handleSave}
            disabled={saving}
            sx={{ mt: 1 }}
            startIcon={saving ? <CircularProgress size={20} /> : undefined}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>

          {/* Seção somente leitura — fora do formulário para evitar submissão acidental */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Valores de XP (padrão do sistema)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Valores globais do sistema (somente leitura). Para alterar, contate o admin.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={`Participação: +${XP_PARTICIPATION} XP`} size="small" />
                <Chip label={`Gol: +${XP_GOAL} XP`} size="small" color="success" />
                <Chip label={`Assist: +${XP_ASSIST} XP`} size="small" color="info" />
                <Chip label={`MVP: +${XP_MVP} XP`} size="small" color="warning" />
                <Chip label={`Vitória: +${XP_WIN} XP`} size="small" color="primary" />
                <Chip label={`Streak 7: +${XP_STREAK_7} XP`} size="small" color="error" />
              </Box>
            </CardContent>
          </Card>
        </Container>
      )}
    </Box>
  );
};
