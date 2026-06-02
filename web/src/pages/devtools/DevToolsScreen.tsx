import { useState } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Alert,
  useTheme,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  BugReport as BugIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Build as BuildIcon,
  Info as InfoIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';

export const DevToolsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.devTools'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const { user } = useAuth();

  const [lastAction, setLastAction] = useState<string | null>(null);

  // Versão e build lidos em build time via Vite define (package.json + CI run number).
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const buildNumber = import.meta.env.VITE_APP_BUILD ?? 'dev';

  const handleClearCache = () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
    try {
      sessionStorage.clear();
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error);
    }
    setLastAction('Cache limpo com sucesso!');
  };

  const handleResetOnboarding = () => {
    try {
      localStorage.removeItem('appGuideShown');
    } catch (error) {
      console.warn('Failed to remove appGuideShown from localStorage:', error);
    }
    try {
      localStorage.removeItem('profileSetupComplete');
    } catch (error) {
      console.warn('Failed to remove profileSetupComplete from localStorage:', error);
    }
    setLastAction('Onboarding resetado!');
  };

  const handleAddTestUser = () => {
    setLastAction('Funcionalidade de teste em desenvolvimento');
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
          <IconButton onClick={goBack} aria-label={t('a11y.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Dev Tools
          </Typography>
          <Chip label="DEV" color="error" size="small" sx={{ ml: 2 }} />
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {import.meta.env.MODE === 'production' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>⚠️ AMBIENTE DE PRODUÇÃO</strong>
            <Typography variant="body2">Ações destrutivas afetam dados reais. Tenha cautela.</Typography>
          </Alert>
        )}

        {lastAction && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setLastAction(null)} aria-live="polite">
            {lastAction}
          </Alert>
        )}

        <Alert severity="warning" sx={{ mb: 2 }}>
          Estas ferramentas são apenas para desenvolvimento. Use com cuidado!
        </Alert>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Cache e Dados
            </Typography>
            <List disablePadding>
              <ListItemButton onClick={handleClearCache}>
                <ListItemIcon>
                  <StorageIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Limpar Cache Local"
                  secondary="Remove todos os dados armazenados localmente"
                />
              </ListItemButton>
              <Divider />
              <ListItemButton onClick={handleResetOnboarding}>
                <ListItemIcon>
                  <RefreshIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Resetar Onboarding"
                  secondary="Mostra as telas iniciais novamente"
                />
              </ListItemButton>
              <Divider />
              <Tooltip title="Em desenvolvimento" placement="top">
                <span>
                  <ListItemButton disabled>
                    <ListItemIcon>
                      <DeleteIcon color="disabled" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Limpar Dados do Usuário"
                      secondary="Remove dados de teste do usuário atual"
                    />
                  </ListItemButton>
                </span>
              </Tooltip>
            </List>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Testes
            </Typography>
            <List disablePadding>
              <ListItemButton onClick={handleAddTestUser}>
                <ListItemIcon>
                  <BugIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Criar Usuário de Teste"
                  secondary="Adiciona dados fictícios para testes"
                />
              </ListItemButton>
              <Divider />
              <ListItemButton onClick={() => setLastAction('Erro simulado com sucesso')}>
                <ListItemIcon>
                  <BuildIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Simular Erro"
                  secondary="Testa tela de erro global"
                />
              </ListItemButton>
            </List>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Informações do Sistema
            </Typography>
            <List disablePadding dense>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon />
                </ListItemIcon>
                <ListItemText primary="Versão" secondary={appVersion} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon>
                  <CodeIcon />
                </ListItemIcon>
                <ListItemText primary="Build" secondary={buildNumber} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon>
                  <StorageIcon />
                </ListItemIcon>
                <ListItemText primary="Ambiente" secondary={import.meta.env.MODE} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="User ID"
                  secondary={user?.id || 'Não logado'}
                  secondaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Button
          fullWidth
          variant="outlined"
          color="error"
          onClick={() => window.location.reload()}
        >
          Recarregar Aplicação
        </Button>
      </Container>
    </Box>
  );
};
