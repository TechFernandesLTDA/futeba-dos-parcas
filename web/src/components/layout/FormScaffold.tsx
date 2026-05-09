import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { ReactNode } from 'react';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';

interface FormScaffoldProps {
  /** Título mostrado no header */
  title: string;
  /** Destino quando usuário fecha o formulário (NÃO usar navigate(-1)) */
  closeDestination: string;
  /** Variante visual do botão de fechar */
  closeVariant?: 'X' | 'back';
  /** Marcador de mudanças não salvas (ativa dirty guard) */
  isDirty?: boolean;
  /** Conteúdo do formulário */
  children: ReactNode;
  /** Botões do footer (geralmente Cancel + Save) */
  footer?: ReactNode;
  /** Loading state pra desabilitar interações */
  loading?: boolean;
}

/**
 * Scaffold padronizado para telas de formulário.
 *
 * Resolve:
 * - Botão X/back com closeDestination hard-coded (não navigate(-1) que quebra deeplinks)
 * - Dirty guard via Dialog MUI (não window.confirm)
 * - Header consistente com title + close button
 * - Footer fixo com ações (cancel/save)
 */
export function FormScaffold({
  title,
  closeDestination,
  closeVariant = 'X',
  isDirty = false,
  children,
  footer,
  loading = false,
}: FormScaffoldProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { isBlocked, attemptClose, proceed, cancel } = useDirtyGuard(isDirty);
  const kbdInset = useKeyboardInset();

  // FIX #574: dirty guard agora intercepta o close button de verdade.
  // Antes: handleClose navegava direto, dialog "Descartar mudanças?" nunca abria
  // (isBlocked era hardcoded false). Agora attemptClose() dispara o dialog
  // se isDirty=true, e proceed() executa a navegação pendente.
  const handleClose = () => {
    attemptClose(() => navigate(closeDestination));
  };

  const CloseIconComponent = closeVariant === 'X' ? CloseIcon : ArrowBackIcon;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleClose}
            disabled={loading}
            aria-label={closeVariant === 'X' ? 'Fechar' : 'Voltar'}
            sx={{ mr: 1 }}
          >
            <CloseIconComponent />
          </IconButton>
          <Typography
            variant="h6"
            component="h1"
            sx={{ flex: 1, fontWeight: 600 }}
            noWrap
          >
            {title}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          maxWidth: { md: 720 },
          width: '100%',
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        {children}
      </Box>

      {footer && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            px: { xs: 2, md: 3 },
            py: 2,
            display: 'flex',
            justifyContent: { xs: 'stretch', md: 'flex-end' },
            gap: 1,
            // Safe-area + keyboard inset dinâmico (visualViewport API, iOS Safari)
            // env(safe-area-inset-bottom) é estático; kbdInset compensa o teclado virtual
            pb: { xs: `calc(env(safe-area-inset-bottom, 0px) + ${kbdInset}px + 16px)`, md: 2 },
          }}
        >
          {footer}
        </Box>
      )}

      <Dialog
        open={isBlocked}
        onClose={cancel}
        aria-labelledby="dirty-guard-title"
        aria-describedby="dirty-guard-description"
        fullWidth={!isDesktop}
        maxWidth="xs"
      >
        <DialogTitle id="dirty-guard-title">Descartar mudanças?</DialogTitle>
        <DialogContent>
          <DialogContentText id="dirty-guard-description">
            Você tem alterações não salvas. Se sair agora, elas serão perdidas.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancel} autoFocus>
            Continuar editando
          </Button>
          <Button onClick={proceed} color="error">
            Descartar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
