import React, { ReactNode } from 'react';
import { Box, Container, type SxProps, type Theme } from '@mui/material';
import { pageSpacing } from '../../theme/pageTokens';

export type PageWidth = 'focused' | 'form' | 'list' | 'detail' | 'dashboard';

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: PageWidth;
  disablePadding?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Container padronizado para paginas da aplicacao.
 * Aplica padding responsivo e maxWidth consistente com os tokens de layout.
 */
export const PageContainer = React.memo(function PageContainer({
  children,
  maxWidth = 'list',
  disablePadding = false,
  sx,
}: PageContainerProps) {
  const resolvedMaxWidth = pageSpacing.containerMaxWidth[maxWidth];

  // #4047: o override de largura só faz sentido para os tiers LARGOS, cujo
  // `xl` do MUI (1536px) precisa ser limitado a 1320/1500px (herança do fix
  // `2a9ba1ad`). Antes a condição listava apenas `focused`, alargando `form`
  // de 900px para 1500px — o tier virava um no-op ("mobile esticado" em
  // /settings). tiers estreitos (focused xs=444 / form md=900) mantêm o cap
  // do próprio breakpoint.
  const isWideTier = maxWidth === 'list' || maxWidth === 'detail' || maxWidth === 'dashboard';

  return (
    <Box
      sx={[
        {
          width: '100%',
          minWidth: 0,
        },
        disablePadding ? {} : {
          px: pageSpacing.pagePadding,
          pb: pageSpacing.pagePaddingBottom,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Container
        maxWidth={resolvedMaxWidth}
        disableGutters
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          ...(isWideTier && {
            maxWidth: {
              lg: 'min(100%, 1320px)',
              xl: 'min(100%, 1500px)',
            },
          }),
        }}
      >
        {children}
      </Container>
    </Box>
  );
});

export default PageContainer;
