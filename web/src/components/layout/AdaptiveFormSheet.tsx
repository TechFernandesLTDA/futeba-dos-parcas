import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

interface AdaptiveFormSheetProps {
  /**
   * Conteúdo do formulário — normalmente um <FormScaffold> completo.
   * Renderizado diretamente em mobile (xs/sm) ou dentro de um Drawer em desktop (md+).
   */
  children: ReactNode;
  /**
   * Rota pai para navegação ao fechar o sheet (backdrop, ESC).
   * Deve ser a mesma rota usada no closeDestination do FormScaffold interno.
   */
  closeDestination: string;
  /**
   * Marcador de mudanças não salvas — quando true, fechar via Esc/backdrop em
   * desktop dispara o dialog "Descartar mudanças?" antes de navegar.
   *
   * FIX #574: antes o Drawer.onClose chamava navigate direto, descartando dados
   * silenciosamente em desktop quando user pressionava Esc ou clicava backdrop.
   * Agora replica o pattern do FormScaffold (useDirtyGuard.attemptClose).
   *
   * Em mobile o Drawer não é renderizado — comportamento intacto (FormScaffold
   * cuida do close button do header).
   */
  isDirty?: boolean;
}

/**
 * Wrapper adaptativo para telas de formulário.
 *
 * Comportamento:
 * - Mobile (xs/sm): renderiza children diretamente, sem alteração (fullscreen).
 *   FormScaffold é responsável pelo close button + dirty guard interno.
 * - Desktop (md+): envolve children em um Drawer anchor="right" de 600-720px,
 *   modal com backdrop semitransparente. ESC e click no backdrop disparam
 *   dirty guard se `isDirty=true`, ou navegam direto se `isDirty=false`.
 *
 * Convive com FormScaffold sem substituí-lo — FormScaffold permanece responsável
 * por header com título, botão de fechar e footer fixo. Quando ambos têm
 * `isDirty=true`, dois dialogs distintos protegem caminhos diferentes:
 * - FormScaffold dialog: dispara ao clicar no X do header.
 * - AdaptiveFormSheet dialog: dispara ao Esc / click backdrop.
 *
 * Deep-link direto para /game/create em desktop abre corretamente como sheet
 * sobre o AppLayout (sidebar visível ao fundo do backdrop).
 */
export function AdaptiveFormSheet({
  children,
  closeDestination,
  isDirty = false,
}: AdaptiveFormSheetProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const { isBlocked, attemptClose, proceed, cancel } = useDirtyGuard(isDirty);

  // Mobile: renderiza sem wrapper — comportamento fullscreen atual preservado.
  // FormScaffold cuida do close button + dirty guard nesse caminho.
  if (!isDesktop) {
    return <>{children}</>;
  }

  // Desktop: Drawer modal anchor=right.
  // open=true sempre — o componente só existe enquanto a rota estiver ativa.
  // Fechar (Esc/backdrop) = attemptClose (dirty guard intercepta se isDirty).
  const handleClose = () => {
    attemptClose(() => navigate(closeDestination));
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={true}
        variant="temporary"
        onClose={handleClose}
        ModalProps={{
          // keepMounted=false garante unmount ao navegar — sem vazamento de estado
          keepMounted: false,
        }}
        PaperProps={{
          sx: {
            width: { md: 600, lg: 720 },
            maxWidth: '100vw',
            // Garante scroll interno caso o conteúdo exceda a altura
            overflowY: 'auto',
            // Previne rubber-band scroll no body em iOS Safari (H5 fix)
            overscrollBehavior: 'contain',
          },
        }}
        // Elevação padrão do Drawer; backdrop cobre o layout atrás
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        {children}
      </Drawer>

      <Dialog
        open={isBlocked}
        onClose={cancel}
        aria-labelledby="adaptive-sheet-dirty-title"
        aria-describedby="adaptive-sheet-dirty-description"
        maxWidth="xs"
      >
        <DialogTitle id="adaptive-sheet-dirty-title">Descartar mudanças?</DialogTitle>
        <DialogContent>
          <DialogContentText id="adaptive-sheet-dirty-description">
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
    </>
  );
}
