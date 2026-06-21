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
          maxWidth: {
            lg: maxWidth === 'focused' ? undefined : 'min(100%, 1320px)',
            xl: maxWidth === 'focused' ? undefined : 'min(100%, 1500px)',
          },
        }}
      >
        {children}
      </Container>
    </Box>
  );
});

export default PageContainer;
