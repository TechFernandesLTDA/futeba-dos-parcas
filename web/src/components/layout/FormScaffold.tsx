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
import { useTheme } from '@mui/material/styles';
import { ReactNode } from 'react';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useNavigateBack } from '../../hooks/useNavigateBack';

interface FormScaffoldProps {
  /** Título mostrado no header */
  title: string;
  /** Destino fallback quando usuário fecha o formulário sem histórico (deep-link). Com histórico, usa navigate(-1). */
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
 * - Botão X/back: navigate(-1) volta pra origem (com fallback p/ closeDestination
 *   quando não há histórico, evitando blank-screen em deep-links)
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
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { isBlocked, attemptClose, proceed, cancel } = useDirtyGuard(isDirty);
  const kbdInset = useKeyboardInset();
  // Fechar volta pra origem (navigate(-1)). Sem histórico cai em closeDestination.
  // Antes: navigate(closeDestination) hardcoded, levava a /games ou /group/X
  // mesmo quando user veio de outra tela — surfava como "página de erro" se
  // o destino fixo não tinha permissão (ex.: grupo deletado/removido).
  const goBack = useNavigateBack(closeDestination);

  const handleClose = () => {
    attemptClose(goBack);
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
