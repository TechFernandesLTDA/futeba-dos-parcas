import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  Palette as PaletteIcon,
  Info as InfoIcon,
  Logout as LogoutIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('SettingsScreen');

interface Settings {
  notifications: boolean;
  emailNotifications: boolean;
  gameReminders: boolean;
}

export const SettingsScreen: React.FC = () => {
  useDocumentTitle('Configurações');
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    emailNotifications: true,
    gameReminders: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      // FIX C1: era `doc(db, 'users', uid, 'settings')` com 3 segments —
      // path inválido pra doc reference (Firebase v9 throwa). Silent fail
      // em prod desde release inicial: try/catch swallow → defaults useState.
      // Agora usa subcollection `users/{uid}/preferences/notifications` (4 segments).
      const settingsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        setSettings(snakeToCamel(docSnap.data()) as Settings);
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
      showError('Erro ao carregar configurações.');
    }
    setLoading(false);
  }, [user, showError]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user, loadSettings]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // FIX C1: mesma correção do loadSettings — subcollection 4 segments.
      const settingsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      await setDoc(settingsRef, {
        notifications: settings.notifications,
        email_notifications: settings.emailNotifications,
        game_reminders: settings.gameReminders,
        updated_at: serverTimestamp(),
      }, { merge: true });
      showSuccess('Configurações salvas com sucesso!');
    } catch (error) {
      logger.error('Error saving settings:', error);
      showError('Erro ao salvar configurações.');
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    setLogoutDialogOpen(false);
    try {
      // Usa logout() do contexto que já limpa o cache do TanStack Query
      await logout();
      navigate('/login');
    } catch (err) {
      logger.error('Error signing out:', err);
      showError('Erro ao sair da conta. Tente novamente.');
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
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Configurações
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PersonIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {user?.name || 'Usuário'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user?.email}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Notificações
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications}
                      onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                    />
                  }
                  label="Notificações Push"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.emailNotifications}
                      onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                    />
                  }
                  label="Notificações por Email"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.gameReminders}
                      onChange={(e) => setSettings({ ...settings, gameReminders: e.target.checked })}
                    />
                  }
                  label="Lembretes de Jogos"
                />
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <List disablePadding aria-label="Opções de configuração">
                <ListItem button onClick={() => navigate('/settings/theme')}>
                  <ListItemIcon>
                    <PaletteIcon />
                  </ListItemIcon>
                  <ListItemText primary="Tema" secondary="Personalizar aparência" />
                </ListItem>
                <Divider />
                <ListItem button onClick={() => navigate('/settings/gamification')}>
                  <ListItemIcon>
                    <TrophyIcon />
                  </ListItemIcon>
                  <ListItemText primary="Gamificação" secondary="XP, Níveis, Badges" />
                </ListItem>
                <Divider />
                <ListItem button onClick={() => navigate('/about')}>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText primary="Sobre o App" secondary="Versão 1.21.3" />
                </ListItem>
              </List>
            </Card>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={() => setLogoutDialogOpen(true)}
                startIcon={<LogoutIcon />}
              >
                Sair
              </Button>
            </Box>
          </>
        )}
      </Container>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="settings-logout-dialog-title"
      >
        <DialogTitle id="settings-logout-dialog-title">Sair da conta?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você será desconectado e precisará fazer login novamente para acessar o app.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleLogout} color="error" variant="contained">
            Sair
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
