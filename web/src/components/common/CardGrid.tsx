import React, { ReactNode } from 'react';
import Grid from '@mui/material/Unstable_Grid2';
import { type SxProps, type Theme } from '@mui/material';
import { gridLayout, type GridVariant } from '../../theme/pageTokens';
import { pageSpacing } from '../../theme/pageTokens';

interface CardGridProps {
  children: ReactNode;
  variant?: GridVariant;
  spacing?: number;
  sx?: SxProps<Theme>;
}

/**
 * Grid padronizado para layouts de cards.
 * Aplica breakpoints responsivos definidos nos tokens de layout.
 */
export const CardGrid = React.memo(function CardGrid({
  children,
  variant = 'cards',
  spacing = 2,
  sx,
}: CardGridProps) {
  const breakpoints = gridLayout[variant];

  return (
    <Grid
      container
      spacing={spacing}
      sx={[
        { mb: pageSpacing.sectionSpacing },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {React.Children.map(children, (child) => (
        <Grid {...breakpoints} sx={{ display: 'flex' }}>
          {child}
        </Grid>
      ))}
    </Grid>
  );
});

export default CardGrid;
