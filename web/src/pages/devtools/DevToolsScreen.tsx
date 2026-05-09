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
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Alert,
  useTheme,
  Chip,
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

export const DevToolsScreen: React.FC = () => {
  useDocumentTitle('Ferramentas de Dev');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    setLastAction('Cache limpo com sucesso!');
  };

  const handleResetOnboarding = () => {
    localStorage.removeItem('appGuideShown');
    localStorage.removeItem('profileSetupComplete');
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Dev Tools
          </Typography>
          <Chip label="DEV" color="error" size="small" sx={{ ml: 2 }} />
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
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
              <ListItemButton onClick={() => setLastAction('Dados do usuário limpos')}>
                <ListItemIcon>
                  <DeleteIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Limpar Dados do Usuário"
                  secondary="Remove dados de teste do usuário atual"
                />
              </ListItemButton>
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
                <ListItemText primary="Versão" secondary="1.10.7" />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon>
                  <CodeIcon />
                </ListItemIcon>
                <ListItemText primary="Build" secondary="30" />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon>
                  <StorageIcon />
                </ListItemIcon>
                <ListItemText primary="Ambiente" secondary="development" />
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
