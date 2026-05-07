import { Drawer, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

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
}

/**
 * Wrapper adaptativo para telas de formulário.
 *
 * Comportamento:
 * - Mobile (xs/sm): renderiza children diretamente, sem alteração (fullscreen atual).
 * - Desktop (md+): envolve children em um Drawer anchor="right" de 600-720px,
 *   modal com backdrop semitransparente. ESC e click no backdrop navegam para closeDestination.
 *
 * Convive com FormScaffold sem substituí-lo — FormScaffold permanece responsável por:
 * - Header com título e botão de fechar
 * - Dirty guard (useDirtyGuard intercepta navigate antes do Drawer fechar)
 * - Footer fixo
 *
 * Deep-link direto para /game/create em desktop abre corretamente como sheet
 * sobre o AppLayout (sidebar visível ao fundo do backdrop).
 */
export function AdaptiveFormSheet({ children, closeDestination }: AdaptiveFormSheetProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();

  // Mobile: renderiza sem wrapper — comportamento fullscreen atual preservado
  if (!isDesktop) {
    return <>{children}</>;
  }

  // Desktop: Drawer modal anchor=right
  // open={true} sempre — o componente só existe enquanto a rota estiver ativa.
  // Fechar = navegar para closeDestination (dirty guard intercepta se necessário).
  const handleClose = () => {
    navigate(closeDestination);
  };

  return (
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
        },
      }}
      // Elevação padrão do Drawer; backdrop cobre o layout atrás
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      {children}
    </Drawer>
  );
}
