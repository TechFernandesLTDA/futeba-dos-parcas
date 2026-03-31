import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  Slider,
  useTheme,
  alpha,
  Chip,
  Paper,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Notifications as NotificationsIcon,
  Star as StarIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as FireIcon,
  Speed as SpeedIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const GamificationSettingsScreen: React.FC = () => {
  useDocumentTitle('Gamificação');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState(true);
  const [showLevel, setShowLevel] = useState(true);
  const [showStreak, setShowStreak] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [ animationsSpeed, setAnimationsSpeed] = useState(1);

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
          <Typography variant="h6" sx={{ ml: 1 }}>
            Gamificação
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
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
                <Switch checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
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
                <Switch checked={notifications} />
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
                <Switch checked={true} />
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
                <Switch checked={showLevel} onChange={(e) => setShowLevel(e.target.checked)} />
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
                <Switch checked={showStreak} onChange={(e) => setShowStreak(e.target.checked)} />
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
                <Switch checked={showBadges} onChange={(e) => setShowBadges(e.target.checked)} />
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
                <Typography>Velocidade das Animações</Typography>
              </Box>
              <Slider
                value={animationsSpeed}
                onChange={(_, v) => setAnimationsSpeed(v as number)}
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

        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              XP Values
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="Participação: +10 XP" size="small" />
              <Chip label="Gol: +5 XP" size="small" color="success" />
              <Chip label="Assist: +3 XP" size="small" color="info" />
              <Chip label="MVP: +50 XP" size="small" color="warning" />
              <Chip label="Vitória: +20 XP" size="small" color="primary" />
              <Chip label="Streak 7: +20 XP" size="small" color="error" />
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
