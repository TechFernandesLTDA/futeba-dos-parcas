import React from 'react';
import { Card, CardActionArea, CardProps, SxProps, Theme } from '@mui/material';

// Hover apenas para dispositivos com ponteiro real (mouse), nao touch
const HOVER_SX: SxProps<Theme> = {
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': {
      boxShadow: (theme: Theme) => theme.shadows[4],
      transform: 'translateY(-2px)',
    },
  },
};

const BASE_TRANSITION_SX: SxProps<Theme> = {
  transition: 'box-shadow 150ms ease, transform 150ms ease',
};

export interface InteractiveCardProps extends Omit<CardProps, 'onClick'> {
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  actionAreaSx?: SxProps<Theme>;
  actionAreaLabel?: string;
  children: React.ReactNode;
}

/**
 * Wrapper padronizado para cards clicaveis.
 * Usa CardActionArea para acessibilidade e hover apenas em mouse via media query.
 * Aceita ref para posicionar menu de contexto no Shift+F10.
 */
export const InteractiveCard = React.memo(
  React.forwardRef<HTMLDivElement, InteractiveCardProps>(function InteractiveCard(
    { onClick, onContextMenu, onKeyDown, actionAreaSx, actionAreaLabel, children, sx, ...cardProps },
    ref,
  ) {
    if (!onClick) {
      return (
        <Card ref={ref} sx={sx} onContextMenu={onContextMenu} onKeyDown={onKeyDown} {...cardProps}>
          {children}
        </Card>
      );
    }

    return (
      <Card
        ref={ref}
        sx={[
          BASE_TRANSITION_SX,
          HOVER_SX,
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        {...cardProps}
      >
        <CardActionArea
          onClick={onClick}
          aria-label={actionAreaLabel}
          sx={[
            { borderRadius: 'inherit', height: '100%' },
            ...(Array.isArray(actionAreaSx) ? actionAreaSx : actionAreaSx ? [actionAreaSx] : []),
          ]}
        >
          {children}
        </CardActionArea>
      </Card>
    );
  }),
);
